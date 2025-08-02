Create a comprehensive TypeScript-based Telegram bot that monitors cryptocurrency prices and sends alerts when price drops exceed user-defined thresholds. The bot should be fully configurable through the Telegram interface.

Project Requirements
Core Functionality:

Monitor cryptocurrency prices (BTC, ETH, and other major cryptocurrencies)
Send alerts when prices drop more than X% in Y timeframe
Full configuration through Telegram commands
Persistent storage of user preferences
Real-time price monitoring with configurable intervals
Technical Stack & Architecture
Languages & Runtime:

TypeScript (latest version)
Node.js (v18+ recommended)
Key Libraries:

APIs to Integrate:

CoinGecko API (free tier) for crypto prices
Telegram Bot API via Grammy framework
Alternative: CoinMarketCap API or Binance API
Architecture Design
Project Structure:

Core Features to Implement
1. Telegram Commands:

2. Database Schema:

3. Alert Logic:

Fetch current prices every 1-5 minutes
Compare against historical prices based on timeframe
Calculate percentage change
Trigger alerts if threshold exceeded
Implement cooldown period to prevent spam
Implementation Guidelines
1. Environment Configuration:

2. Error Handling:
Implement comprehensive try-catch blocks
Rate limit handling for API calls
Graceful degradation when APIs are down
User-friendly error messages
3. Performance Considerations:

Batch API calls when possible
Implement caching for frequently accessed data
Use connection pooling for database
Optimize database queries with proper indexing
4. Security Features:

Input validation using Zod schemas
SQL injection prevention
Rate limiting for bot commands
Optional user authentication/whitelist


1. Docker Configuration:

2. Monitoring:

Health check endpoints
Prometheus metrics
Log aggregation
Uptime monitoring
Sample Implementation Workflow

Setup Phase:

Initialize TypeScript project with proper tsconfig
Set up database schema and migrations
Configure logging and environment variables
Bot Foundation:

Implement basic Telegram bot with Grammy
Create command structure and middleware
Add user registration and basic commands
Crypto Integration:

Integrate CoinGecko API
Implement price fetching and storage
Create price change calculation logic
Alert System:

Build alert creation and management
Implement monitoring cron jobs
Create alert triggering mechanism
Testing & Polish:

Unit tests for core logic
Integration tests for API calls
Error handling and edge cases
Performance optimization
Code Quality Standards

- Use strict TypeScript configuration
- Implement comprehensive logging
- Follow SOLID principles
- Use dependency injection where appropriate
- Write unit tests (Jest recommended)
- Document API interfaces and complex logic