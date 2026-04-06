#!/bin/bash

# D1 Database Seed Script
# This script inserts sample data into the database

echo "Starting D1 database seeding..."

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "Error: wrangler CLI is not installed"
    echo "Please install it with: npm install -g wrangler"
    exit 1
fi

# Execute the seed.sql file
echo "Inserting sample users..."
wrangler d1 execute DEMO_DB --file=./seed.sql

if [ $? -eq 0 ]; then
    echo "✓ Seeding completed successfully!"
    echo "✓ Inserted 5 sample users"
else
    echo "✗ Seeding failed"
    exit 1
fi
