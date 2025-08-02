FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Create data and logs directories
RUN mkdir -p data logs

# Expose health check port (if needed)
EXPOSE 3000

# Run the application
CMD ["npm", "start"]
