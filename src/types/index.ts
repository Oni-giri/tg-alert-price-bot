import { z } from 'zod';

// Environment configuration schema
export const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  TELEGRAM_BOT_TOKEN: z.string().min(1),
  DATABASE_PATH: z.string().default('./data/crypto_bot.db'),
  COINGECKO_API_URL: z.string().url().default('https://api.coingecko.com/api/v3'),
  PRICE_CHECK_INTERVAL_MINUTES: z.coerce.number().min(1).default(5),
  ALERT_COOLDOWN_MINUTES: z.coerce.number().min(1).default(30),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  LOG_FILE: z.string().default('./logs/app.log'),
  MAX_COMMANDS_PER_MINUTE: z.coerce.number().min(1).default(10),
});

export type EnvConfig = z.infer<typeof EnvSchema>;

// User configuration
export const UserSchema = z.object({
  id: z.number(),
  telegramId: z.number(),
  username: z.string().optional(),
  isActive: z.boolean().default(true),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type User = z.infer<typeof UserSchema>;

// Cryptocurrency schema
export const CryptocurrencySchema = z.object({
  id: z.string(),
  symbol: z.string(),
  name: z.string(),
  currentPrice: z.number(),
  lastUpdated: z.date(),
});

export type Cryptocurrency = z.infer<typeof CryptocurrencySchema>;

// Alert configuration schema
export const AlertConfigSchema = z.object({
  id: z.number(),
  userId: z.number(),
  cryptoId: z.string(),
  thresholdPercentage: z.number().min(0.1).max(100),
  timeframeMinutes: z.number().min(5).max(1440), // 5 minutes to 24 hours
  isActive: z.boolean().default(true),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type AlertConfig = z.infer<typeof AlertConfigSchema>;

// Price history schema
export const PriceHistorySchema = z.object({
  id: z.number(),
  cryptoId: z.string(),
  price: z.number(),
  timestamp: z.date(),
});

export type PriceHistory = z.infer<typeof PriceHistorySchema>;

// Alert log schema
export const AlertLogSchema = z.object({
  id: z.number(),
  alertConfigId: z.number(),
  triggeredAt: z.date(),
  priceChange: z.number(),
  oldPrice: z.number(),
  newPrice: z.number(),
  sent: z.boolean().default(false),
});

export type AlertLog = z.infer<typeof AlertLogSchema>;

// Command input schemas
export const CreateAlertInputSchema = z.object({
  crypto: z.string().min(1),
  threshold: z.number().min(0.1).max(100),
  timeframe: z.number().min(5).max(1440),
});

export type CreateAlertInput = z.infer<typeof CreateAlertInputSchema>;

export const UpdateAlertInputSchema = z.object({
  alertId: z.number(),
  threshold: z.number().min(0.1).max(100).optional(),
  timeframe: z.number().min(5).max(1440).optional(),
  isActive: z.boolean().optional(),
});

export type UpdateAlertInput = z.infer<typeof UpdateAlertInputSchema>;

// API response schemas
export const CoinGeckoSimplePriceSchema = z.record(
  z.string(),
  z.object({
    usd: z.number(),
    last_updated_at: z.number(),
  })
);

export type CoinGeckoSimplePriceResponse = z.infer<typeof CoinGeckoSimplePriceSchema>;

export const CoinGeckoCoinSchema = z.object({
  id: z.string(),
  symbol: z.string(),
  name: z.string(),
});

export type CoinGeckoCoin = z.infer<typeof CoinGeckoCoinSchema>;

// Bot context type
export interface BotContext {
  user: User;
  commandsUsed: number;
  lastCommandTime: Date;
}

// Service interfaces
export interface ICryptoService {
  getSupportedCoins(): Promise<CoinGeckoCoin[]>;
  getCurrentPrices(coinIds: string[]): Promise<Map<string, number>>;
  findCoinBySymbol(symbol: string): Promise<CoinGeckoCoin | null>;
  getCoinInfo(coinId: string): Promise<CoinGeckoCoin | null>;
  getPrice(coinId: string): Promise<number | null>;
}

export interface IDatabaseService {
  // User operations
  createUser(telegramId: number, username?: string): Promise<User>;
  getUserByTelegramId(telegramId: number): Promise<User | null>;
  updateUser(id: number, updates: Partial<User>): Promise<void>;

  // Alert operations
  createAlert(alert: Omit<AlertConfig, 'id' | 'createdAt' | 'updatedAt'>): Promise<AlertConfig>;
  getAlertsByUserId(userId: number): Promise<AlertConfig[]>;
  updateAlert(id: number, updates: Partial<AlertConfig>): Promise<void>;
  deleteAlert(id: number): Promise<void>;
  getAllActiveAlerts(): Promise<AlertConfig[]>;

  // Price history operations
  savePriceHistory(cryptoId: string, price: number): Promise<void>;
  getPriceHistory(cryptoId: string, timeframeMinutes: number): Promise<PriceHistory[]>;

  // Alert log operations
  createAlertLog(log: Omit<AlertLog, 'id'>): Promise<AlertLog>;
  getRecentAlertLogs(alertConfigId: number, minutes: number): Promise<AlertLog[]>;
}

export interface IAlertService {
  checkPriceChanges(): Promise<void>;
  shouldTriggerAlert(alertConfig: AlertConfig, currentPrice: number): Promise<boolean>;
  triggerAlert(alertConfig: AlertConfig, priceChange: number, oldPrice: number, newPrice: number): Promise<void>;
}
