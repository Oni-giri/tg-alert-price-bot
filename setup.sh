#!/bin/bash

# Crypto Alert Bot Setup Script

set -e

echo "🚀 Setting up Crypto Alert Bot..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check Node.js version
node_version=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$node_version" -lt 18 ]; then
    echo "❌ Node.js 18+ is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js $(node -v) detected"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Create directories
echo "📁 Creating directories..."
mkdir -p data logs

# Copy environment file if it doesn't exist
if [ ! -f .env ]; then
    echo "⚙️ Creating environment file..."
    cp .env.example .env
    echo "📝 Please edit .env file and add your TELEGRAM_BOT_TOKEN"
else
    echo "✅ Environment file already exists"
fi

# Build the project
echo "🔨 Building project..."
npm run build

# Run tests
echo "🧪 Running tests..."
npm test

echo ""
echo "🎉 Setup completed successfully!"
echo ""
echo "Next steps:"
echo "1. Edit .env file and add your TELEGRAM_BOT_TOKEN"
echo "2. Run 'npm start' to start the bot"
echo "3. Or run 'npm run dev' for development mode"
echo ""
echo "For Docker deployment:"
echo "1. Ensure .env file is configured"
echo "2. Run 'docker-compose up -d'"
echo ""
echo "📖 See README.md for detailed documentation"
