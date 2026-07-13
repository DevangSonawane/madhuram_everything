#!/bin/bash

# Rollback script for Inventory Management System
# This script restores database from backup and restarts the application

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$SCRIPT_DIR/server"
BACKUP_DIR="$SERVER_DIR/backups"

echo -e "${RED}========================================${NC}"
echo -e "${RED}Inventory Management System Rollback${NC}"
echo -e "${RED}========================================${NC}"
echo ""

# Check if backup directory exists
if [ ! -d "$BACKUP_DIR" ]; then
    echo -e "${RED}❌ Error: Backup directory not found: $BACKUP_DIR${NC}"
    exit 1
fi

# List available backups
echo -e "${YELLOW}Available backups:${NC}"
ls -1t "$BACKUP_DIR"/*.sql 2>/dev/null | head -10 | nl || {
    echo -e "${RED}❌ No backup files found${NC}"
    exit 1
}

echo ""
read -p "Enter backup file number to restore (or full path): " backup_input

# Determine backup file path
if [[ "$backup_input" =~ ^[0-9]+$ ]]; then
    BACKUP_FILE=$(ls -1t "$BACKUP_DIR"/*.sql 2>/dev/null | sed -n "${backup_input}p")
else
    BACKUP_FILE="$backup_input"
fi

# Validate backup file
if [ ! -f "$BACKUP_FILE" ]; then
    echo -e "${RED}❌ Error: Backup file not found: $BACKUP_FILE${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}⚠️  WARNING: This will restore the database from backup${NC}"
echo -e "${YELLOW}⚠️  All current data will be replaced with backup data${NC}"
read -p "Are you sure you want to continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo -e "${YELLOW}Rollback cancelled${NC}"
    exit 0
fi

# Load environment variables
if [ ! -f "$SERVER_DIR/.env" ]; then
    echo -e "${RED}❌ Error: .env file not found${NC}"
    exit 1
fi

source "$SERVER_DIR/.env"

# Check required environment variables
if [ -z "$DB_HOST" ] || [ -z "$DB_USER" ] || [ -z "$DB_PASSWORD" ] || [ -z "$DB_NAME" ]; then
    echo -e "${RED}❌ Error: Required database environment variables not set${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}🛑 Step 1: Stopping application...${NC}"
pm2 stop inventory-api 2>/dev/null || true

echo ""
echo -e "${YELLOW}📦 Step 2: Restoring database from backup...${NC}"

# Restore database (requires mysql client)
if command -v mysql &> /dev/null; then
    mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" < "$BACKUP_FILE" || {
        echo -e "${RED}❌ Error: Database restoration failed${NC}"
        echo -e "${YELLOW}Attempting to restart application anyway...${NC}"
        pm2 start ecosystem.config.js --env production || true
        exit 1
    }
    echo -e "${GREEN}✅ Database restored from: $BACKUP_FILE${NC}"
else
    echo -e "${RED}❌ Error: mysql client not found${NC}"
    echo -e "${YELLOW}Please restore database manually and restart the application${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}🔄 Step 3: Restarting application...${NC}"
cd "$SERVER_DIR"
pm2 start ecosystem.config.js --env production || {
    echo -e "${RED}❌ Error: Failed to restart application${NC}"
    exit 1
}

echo ""
echo -e "${GREEN}✅ Rollback completed successfully!${NC}"
echo ""
echo -e "${YELLOW}📊 Application Status:${NC}"
pm2 status inventory-api

echo ""
echo -e "${GREEN}Rollback completed at $(date)${NC}"
