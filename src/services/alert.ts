import { Bot, Context } from 'grammy';
import { config } from '../config';
import { logger } from '../utils/logger';
import { 
  IAlertService, 
  IDatabaseService, 
  ICryptoService, 
  AlertConfig 
} from '../types';

export class AlertService implements IAlertService {
  constructor(
    private bot: Bot<Context>,
    private dbService: IDatabaseService,
    private cryptoService: ICryptoService
  ) {}

  async checkPriceChanges(): Promise<void> {
    logger.info('Starting price change check...');

    try {
      const activeAlerts = await this.dbService.getAllActiveAlerts();
      if (activeAlerts.length === 0) {
        logger.debug('No active alerts to check');
        return;
      }

      // Group alerts by crypto to minimize API calls
      const alertsByCrypto = new Map<string, AlertConfig[]>();
      for (const alert of activeAlerts) {
        if (!alertsByCrypto.has(alert.cryptoId)) {
          alertsByCrypto.set(alert.cryptoId, []);
        }
        alertsByCrypto.get(alert.cryptoId)!.push(alert);
      }

      const cryptoIds = Array.from(alertsByCrypto.keys());
      logger.debug(`Checking prices for ${cryptoIds.length} cryptocurrencies`);

      // Fetch current prices
      const currentPrices = await this.cryptoService.getCurrentPrices(cryptoIds);

      // Save price history for all monitored cryptos
      for (const [cryptoId, price] of currentPrices.entries()) {
        await this.dbService.savePriceHistory(cryptoId, price);
      }

      // Check each alert
      for (const [cryptoId, alerts] of alertsByCrypto.entries()) {
        const currentPrice = currentPrices.get(cryptoId);
        if (!currentPrice) {
          logger.warn(`No current price available for ${cryptoId}`);
          continue;
        }

        for (const alert of alerts) {
          try {
            if (await this.shouldTriggerAlert(alert, currentPrice)) {
              const priceHistory = await this.dbService.getPriceHistory(
                alert.cryptoId, 
                alert.timeframeMinutes
              );

              if (priceHistory.length > 0) {
                const oldPrice = priceHistory[priceHistory.length - 1]!.price;
                const priceChange = ((currentPrice - oldPrice) / oldPrice) * 100;

                await this.triggerAlert(alert, priceChange, oldPrice, currentPrice);
              }
            }
          } catch (error) {
            logger.error(`Error checking alert ${alert.id}:`, error);
          }
        }
      }

      logger.info('Price change check completed');
    } catch (error) {
      logger.error('Error during price change check:', error);
    }
  }

  async shouldTriggerAlert(alertConfig: AlertConfig, currentPrice: number): Promise<boolean> {
    try {
      // Check if alert is within cooldown period
      const recentLogs = await this.dbService.getRecentAlertLogs(
        alertConfig.id, 
        config.ALERT_COOLDOWN_MINUTES
      );

      if (recentLogs.length > 0) {
        logger.debug(`Alert ${alertConfig.id} is in cooldown period`);
        return false;
      }

      // Get price history for the specified timeframe
      const priceHistory = await this.dbService.getPriceHistory(
        alertConfig.cryptoId, 
        alertConfig.timeframeMinutes
      );

      if (priceHistory.length === 0) {
        logger.debug(`No price history available for ${alertConfig.cryptoId}`);
        return false;
      }

      // Calculate price change from the oldest price in the timeframe
      const oldestPrice = priceHistory[priceHistory.length - 1]!.price;
      const priceChangePercent = ((currentPrice - oldestPrice) / oldestPrice) * 100;

      // Check if price drop exceeds threshold (negative change)
      const shouldTrigger = priceChangePercent <= -alertConfig.thresholdPercentage;

      if (shouldTrigger) {
        logger.info(`Alert ${alertConfig.id} should trigger: ${priceChangePercent.toFixed(2)}% change`);
      }

      return shouldTrigger;
    } catch (error) {
      logger.error(`Error checking if alert should trigger:`, error);
      return false;
    }
  }

  async triggerAlert(
    alertConfig: AlertConfig, 
    priceChange: number, 
    oldPrice: number, 
    newPrice: number
  ): Promise<void> {
    try {
      logger.info(`Triggering alert ${alertConfig.id} for user ${alertConfig.userId}`);

      // Create alert log
      await this.dbService.createAlertLog({
        alertConfigId: alertConfig.id,
        triggeredAt: new Date(),
        priceChange,
        oldPrice,
        newPrice,
        sent: false,
      });

      // Get crypto info for the message
      const coinInfo = await this.cryptoService.getCoinInfo(alertConfig.cryptoId);
      const coinName = coinInfo ? `${coinInfo.name} (${coinInfo.symbol.toUpperCase()})` : alertConfig.cryptoId;

      // Get user info
      const user = await this.dbService.getUserByTelegramId(alertConfig.userId);
      if (!user) {
        logger.error(`User not found for alert ${alertConfig.id}`);
        return;
      }

      // Format alert message
      const message = this.formatAlertMessage(
        coinName,
        priceChange,
        oldPrice,
        newPrice,
        alertConfig.timeframeMinutes
      );

      // Send Telegram message
      try {
        await this.bot.api.sendMessage(user.telegramId, message, {
          parse_mode: 'Markdown',
        });

        // Update alert log to mark as sent
        const alertLogs = await this.dbService.getRecentAlertLogs(alertConfig.id, 5);
        if (alertLogs.length > 0) {
          // This would require an update method for alert logs
          // For now, we'll just log success
          logger.info(`Alert sent successfully to user ${user.telegramId}`);
        }
      } catch (telegramError) {
        logger.error(`Failed to send Telegram message:`, telegramError);
      }
    } catch (error) {
      logger.error(`Error triggering alert:`, error);
    }
  }

  private formatAlertMessage(
    coinName: string,
    priceChange: number,
    oldPrice: number,
    newPrice: number,
    timeframeMinutes: number
  ): string {
    const timeframe = this.formatTimeframe(timeframeMinutes);
    const priceChangeFormatted = priceChange.toFixed(2);
    const oldPriceFormatted = oldPrice.toLocaleString('en-US', { 
      style: 'currency', 
      currency: 'USD' 
    });
    const newPriceFormatted = newPrice.toLocaleString('en-US', { 
      style: 'currency', 
      currency: 'USD' 
    });

    return `🚨 *Price Alert*\n\n` +
           `📉 *${coinName}* has dropped *${Math.abs(Number(priceChangeFormatted))}%* in the last ${timeframe}\n\n` +
           `💰 Previous Price: ${oldPriceFormatted}\n` +
           `💸 Current Price: ${newPriceFormatted}\n` +
           `📊 Change: ${priceChangeFormatted}%\n\n` +
           `⏰ Alert triggered at ${new Date().toLocaleString()}`;
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

  // Method to manually check a specific alert (useful for testing)
  async checkSpecificAlert(alertId: number): Promise<boolean> {
    try {
      const alerts = await this.dbService.getAllActiveAlerts();
      const alert = alerts.find(a => a.id === alertId);
      
      if (!alert) {
        logger.warn(`Alert ${alertId} not found or not active`);
        return false;
      }

      const currentPrice = await this.cryptoService.getPrice(alert.cryptoId);
      if (!currentPrice) {
        logger.warn(`No current price available for ${alert.cryptoId}`);
        return false;
      }

      return await this.shouldTriggerAlert(alert, currentPrice);
    } catch (error) {
      logger.error(`Error checking specific alert ${alertId}:`, error);
      return false;
    }
  }
}
