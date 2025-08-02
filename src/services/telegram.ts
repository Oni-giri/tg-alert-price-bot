import { Bot, Context, InlineKeyboard, session, SessionFlavor } from 'grammy';
import { config } from '../config';
import { logger } from '../utils/logger';
import { 
  IDatabaseService, 
  ICryptoService, 
  User,
  CreateAlertInputSchema,
  UpdateAlertInputSchema 
} from '../types';

interface SessionData {
  awaitingAlertConfig?: {
    step: 'crypto' | 'threshold' | 'timeframe';
    crypto?: string;
    threshold?: number;
  } | undefined;
  awaitingUpdateConfig?: {
    alertId: number;
    step: 'threshold' | 'timeframe' | 'status';
  } | undefined;
}

type BotContext = Context & SessionFlavor<SessionData>;

export class TelegramBotService {
  private bot: Bot<BotContext>;
  private userCommandCounts = new Map<number, { count: number; resetTime: Date }>();

  constructor(
    private dbService: IDatabaseService,
    private cryptoService: ICryptoService
  ) {
    this.bot = new Bot<BotContext>(config.TELEGRAM_BOT_TOKEN);
    this.setupMiddleware();
    this.setupCommands();
    this.setupCallbacks();
  }

  private setupMiddleware(): void {
    // Session middleware
    this.bot.use(session({
      initial: (): SessionData => ({}),
    }));

    // User registration and rate limiting middleware
    this.bot.use(async (ctx, next) => {
      if (!ctx.from) return;

      try {
        // Register or get user
        let user = await this.dbService.getUserByTelegramId(ctx.from.id);
        if (!user) {
          user = await this.dbService.createUser(ctx.from.id, ctx.from.username);
          logger.info(`New user registered: ${ctx.from.id} (${ctx.from.username || 'no username'})`);
        }

        // Rate limiting
        if (!this.checkRateLimit(ctx.from.id)) {
          await ctx.reply('⚠️ You are sending commands too quickly. Please wait a moment.');
          return;
        }

        await next();
      } catch (error) {
        logger.error('Middleware error:', error);
        await ctx.reply('❌ An error occurred. Please try again later.');
      }
    });
  }

  private checkRateLimit(userId: number): boolean {
    const now = new Date();
    const userLimits = this.userCommandCounts.get(userId);

    if (!userLimits || now >= userLimits.resetTime) {
      this.userCommandCounts.set(userId, {
        count: 1,
        resetTime: new Date(now.getTime() + 60000), // Reset after 1 minute
      });
      return true;
    }

    if (userLimits.count >= config.MAX_COMMANDS_PER_MINUTE) {
      return false;
    }

    userLimits.count++;
    return true;
  }

  private setupCommands(): void {
    // Start command
    this.bot.command('start', async (ctx) => {
      const welcomeMessage = `
🤖 *Welcome to Crypto Alert Bot!*

I help you monitor cryptocurrency price drops and send alerts when your thresholds are triggered.

*Available Commands:*
/help - Show this help message
/alerts - View your active alerts
/create - Create a new price alert
/prices - Check current crypto prices
/popular - Show popular cryptocurrencies

*Quick Start:*
1. Use /create to set up your first alert
2. Choose a cryptocurrency
3. Set your drop threshold (e.g., 5%)
4. Set your timeframe (e.g., 60 minutes)

Let's get started! 🚀
      `;

      await ctx.reply(welcomeMessage, { parse_mode: 'Markdown' });
    });

    // Help command
    this.bot.command('help', async (ctx) => {
      const helpMessage = `
📚 *Crypto Alert Bot Help*

*Commands:*
/start - Get started with the bot
/alerts - View and manage your alerts
/create - Create a new price drop alert
/prices [crypto] - Check current prices
/popular - Popular cryptocurrencies
/cancel - Cancel current operation

*Creating Alerts:*
1. Use /create command
2. Enter cryptocurrency (e.g., "bitcoin" or "BTC")
3. Set drop threshold (1-100%)
4. Set timeframe (5-1440 minutes)

*Alert Examples:*
• Alert when Bitcoin drops 5% in 1 hour
• Alert when Ethereum drops 10% in 24 hours

*Supported Timeframes:*
• 5 minutes to 24 hours (1440 minutes)
• Common: 15min, 30min, 1h, 4h, 24h

*Tips:*
• Use specific crypto names or symbols
• Set reasonable thresholds (2-20%)
• Check /popular for supported coins
      `;

      await ctx.reply(helpMessage, { parse_mode: 'Markdown' });
    });

    // Alerts management
    this.bot.command('alerts', async (ctx) => {
      await this.handleAlertsCommand(ctx);
    });

    // Create alert
    this.bot.command('create', async (ctx) => {
      await this.handleCreateAlertCommand(ctx);
    });

    // Check prices
    this.bot.command('prices', async (ctx) => {
      await this.handlePricesCommand(ctx);
    });

    // Popular cryptocurrencies
    this.bot.command('popular', async (ctx) => {
      await this.handlePopularCommand(ctx);
    });

    // Cancel operation
    this.bot.command('cancel', async (ctx) => {
      ctx.session.awaitingAlertConfig = undefined;
      ctx.session.awaitingUpdateConfig = undefined;
      await ctx.reply('❌ Operation cancelled.');
    });

    // Handle text messages (for alert configuration)
    this.bot.on('message:text', async (ctx) => {
      await this.handleTextMessage(ctx);
    });
  }

  private setupCallbacks(): void {
    // Handle inline keyboard callbacks
    this.bot.on('callback_query:data', async (ctx) => {
      const data = ctx.callbackQuery.data;
      
      if (data.startsWith('delete_alert_')) {
        const alertId = parseInt(data.replace('delete_alert_', ''));
        await this.handleDeleteAlert(ctx, alertId);
      } else if (data.startsWith('toggle_alert_')) {
        const alertId = parseInt(data.replace('toggle_alert_', ''));
        await this.handleToggleAlert(ctx, alertId);
      } else if (data.startsWith('update_alert_')) {
        const alertId = parseInt(data.replace('update_alert_', ''));
        await this.handleUpdateAlert(ctx, alertId);
      } else if (data.startsWith('price_')) {
        const cryptoId = data.replace('price_', '');
        await this.handlePriceQuery(ctx, cryptoId);
      }

      await ctx.answerCallbackQuery();
    });
  }

  private async handleAlertsCommand(ctx: BotContext): Promise<void> {
    try {
      const user = await this.dbService.getUserByTelegramId(ctx.from!.id);
      if (!user) return;

      const alerts = await this.dbService.getAlertsByUserId(user.id);

      if (alerts.length === 0) {
        await ctx.reply(
          '📝 You have no alerts configured.\n\nUse /create to set up your first alert!',
          { parse_mode: 'Markdown' }
        );
        return;
      }

      let message = '📊 *Your Price Alerts:*\n\n';
      
      for (const alert of alerts) {
        const coinInfo = await this.cryptoService.getCoinInfo(alert.cryptoId);
        const coinName = coinInfo ? `${coinInfo.name} (${coinInfo.symbol.toUpperCase()})` : alert.cryptoId;
        const status = alert.isActive ? '🟢 Active' : '🔴 Inactive';
        const timeframe = this.formatTimeframe(alert.timeframeMinutes);

        message += `${status} *${coinName}*\n`;
        message += `📉 Threshold: ${alert.thresholdPercentage}%\n`;
        message += `⏱ Timeframe: ${timeframe}\n`;
        message += `🆔 ID: ${alert.id}\n\n`;
      }

      const keyboard = new InlineKeyboard();
      for (const alert of alerts.slice(0, 10)) { // Limit to 10 alerts to avoid message size limits
        const coinInfo = await this.cryptoService.getCoinInfo(alert.cryptoId);
        const coinSymbol = coinInfo?.symbol.toUpperCase() || alert.cryptoId;
        
        keyboard
          .text(`🔧 ${coinSymbol}`, `update_alert_${alert.id}`)
          .text(alert.isActive ? '⏸' : '▶️', `toggle_alert_${alert.id}`)
          .text('🗑', `delete_alert_${alert.id}`)
          .row();
      }

      await ctx.reply(message, { 
        parse_mode: 'Markdown',
        reply_markup: keyboard 
      });
    } catch (error) {
      logger.error('Error handling alerts command:', error);
      await ctx.reply('❌ Error retrieving alerts. Please try again.');
    }
  }

  private async handleCreateAlertCommand(ctx: BotContext): Promise<void> {
    ctx.session.awaitingAlertConfig = { step: 'crypto' };
    
    const message = `
🆕 *Create New Alert*

Let's set up a price drop alert! 

📱 *Step 1/3: Choose Cryptocurrency*

Enter the cryptocurrency name or symbol:
• Examples: "bitcoin", "BTC", "ethereum", "ETH"
• Use /popular to see popular options
• Use /cancel to abort
    `;

    await ctx.reply(message, { parse_mode: 'Markdown' });
  }

  private async handlePricesCommand(ctx: BotContext): Promise<void> {
    const args = ctx.message?.text?.split(' ').slice(1);
    
    if (!args || args.length === 0) {
      // Show popular crypto prices
      const popularCoins = ['bitcoin', 'ethereum', 'binancecoin', 'cardano', 'solana'];
      await this.showPrices(ctx, popularCoins);
    } else {
      // Search for specific crypto
      const query = args.join(' ');
      const coin = await this.cryptoService.findCoinBySymbol(query);
      
      if (!coin) {
        await ctx.reply(`❌ Cryptocurrency "${query}" not found. Use /popular to see available options.`);
        return;
      }
      
      await this.showPrices(ctx, [coin.id]);
    }
  }

  private async handlePopularCommand(ctx: BotContext): Promise<void> {
    const popularCoins = [
      'bitcoin', 'ethereum', 'binancecoin', 'cardano', 'solana',
      'polkadot', 'avalanche-2', 'chainlink', 'polygon', 'litecoin'
    ];

    let message = '🔥 *Popular Cryptocurrencies:*\n\n';
    
    try {
      const prices = await this.cryptoService.getCurrentPrices(popularCoins);
      const keyboard = new InlineKeyboard();

      for (const coinId of popularCoins) {
        const coinInfo = await this.cryptoService.getCoinInfo(coinId);
        const price = prices.get(coinId);
        
        if (coinInfo && price) {
          const formattedPrice = price.toLocaleString('en-US', { 
            style: 'currency', 
            currency: 'USD' 
          });
          
          message += `💰 *${coinInfo.name}* (${coinInfo.symbol.toUpperCase()})\n`;
          message += `💵 ${formattedPrice}\n\n`;
          
          keyboard.text(
            `📈 ${coinInfo.symbol.toUpperCase()}`, 
            `price_${coinId}`
          ).row();
        }
      }

      await ctx.reply(message, { 
        parse_mode: 'Markdown',
        reply_markup: keyboard 
      });
    } catch (error) {
      logger.error('Error handling popular command:', error);
      await ctx.reply('❌ Error fetching popular cryptocurrencies. Please try again.');
    }
  }

  private async handleTextMessage(ctx: BotContext): Promise<void> {
    const text = ctx.message?.text;
    if (!text) return;

    // Handle alert configuration flow
    if (ctx.session.awaitingAlertConfig) {
      await this.handleAlertConfigFlow(ctx, text);
      return;
    }

    // Handle update configuration flow
    if (ctx.session.awaitingUpdateConfig) {
      await this.handleUpdateConfigFlow(ctx, text);
      return;
    }

    // Default response for unrecognized text
    await ctx.reply(
      '🤔 I didn\'t understand that command.\n\nUse /help to see available commands.',
      { parse_mode: 'Markdown' }
    );
  }

  private async handleAlertConfigFlow(ctx: BotContext, text: string): Promise<void> {
    const config = ctx.session.awaitingAlertConfig!;

    try {
      switch (config.step) {
        case 'crypto':
          const coin = await this.cryptoService.findCoinBySymbol(text);
          if (!coin) {
            await ctx.reply(
              `❌ Cryptocurrency "${text}" not found.\n\nPlease try again with a different name or symbol.\nUse /popular to see available options.`
            );
            return;
          }

          config.crypto = coin.id;
          config.step = 'threshold';
          
          await ctx.reply(
            `✅ Selected: *${coin.name}* (${coin.symbol.toUpperCase()})\n\n` +
            `📉 *Step 2/3: Set Drop Threshold*\n\n` +
            `Enter the percentage drop that should trigger an alert (1-100):\n` +
            `• Example: "5" for 5% drop\n` +
            `• Example: "10.5" for 10.5% drop`,
            { parse_mode: 'Markdown' }
          );
          break;

        case 'threshold':
          const threshold = parseFloat(text);
          if (isNaN(threshold) || threshold < 0.1 || threshold > 100) {
            await ctx.reply(
              '❌ Invalid threshold. Please enter a number between 0.1 and 100.\n\nExample: "5" for 5%'
            );
            return;
          }

          config.threshold = threshold;
          config.step = 'timeframe';
          
          await ctx.reply(
            `✅ Threshold set to ${threshold}%\n\n` +
            `⏱ *Step 3/3: Set Timeframe*\n\n` +
            `Enter the timeframe in minutes (5-1440):\n` +
            `• 15 = 15 minutes\n` +
            `• 60 = 1 hour\n` +
            `• 240 = 4 hours\n` +
            `• 1440 = 24 hours`,
            { parse_mode: 'Markdown' }
          );
          break;

        case 'timeframe':
          const timeframe = parseInt(text);
          if (isNaN(timeframe) || timeframe < 5 || timeframe > 1440) {
            await ctx.reply(
              '❌ Invalid timeframe. Please enter a number between 5 and 1440 minutes.\n\n' +
              'Examples: 15, 60, 240, 1440'
            );
            return;
          }

          // Create the alert
          await this.createAlert(ctx, config.crypto!, config.threshold!, timeframe);
          ctx.session.awaitingAlertConfig = undefined;
          break;
      }
    } catch (error) {
      logger.error('Error in alert config flow:', error);
      await ctx.reply('❌ An error occurred. Please try again with /create.');
      ctx.session.awaitingAlertConfig = undefined;
    }
  }

  private async createAlert(ctx: BotContext, cryptoId: string, threshold: number, timeframe: number): Promise<void> {
    try {
      const user = await this.dbService.getUserByTelegramId(ctx.from!.id);
      if (!user) return;

      const alert = await this.dbService.createAlert({
        userId: user.id,
        cryptoId,
        thresholdPercentage: threshold,
        timeframeMinutes: timeframe,
        isActive: true,
      });

      const coinInfo = await this.cryptoService.getCoinInfo(cryptoId);
      const coinName = coinInfo ? `${coinInfo.name} (${coinInfo.symbol.toUpperCase()})` : cryptoId;
      const timeframeFormatted = this.formatTimeframe(timeframe);

      await ctx.reply(
        `✅ *Alert Created Successfully!*\n\n` +
        `📱 *${coinName}*\n` +
        `📉 Drop Threshold: ${threshold}%\n` +
        `⏱ Timeframe: ${timeframeFormatted}\n` +
        `🆔 Alert ID: ${alert.id}\n\n` +
        `🔔 You'll be notified when ${coinName} drops ${threshold}% or more within ${timeframeFormatted}.`,
        { parse_mode: 'Markdown' }
      );
    } catch (error) {
      logger.error('Error creating alert:', error);
      await ctx.reply('❌ Error creating alert. Please try again.');
    }
  }

  private async showPrices(ctx: BotContext, cryptoIds: string[]): Promise<void> {
    try {
      const prices = await this.cryptoService.getCurrentPrices(cryptoIds);
      
      if (prices.size === 0) {
        await ctx.reply('❌ No prices available at the moment. Please try again later.');
        return;
      }

      let message = '💰 *Current Prices:*\n\n';
      
      for (const [cryptoId, price] of prices.entries()) {
        const coinInfo = await this.cryptoService.getCoinInfo(cryptoId);
        const coinName = coinInfo ? `${coinInfo.name} (${coinInfo.symbol.toUpperCase()})` : cryptoId;
        const formattedPrice = price.toLocaleString('en-US', { 
          style: 'currency', 
          currency: 'USD' 
        });
        
        message += `📈 *${coinName}*\n💵 ${formattedPrice}\n\n`;
      }

      message += `🕐 *Updated:* ${new Date().toLocaleString()}`;

      await ctx.reply(message, { parse_mode: 'Markdown' });
    } catch (error) {
      logger.error('Error showing prices:', error);
      await ctx.reply('❌ Error fetching prices. Please try again.');
    }
  }

  private formatTimeframe(minutes: number): string {
    if (minutes < 60) {
      return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
    } else if (minutes < 1440) {
      const hours = Math.floor(minutes / 60);
      return `${hours} hour${hours !== 1 ? 's' : ''}`;
    } else {
      const days = Math.floor(minutes / 1440);
      return `${days} day${days !== 1 ? 's' : ''}`;
    }
  }

  // Placeholder methods for callback handlers
  private async handleDeleteAlert(ctx: BotContext, alertId: number): Promise<void> {
    try {
      await this.dbService.deleteAlert(alertId);
      await ctx.editMessageText('✅ Alert deleted successfully.');
    } catch (error) {
      logger.error('Error deleting alert:', error);
      await ctx.editMessageText('❌ Error deleting alert.');
    }
  }

  private async handleToggleAlert(ctx: BotContext, alertId: number): Promise<void> {
    try {
      const alerts = await this.dbService.getAllActiveAlerts();
      const alert = alerts.find(a => a.id === alertId);
      
      if (alert) {
        await this.dbService.updateAlert(alertId, { isActive: !alert.isActive });
        const status = alert.isActive ? 'deactivated' : 'activated';
        await ctx.editMessageText(`✅ Alert ${status} successfully.`);
      }
    } catch (error) {
      logger.error('Error toggling alert:', error);
      await ctx.editMessageText('❌ Error updating alert.');
    }
  }

  private async handleUpdateAlert(ctx: BotContext, alertId: number): Promise<void> {
    // Placeholder for update alert functionality
    await ctx.editMessageText('🚧 Update functionality coming soon!');
  }

  private async handleUpdateConfigFlow(ctx: BotContext, text: string): Promise<void> {
    // Placeholder for update config flow
    await ctx.reply('🚧 Update functionality coming soon!');
  }

  private async handlePriceQuery(ctx: BotContext, cryptoId: string): Promise<void> {
    await this.showPrices(ctx, [cryptoId]);
  }

  getBot(): Bot<BotContext> {
    return this.bot;
  }

  async start(): Promise<void> {
    logger.info('Starting Telegram bot...');
    await this.bot.start();
  }

  async stop(): Promise<void> {
    logger.info('Stopping Telegram bot...');
    await this.bot.stop();
  }
}
