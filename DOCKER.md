# Docker Development Setup

This project includes Docker configurations for both development and production environments.

## Files Structure

- `.devcontainer/Dockerfile` - Development container with hot reload and dev tools
- `Dockerfile.prod` - Production-optimized container
- `docker-compose.dev.yml` - Development environment setup
- `docker-compose.yml` - Production environment setup

## Development Environment

### Quick Start

1. **Start development container:**
   ```bash
   docker-compose -f docker-compose.dev.yml up -d
   ```

2. **View logs:**
   ```bash
   docker-compose -f docker-compose.dev.yml logs -f
   ```

3. **Access container shell:**
   ```bash
   docker-compose -f docker-compose.dev.yml exec crypto-alert-bot-dev sh
   ```

4. **Run tests:**
   ```bash
   docker-compose -f docker-compose.dev.yml exec crypto-alert-bot-dev npm test
   ```

5. **Stop development container:**
   ```bash
   docker-compose -f docker-compose.dev.yml down
   ```

### Development Features

- **Hot Reload**: Code changes trigger automatic restart
- **Debug Logging**: Verbose logging for development
- **Dev Dependencies**: All development tools included
- **Volume Mounts**: Source code mounted for real-time editing
- **Safe Isolation**: Runs with non-root user permissions

## Production Environment

### Quick Start

1. **Start production container:**
   ```bash
   docker-compose up -d
   ```

2. **View logs:**
   ```bash
   docker-compose logs -f
   ```

3. **Stop production container:**
   ```bash
   docker-compose down
   ```

### Production Features

- **Optimized Build**: Only production dependencies
- **Health Checks**: Container health monitoring
- **Security**: Non-root user execution
- **Persistence**: Data and logs preserved across restarts

## Environment Variables

Create a `.env` file in the project root:

```env
TELEGRAM_BOT_TOKEN=your_bot_token_here
PRICE_CHECK_INTERVAL_MINUTES=5
ALERT_COOLDOWN_MINUTES=30
MAX_COMMANDS_PER_MINUTE=10
```

## Manual Docker Commands

### Development

```bash
# Build development image
docker build -f .devcontainer/Dockerfile -t crypto-bot-dev .

# Run development container
docker run -d --name crypto-bot-dev \
  -v $(pwd)/src:/app/src:ro \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/logs:/app/logs \
  -p 3000:3000 \
  --env-file .env \
  crypto-bot-dev
```

### Production

```bash
# Build production image
docker build -f Dockerfile.prod -t crypto-bot-prod .

# Run production container
docker run -d --name crypto-bot-prod \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/logs:/app/logs \
  --env-file .env \
  crypto-bot-prod
```

## Troubleshooting

### Container Won't Start
```bash
# Check container logs
docker logs crypto-alert-bot-dev

# Check container status
docker ps -a
```

### Permission Issues
```bash
# Fix data directory permissions
sudo chown -R 1001:1001 data logs
```

### Clean Rebuild
```bash
# Remove containers and images
docker-compose -f docker-compose.dev.yml down --rmi all --volumes

# Rebuild from scratch
docker-compose -f docker-compose.dev.yml build --no-cache
```
