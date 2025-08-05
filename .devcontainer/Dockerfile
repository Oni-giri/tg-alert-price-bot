FROM node:18-alpine

# Set working directory
WORKDIR /app

# Install system dependencies for better-sqlite3 and development tools
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    sqlite \
    git \
    bash \
    vim

# Create node user with proper permissions
RUN addgroup -g 1001 -S nodejs && \
    adduser -S -u 1001 -G nodejs nodejs

# Copy package files first for better caching
COPY package*.json ./
COPY tsconfig.json ./
COPY jest.config.js ./

# Install ALL dependencies (including dev dependencies)
RUN npm ci

# Create necessary directories
RUN mkdir -p data logs src dist && \
    chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port for development server/health checks
EXPOSE 3000

# Set development environment
ENV NODE_ENV=development

# Development command with hot reload
CMD ["npm", "run", "dev"]