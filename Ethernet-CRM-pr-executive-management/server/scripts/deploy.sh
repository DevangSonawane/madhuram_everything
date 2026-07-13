#!/bin/bash

# Production Deployment Script
# This script handles the complete deployment process

set -e  # Exit on error

echo "🚀 Starting production deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if .env exists
if [ ! -f .env ]; then
    echo -e "${RED}❌ Error: .env file not found!${NC}"
    echo "Please create .env file from PRODUCTION_ENV.md"
    exit 1
fi

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    echo -e "${YELLOW}⚠️  PM2 not found. Installing...${NC}"
    npm install -g pm2
fi

# Install dependencies
echo -e "${GREEN}📦 Installing dependencies...${NC}"
npm install --production

# Run database migrations
echo -e "${GREEN}🔄 Running database migrations...${NC}"
npm run migrate || echo -e "${YELLOW}⚠️  Migration completed with warnings${NC}"

# Create logs directory
mkdir -p logs

# Stop existing PM2 process if running
echo -e "${GREEN}🛑 Stopping existing processes...${NC}"
pm2 stop inventory-api 2>/dev/null || true
pm2 delete inventory-api 2>/dev/null || true

# Start with PM2
echo -e "${GREEN}▶️  Starting application with PM2...${NC}"
pm2 start ecosystem.config.js --env production

# Save PM2 configuration
pm2 save

# Setup PM2 startup script
echo -e "${GREEN}⚙️  Setting up PM2 startup script...${NC}"
pm2 startup || echo -e "${YELLOW}⚠️  Run the command above as root to enable auto-startup${NC}"

echo -e "${GREEN}✅ Deployment complete!${NC}"
echo ""
echo "Useful commands:"
echo "  pm2 status          - Check application status"
echo "  pm2 logs            - View logs"
echo "  pm2 monit           - Monitor application"
echo "  pm2 restart inventory-api - Restart application"

