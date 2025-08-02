import * as cron from 'node-cron';
import { config } from './config';
import { logger } from './utils/logger';
import { DatabaseService } from './services/database';
import { CryptoService } from './services/crypto';
import { AlertService } from './services/alert';
import { TelegramBotService } from './services/telegram';

class CryptoAlertBot {
  private dbService: DatabaseService;
  private cryptoService: CryptoService;
  private alertService: AlertService;
  private telegramService: TelegramBotService;
  private cronJob?: cron.ScheduledTask;

  constructor() {
    this.dbService = new DatabaseService();
    this.cryptoService = new CryptoService();
    this.telegramService = new TelegramBotService(this.dbService, this.cryptoService);
    this.alertService = new AlertService(
      this.telegramService.getBot() as any,
      this.dbService,
      this.cryptoService
    );
  }

  async start(): Promise<void> {
    try {
      logger.info('Starting Crypto Alert Bot...');

      // Start the Telegram bot
      await this.telegramService.start();
      logger.info('Telegram bot started successfully');

      // Start the price monitoring cron job
      this.startPriceMonitoring();

      // Handle graceful shutdown
      this.setupGracefulShutdown();

      logger.info('Crypto Alert Bot is running!');
    } catch (error) {
      logger.error('Failed to start bot:', error);
      process.exit(1);
    }
  }

  private startPriceMonitoring(): void {
    const cronExpression = `*/${config.PRICE_CHECK_INTERVAL_MINUTES} * * * *`;
    
    logger.info(`Setting up price monitoring with interval: ${config.PRICE_CHECK_INTERVAL_MINUTES} minutes`);
    
    this.cronJob = cron.schedule(cronExpression, async () => {
      try {
        await this.alertService.checkPriceChanges();
      } catch (error) {
        logger.error('Error in price monitoring job:', error);
      }
    }, {
      scheduled: true,
      timezone: 'UTC'
    });

    logger.info('Price monitoring cron job started');
  }

  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string): Promise<void> => {
      logger.info(`Received ${signal}, shutting down gracefully...`);

      try {
        // Stop the cron job
        if (this.cronJob) {
          this.cronJob.stop();
          logger.info('Cron job stopped');
        }

        // Stop the Telegram bot
        await this.telegramService.stop();
        logger.info('Telegram bot stopped');

        // Close database connection
        this.dbService.close();
        logger.info('Database connection closed');

        logger.info('Graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        logger.error('Error during shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception:', error);
      shutdown('uncaughtException');
    });
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled rejection at:', promise, 'reason:', reason);
      shutdown('unhandledRejection');
    });
  }

  // Health check endpoint for monitoring
  getHealthStatus(): { status: string; uptime: number; timestamp: string } {
    return {
      status: 'healthy',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }
}

// Initialize and start the bot
if (require.main === module) {
  const bot = new CryptoAlertBot();
  bot.start().catch((error) => {
    logger.error('Failed to start application:', error);
    process.exit(1);
  });
}

export { CryptoAlertBot };
