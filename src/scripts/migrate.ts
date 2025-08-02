import { DatabaseService } from '../services/database';
import { logger } from '../utils/logger';

async function runMigrations(): Promise<void> {
  logger.info('Running database migrations...');
  
  const dbService = new DatabaseService();
  
  // The database service already creates tables in the constructor
  // This script can be used for future migrations
  
  logger.info('Database migrations completed successfully');
  dbService.close();
}

if (require.main === module) {
  runMigrations().catch((error) => {
    logger.error('Migration failed:', error);
    process.exit(1);
  });
}
