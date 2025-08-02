import { CryptoService } from '../services/crypto';
import { DatabaseService } from '../services/database';

describe('CryptoService', () => {
  let cryptoService: CryptoService;

  beforeEach(() => {
    cryptoService = new CryptoService();
  });

  test('should find Bitcoin by symbol', async () => {
    const coin = await cryptoService.findCoinBySymbol('btc');
    expect(coin).toBeTruthy();
    expect(coin?.symbol.toLowerCase()).toBe('btc');
    expect(coin?.id).toBe('bitcoin');
  });

  test('should get current prices', async () => {
    const prices = await cryptoService.getCurrentPrices(['bitcoin', 'ethereum']);
    expect(prices.size).toBeGreaterThan(0);
    expect(prices.has('bitcoin')).toBe(true);
  });
});

describe('DatabaseService', () => {
  let dbService: DatabaseService;

  beforeEach(() => {
    // Use in-memory database for testing
    process.env.DATABASE_PATH = ':memory:';
    dbService = new DatabaseService();
  });

  afterEach(() => {
    dbService.close();
  });

  test('should create and retrieve user', async () => {
    const user = await dbService.createUser(123456, 'testuser');
    expect(user.telegramId).toBe(123456);
    expect(user.username).toBe('testuser');

    const retrievedUser = await dbService.getUserByTelegramId(123456);
    expect(retrievedUser).toBeTruthy();
    expect(retrievedUser?.telegramId).toBe(123456);
  });

  test('should create and retrieve alert', async () => {
    const user = await dbService.createUser(123456, 'testuser');
    
    const alert = await dbService.createAlert({
      userId: user.id,
      cryptoId: 'bitcoin',
      thresholdPercentage: 5.0,
      timeframeMinutes: 60,
      isActive: true,
    });

    expect(alert.userId).toBe(user.id);
    expect(alert.cryptoId).toBe('bitcoin');
    expect(alert.thresholdPercentage).toBe(5.0);

    const alerts = await dbService.getAlertsByUserId(user.id);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]?.id).toBe(alert.id);
  });
});
