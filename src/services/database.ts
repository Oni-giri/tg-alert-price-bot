import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { config } from '../config';
import { logger } from '../utils/logger';
import { 
  IDatabaseService, 
  User, 
  AlertConfig, 
  PriceHistory, 
  AlertLog 
} from '../types';

export class DatabaseService implements IDatabaseService {
  private db: Database.Database;

  constructor() {
    // Ensure database directory exists
    const dbDir = path.dirname(config.DATABASE_PATH);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    this.db = new Database(config.DATABASE_PATH);
    this.db.pragma('journal_mode = WAL');
    this.initializeTables();
  }

  private initializeTables(): void {
    logger.info('Initializing database tables...');

    // Users table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        telegram_id INTEGER UNIQUE NOT NULL,
        username TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Cryptocurrencies table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS cryptocurrencies (
        id TEXT PRIMARY KEY,
        symbol TEXT NOT NULL,
        name TEXT NOT NULL,
        current_price REAL,
        last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Alert configurations table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS alert_configs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        crypto_id TEXT NOT NULL,
        threshold_percentage REAL NOT NULL,
        timeframe_minutes INTEGER NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        FOREIGN KEY (crypto_id) REFERENCES cryptocurrencies (id)
      )
    `);

    // Price history table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS price_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        crypto_id TEXT NOT NULL,
        price REAL NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (crypto_id) REFERENCES cryptocurrencies (id)
      )
    `);

    // Alert logs table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS alert_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        alert_config_id INTEGER NOT NULL,
        triggered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        price_change REAL NOT NULL,
        old_price REAL NOT NULL,
        new_price REAL NOT NULL,
        sent BOOLEAN DEFAULT FALSE,
        FOREIGN KEY (alert_config_id) REFERENCES alert_configs (id) ON DELETE CASCADE
      )
    `);

    // Create indexes for better performance
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users (telegram_id);
      CREATE INDEX IF NOT EXISTS idx_alert_configs_user_id ON alert_configs (user_id);
      CREATE INDEX IF NOT EXISTS idx_alert_configs_active ON alert_configs (is_active);
      CREATE INDEX IF NOT EXISTS idx_price_history_crypto_timestamp ON price_history (crypto_id, timestamp);
      CREATE INDEX IF NOT EXISTS idx_alert_logs_config_id ON alert_logs (alert_config_id);
    `);

    logger.info('Database tables initialized successfully');
  }

  // User operations
  async createUser(telegramId: number, username?: string): Promise<User> {
    const stmt = this.db.prepare(`
      INSERT INTO users (telegram_id, username)
      VALUES (?, ?)
      RETURNING *
    `);
    
    const result = stmt.get(telegramId, username) as any;
    return this.mapRowToUser(result);
  }

  async getUserByTelegramId(telegramId: number): Promise<User | null> {
    const stmt = this.db.prepare(`
      SELECT * FROM users WHERE telegram_id = ?
    `);
    
    const result = stmt.get(telegramId) as any;
    return result ? this.mapRowToUser(result) : null;
  }

  async updateUser(id: number, updates: Partial<User>): Promise<void> {
    const fields = Object.keys(updates).filter(key => key !== 'id');
    if (fields.length === 0) return;

    const setClause = fields.map(field => `${this.camelToSnake(field)} = ?`).join(', ');
    const values = fields.map(field => updates[field as keyof User]);

    const stmt = this.db.prepare(`
      UPDATE users 
      SET ${setClause}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    
    stmt.run(...values, id);
  }

  // Alert operations
  async createAlert(alert: Omit<AlertConfig, 'id' | 'createdAt' | 'updatedAt'>): Promise<AlertConfig> {
    const stmt = this.db.prepare(`
      INSERT INTO alert_configs (user_id, crypto_id, threshold_percentage, timeframe_minutes, is_active)
      VALUES (?, ?, ?, ?, ?)
      RETURNING *
    `);
    
    const result = stmt.get(
      alert.userId,
      alert.cryptoId,
      alert.thresholdPercentage,
      alert.timeframeMinutes,
      alert.isActive
    ) as any;
    
    return this.mapRowToAlertConfig(result);
  }

  async getAlertsByUserId(userId: number): Promise<AlertConfig[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM alert_configs WHERE user_id = ? ORDER BY created_at DESC
    `);
    
    const results = stmt.all(userId) as any[];
    return results.map(row => this.mapRowToAlertConfig(row));
  }

  async updateAlert(id: number, updates: Partial<AlertConfig>): Promise<void> {
    const fields = Object.keys(updates).filter(key => !['id', 'createdAt', 'updatedAt'].includes(key));
    if (fields.length === 0) return;

    const setClause = fields.map(field => `${this.camelToSnake(field)} = ?`).join(', ');
    const values = fields.map(field => updates[field as keyof AlertConfig]);

    const stmt = this.db.prepare(`
      UPDATE alert_configs 
      SET ${setClause}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    
    stmt.run(...values, id);
  }

  async deleteAlert(id: number): Promise<void> {
    const stmt = this.db.prepare(`DELETE FROM alert_configs WHERE id = ?`);
    stmt.run(id);
  }

  async getAllActiveAlerts(): Promise<AlertConfig[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM alert_configs WHERE is_active = TRUE
    `);
    
    const results = stmt.all() as any[];
    return results.map(row => this.mapRowToAlertConfig(row));
  }

  // Price history operations
  async savePriceHistory(cryptoId: string, price: number): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO price_history (crypto_id, price)
      VALUES (?, ?)
    `);
    
    stmt.run(cryptoId, price);
  }

  async getPriceHistory(cryptoId: string, timeframeMinutes: number): Promise<PriceHistory[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM price_history 
      WHERE crypto_id = ? AND timestamp >= datetime('now', '-${timeframeMinutes} minutes')
      ORDER BY timestamp DESC
    `);
    
    const results = stmt.all(cryptoId) as any[];
    return results.map(row => this.mapRowToPriceHistory(row));
  }

  // Alert log operations
  async createAlertLog(log: Omit<AlertLog, 'id'>): Promise<AlertLog> {
    const stmt = this.db.prepare(`
      INSERT INTO alert_logs (alert_config_id, triggered_at, price_change, old_price, new_price, sent)
      VALUES (?, ?, ?, ?, ?, ?)
      RETURNING *
    `);
    
    const result = stmt.get(
      log.alertConfigId,
      log.triggeredAt.toISOString(),
      log.priceChange,
      log.oldPrice,
      log.newPrice,
      log.sent
    ) as any;
    
    return this.mapRowToAlertLog(result);
  }

  async getRecentAlertLogs(alertConfigId: number, minutes: number): Promise<AlertLog[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM alert_logs 
      WHERE alert_config_id = ? AND triggered_at >= datetime('now', '-${minutes} minutes')
      ORDER BY triggered_at DESC
    `);
    
    const results = stmt.all(alertConfigId) as any[];
    return results.map(row => this.mapRowToAlertLog(row));
  }

  // Helper methods for mapping database rows to typed objects
  private mapRowToUser(row: any): User {
    return {
      id: row.id,
      telegramId: row.telegram_id,
      username: row.username,
      isActive: Boolean(row.is_active),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  private mapRowToAlertConfig(row: any): AlertConfig {
    return {
      id: row.id,
      userId: row.user_id,
      cryptoId: row.crypto_id,
      thresholdPercentage: row.threshold_percentage,
      timeframeMinutes: row.timeframe_minutes,
      isActive: Boolean(row.is_active),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  private mapRowToPriceHistory(row: any): PriceHistory {
    return {
      id: row.id,
      cryptoId: row.crypto_id,
      price: row.price,
      timestamp: new Date(row.timestamp),
    };
  }

  private mapRowToAlertLog(row: any): AlertLog {
    return {
      id: row.id,
      alertConfigId: row.alert_config_id,
      triggeredAt: new Date(row.triggered_at),
      priceChange: row.price_change,
      oldPrice: row.old_price,
      newPrice: row.new_price,
      sent: Boolean(row.sent),
    };
  }

  private camelToSnake(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }

  close(): void {
    this.db.close();
  }
}
