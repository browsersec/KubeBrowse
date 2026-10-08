#!/bin/bash

# Database migration script using golang-migrate
# https://github.com/golang-migrate/migrate
set -e

echo "🚀 Running database migrations using golang-migrate..."

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ DATABASE_URL environment variable is not set"
    echo "Please set DATABASE_URL with your database connection string"
    echo "Example: export DATABASE_URL='postgres://username:password@localhost:5432/dbname?sslmode=disable'"
    exit 1
fi

echo "📡 Using database: $DATABASE_URL"

# Check if migrations directory exists
if [ ! -d "./db/migrations" ]; then
    echo "❌ Migrations directory not found at ./db/migrations"
    exit 1
fi

echo "📁 Found migrations directory: ./db/migrations"

# Check if migrate binary is available
if ! command -v migrate &> /dev/null; then
    echo "📦 Installing golang-migrate..."
    
    # Try to install using go install
    if command -v go &> /dev/null; then
        echo "🔧 Installing via go install..."
        go install -tags 'postgres' github.com/golang-migrate/migrate/v4/cmd/migrate@latest
    else
        echo "❌ Go is not installed. Please install golang-migrate manually:"
        echo "   https://github.com/golang-migrate/migrate#installation"
        exit 1
    fi
fi

echo "✅ Migrate tool is available"

# Test database connection
echo "🔍 Testing database connection..."
if ! migrate -path ./db/migrations -database "$DATABASE_URL" version 2>/dev/null; then
    echo "❌ Failed to connect to database"
    echo "Please check your DATABASE_URL and ensure the database is running"
    exit 1
fi

echo "✅ Database connection successful"

# Run migrations
echo "🔄 Running all pending migrations..."
if migrate -path ./db/migrations -database "$DATABASE_URL" up; then
    echo "✅ Migrations completed successfully!"
    
    # Show current version
    echo "📊 Current database version:"
    migrate -path ./db/migrations -database "$DATABASE_URL" version
    
    echo "🎉 Database is now ready for OAuth authentication!"
else
    echo "❌ Migration failed!"
    echo "Check the error messages above and fix any issues"
    exit 1
fi
