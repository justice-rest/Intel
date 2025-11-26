#!/bin/bash

# Rōmy Database Migration Script
# This script runs the database migration against your Supabase instance

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Rōmy Database Migration${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check if .env.local exists
if [ ! -f .env.local ]; then
  echo -e "${RED}Error: .env.local file not found!${NC}"
  echo -e "${YELLOW}Please create .env.local with your Supabase credentials.${NC}"
  exit 1
fi

# Load environment variables
source .env.local

# Check if Supabase URL is set
if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ]; then
  echo -e "${RED}Error: NEXT_PUBLIC_SUPABASE_URL not found in .env.local${NC}"
  exit 1
fi

# Check if service role key is set
if [ -z "$SUPABASE_SERVICE_ROLE" ]; then
  echo -e "${RED}Error: SUPABASE_SERVICE_ROLE not found in .env.local${NC}"
  exit 1
fi

# Extract project ref from Supabase URL
PROJECT_REF=$(echo $NEXT_PUBLIC_SUPABASE_URL | grep -oP 'https://\K[^.]+')

echo -e "${YELLOW}Project:${NC} $PROJECT_REF"
echo -e "${YELLOW}URL:${NC} $NEXT_PUBLIC_SUPABASE_URL"
echo ""

# Check if migration file exists
MIGRATION_FILE="migrations/001_initial_schema.sql"
if [ ! -f "$MIGRATION_FILE" ]; then
  echo -e "${RED}Error: Migration file not found at $MIGRATION_FILE${NC}"
  exit 1
fi

echo -e "${YELLOW}Running migration: $MIGRATION_FILE${NC}"
echo ""

# Ask for confirmation
read -p "$(echo -e ${YELLOW}This will create/update tables in your Supabase database. Continue? [y/N]:${NC} )" -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo -e "${RED}Migration cancelled.${NC}"
  exit 1
fi

# Run the migration using Supabase REST API
echo -e "${BLUE}Executing migration...${NC}"

# Read the SQL file
SQL_CONTENT=$(cat "$MIGRATION_FILE")

# Execute via Supabase REST API
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/exec_sql" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE}" \
  -H "Content-Type: application/json" \
  -d "{\"query\": $(jq -Rs . < "$MIGRATION_FILE")}" 2>&1)

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$HTTP_CODE" -eq 200 ] || [ "$HTTP_CODE" -eq 201 ]; then
  echo -e "${GREEN}✓ Migration completed successfully!${NC}"
  echo ""
  echo -e "${GREEN}Next steps:${NC}"
  echo -e "  1. Create storage buckets in Supabase Dashboard:"
  echo -e "     - ${YELLOW}chat-attachments${NC} (for file uploads)"
  echo -e "     - ${YELLOW}avatars${NC} (for user profile images)"
  echo ""
  echo -e "  2. Enable authentication providers:"
  echo -e "     - ${YELLOW}Google OAuth${NC} (for social login)"
  echo -e "     - ${YELLOW}Anonymous sign-ins${NC} (for guest users)"
  echo ""
  echo -e "  3. If using subscriptions, configure Autumn products:"
  echo -e "     - Visit: ${YELLOW}https://app.useautumn.com/sandbox${NC}"
  echo -e "     - Create products: basic, premium, pro"
  echo -e "     - See: ${YELLOW}SUBSCRIPTION_SETUP.md${NC} for details"
  echo ""
else
  echo -e "${RED}✗ Migration failed with HTTP code: $HTTP_CODE${NC}"
  echo -e "${RED}Response:${NC}"
  echo "$BODY" | jq . 2>/dev/null || echo "$BODY"
  exit 1
fi

echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}Migration complete!${NC}"
echo -e "${BLUE}========================================${NC}"
