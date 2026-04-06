#!/bin/bash

# D1 Database Migration Script
# This script creates the database schema for the Cloudflare Demo Project

echo "Starting D1 database migration..."

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "Error: wrangler CLI is not installed"
    echo "Please install it with: npm install -g wrangler"
    exit 1
fi

# Execute the schema.sql file
echo "Creating users table..."
wrangler d1 execute DEMO_DB --file=./schema.sql

if [ $? -eq 0 ]; then
    echo "✓ Migration completed successfully!"
else
    echo "✗ Migration failed"
    exit 1
fi
