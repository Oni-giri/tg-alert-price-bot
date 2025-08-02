# Crypto Alert Bot

A comprehensive TypeScript-based Telegram bot that monitors cryptocurrency prices and sends alerts when price drops exceed user-defined thresholds.

## Features

- 🔍 **Real-time Price Monitoring**: Tracks cryptocurrency prices using CoinGecko API
- 📉 **Customizable Alerts**: Set percentage drop thresholds and timeframes
- 💬 **Telegram Integration**: Full bot interface for configuration and management
- 🗄️ **Persistent Storage**: SQLite database for user preferences and alert history
- ⚡ **Performance Optimized**: Efficient API usage and database queries
- 🐳 **Docker Ready**: Easy deployment with Docker and Docker Compose

## Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Telegram Bot Token (from [@BotFather](https://t.me/BotFather))

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd telegram-crypto-alert-bot
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env and add your TELEGRAM_BOT_TOKEN
   ```

4. **Build and start**
   ```bash
   npm run build
   npm start
   ```

### Development

```bash
# Start in development mode with hot reload
npm run dev

# Run tests
npm test

# Lint code
npm run lint
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `TELEGRAM_BOT_TOKEN` | Your Telegram bot token | Required |
| `DATABASE_PATH` | SQLite database file path | `./data/crypto_bot.db` |
| `PRICE_CHECK_INTERVAL_MINUTES` | How often to check prices | `5` |
| `ALERT_COOLDOWN_MINUTES` | Cooldown between alerts | `30` |
| `LOG_LEVEL` | Logging level | `info` |
| `MAX_COMMANDS_PER_MINUTE` | Rate limit for commands | `10` |

### Supported Cryptocurrencies

The bot supports all cryptocurrencies available on CoinGecko (3000+). Popular ones include:

- Bitcoin (BTC)
- Ethereum (ETH) 
- Binance Coin (BNB)
- Cardano (ADA)
- Solana (SOL)
- And many more...

## Usage

### Bot Commands

- `/start` - Get started with the bot
- `/help` - Show help information
- `/alerts` - View and manage your alerts
- `/create` - Create a new price alert
- `/prices [crypto]` - Check current prices
- `/popular` - Show popular cryptocurrencies
- `/cancel` - Cancel current operation

### Creating Alerts

1. Use `/create` command
2. Enter cryptocurrency name or symbol
3. Set drop percentage threshold (e.g., 5%)
4. Set timeframe in minutes (e.g., 60 for 1 hour)

Example: Alert when Bitcoin drops 5% in 1 hour.

### Managing Alerts

Use `/alerts` to view all your alerts with options to:
- ⏸️ Pause/resume alerts
- 🗑️ Delete alerts
- 🔧 Update alert settings

## Docker Deployment

### Using Docker Compose (Recommended)

1. **Create environment file**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

2. **Start the service**
   ```bash
   docker-compose up -d
   ```

3. **View logs**
   ```bash
   docker-compose logs -f
   ```

### Using Docker

```bash
# Build image
docker build -t crypto-alert-bot .

# Run container
docker run -d \
  --name crypto-alert-bot \
  -e TELEGRAM_BOT_TOKEN="your_token_here" \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/logs:/app/logs \
  crypto-alert-bot
```

## Project Structure

```
src/
├── config/          # Configuration management
├── services/        # Core business logic
│   ├── database.ts  # Database operations
│   ├── crypto.ts    # Cryptocurrency API integration
│   ├── alert.ts     # Alert logic and monitoring
│   └── telegram.ts  # Telegram bot interface
├── types/           # TypeScript type definitions
├── utils/           # Utility functions and logging
└── index.ts         # Application entry point
```

## API Integration

### CoinGecko API

The bot uses CoinGecko's free API tier:
- Rate limit: 10-50 calls/minute
- 3000+ supported cryptocurrencies
- Real-time price data
- No API key required

### Telegram Bot API

Integration via Grammy framework:
- Webhook or polling support
- Rich message formatting
- Inline keyboards for interactions
- Session management

## Database Schema

### Tables

- **users**: User registration and settings
- **alert_configs**: User-defined alert configurations
- **price_history**: Historical price data for monitoring
- **alert_logs**: Log of triggered alerts

## Development

### Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm test -- --coverage
```

### Code Quality

```bash
# Lint TypeScript code
npm run lint

# Fix linting issues
npm run lint:fix

# Type checking
npx tsc --noEmit
```

## Monitoring

### Health Checks

The application includes health check endpoints and logging:

- Process uptime monitoring
- Database connection health
- API service availability
- Error rate tracking

### Logging

Structured logging with Winston:
- File-based logs in production
- Console output in development
- Error tracking and alerting
- Performance metrics

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- 📖 Check the [documentation](docs/)
- 🐛 Report bugs via [Issues](https://github.com/yourrepo/issues)
- 💬 Join our [Telegram channel](https://t.me/yourchannel)

## Roadmap

- [ ] Portfolio tracking
- [ ] Multiple exchange support
- [ ] Technical indicator alerts
- [ ] Web dashboard
- [ ] Mobile app notifications
- [ ] Advanced charting
