import winston from 'winston';
import path from 'path';
import fs from 'fs';
import { config } from '../config';

// Ensure logs directory exists
const logDir = path.dirname(config.LOG_FILE);
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const logger = winston.createLogger({
  level: config.LOG_LEVEL,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'telegram-crypto-bot' },
  transports: [
    new winston.transports.File({ 
      filename: config.LOG_FILE.replace('.log', '-error.log'), 
      level: 'error' 
    }),
    new winston.transports.File({ 
      filename: config.LOG_FILE 
    })
  ],
});

// Add console transport in development
if (config.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

export { logger };
