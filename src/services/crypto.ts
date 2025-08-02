import axios, { AxiosInstance } from 'axios';
import { config } from '../config';
import { logger } from '../utils/logger';
import { 
  ICryptoService, 
  CoinGeckoCoin, 
  CoinGeckoSimplePriceResponse,
  CoinGeckoSimplePriceSchema 
} from '../types';

export class CryptoService implements ICryptoService {
  private client: AxiosInstance;
  private coinsCache: CoinGeckoCoin[] = [];
  private cacheExpiry: Date = new Date(0);

  constructor() {
    this.client = axios.create({
      baseURL: config.COINGECKO_API_URL,
      timeout: 10000,
      headers: {
        'User-Agent': 'telegram-crypto-alert-bot/1.0.0',
      },
    });

    // Add request/response interceptors for logging and error handling
    this.client.interceptors.request.use(
      (config) => {
        logger.debug(`Making API request to: ${config.url}`);
        return config;
      },
      (error) => {
        logger.error('API request error:', error);
        return Promise.reject(error);
      }
    );

    this.client.interceptors.response.use(
      (response) => {
        logger.debug(`API response from ${response.config.url}: ${response.status}`);
        return response;
      },
      (error) => {
        logger.error(`API error from ${error.config?.url}:`, {
          status: error.response?.status,
          message: error.message,
          data: error.response?.data,
        });
        return Promise.reject(error);
      }
    );
  }

  async getSupportedCoins(): Promise<CoinGeckoCoin[]> {
    // Return cached data if still valid (cache for 1 hour)
    if (this.coinsCache.length > 0 && new Date() < this.cacheExpiry) {
      return this.coinsCache;
    }

    try {
      logger.info('Fetching supported coins from CoinGecko...');
      const response = await this.client.get<CoinGeckoCoin[]>('/coins/list');
      
      this.coinsCache = response.data;
      this.cacheExpiry = new Date(Date.now() + 60 * 60 * 1000); // Cache for 1 hour
      
      logger.info(`Fetched ${this.coinsCache.length} supported coins`);
      return this.coinsCache;
    } catch (error) {
      logger.error('Failed to fetch supported coins:', error);
      throw new Error('Failed to fetch supported cryptocurrencies');
    }
  }

  async getCurrentPrices(coinIds: string[]): Promise<Map<string, number>> {
    if (coinIds.length === 0) {
      return new Map();
    }

    try {
      const idsParam = coinIds.join(',');
      logger.debug(`Fetching current prices for: ${idsParam}`);
      
      const response = await this.client.get('/simple/price', {
        params: {
          ids: idsParam,
          vs_currencies: 'usd',
          include_last_updated_at: 'true',
        },
      });

      // Validate response structure
      const priceData = CoinGeckoSimplePriceSchema.parse(response.data);
      
      const priceMap = new Map<string, number>();
      for (const [coinId, data] of Object.entries(priceData)) {
        priceMap.set(coinId, data.usd);
      }

      logger.debug(`Successfully fetched prices for ${priceMap.size} coins`);
      return priceMap;
    } catch (error) {
      logger.error('Failed to fetch current prices:', error);
      throw new Error('Failed to fetch current cryptocurrency prices');
    }
  }

  async findCoinBySymbol(symbol: string): Promise<CoinGeckoCoin | null> {
    const coins = await this.getSupportedCoins();
    const normalizedSymbol = symbol.toLowerCase();
    
    // First try exact symbol match
    let coin = coins.find(c => c.symbol.toLowerCase() === normalizedSymbol);
    
    // If not found, try partial name match
    if (!coin) {
      coin = coins.find(c => 
        c.name.toLowerCase().includes(normalizedSymbol) ||
        c.id.toLowerCase().includes(normalizedSymbol)
      );
    }

    return coin || null;
  }

  async getCoinInfo(coinId: string): Promise<CoinGeckoCoin | null> {
    const coins = await this.getSupportedCoins();
    return coins.find(c => c.id === coinId) || null;
  }

  async getPrice(coinId: string): Promise<number | null> {
    const priceMap = await this.getCurrentPrices([coinId]);
    return priceMap.get(coinId) || null;
  }

  // Get popular cryptocurrencies for quick access
  getPopularCoins(): CoinGeckoCoin[] {
    const popularIds = [
      'bitcoin',
      'ethereum',
      'binancecoin',
      'cardano',
      'solana',
      'polkadot',
      'avalanche-2',
      'chainlink',
      'polygon',
      'litecoin',
    ];

    return this.coinsCache.filter(coin => popularIds.includes(coin.id));
  }
}
