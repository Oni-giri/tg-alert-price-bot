import { DatabaseService } from '../services/database';
import { CryptoService } from '../services/crypto';
import { logger } from '../utils/logger';

async function seedDatabase(): Promise<void> {
  logger.info('Seeding database with initial data...');
  
  const dbService = new DatabaseService();
  const cryptoService = new CryptoService();
  
  try {
    // Fetch and cache popular cryptocurrencies
    logger.info('Fetching supported cryptocurrencies...');
    const coins = await cryptoService.getSupportedCoins();
    logger.info(`Cached ${coins.length} cryptocurrencies`);
    
    // Add any initial data seeding logic here
    // For example, creating test users or default alerts
    
    logger.info('Database seeding completed successfully');
  } catch (error) {
    logger.error('Database seeding failed:', error);
    throw error;
  } finally {
    dbService.close();
  }
}

if (require.main === module) {
  seedDatabase().catch((error) => {
    logger.error('Seeding failed:', error);
    process.exit(1);
  });
}
