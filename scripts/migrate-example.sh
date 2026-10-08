#!/bin/bash

# Example script showing how to use the migration system
# This is for demonstration purposes - modify the DATABASE_URL as needed

echo "🔧 Example: Running migrations for local development"

# Example 1: Local PostgreSQL
echo "📝 Example 1: Local PostgreSQL"
echo "export DATABASE_URL='postgres://postgres:password@localhost:5432/kubebrowse?sslmode=disable'"
echo ""

# Example 2: Docker PostgreSQL
echo "📝 Example 2: Docker PostgreSQL"
echo "export DATABASE_URL='postgres://postgres:password@localhost:5432/kubebrowse?sslmode=disable'"
echo ""

# Example 3: Kubernetes/Remote PostgreSQL
echo "📝 Example 3: Kubernetes/Remote PostgreSQL"
echo "export DATABASE_URL='postgres://postgresuser:password@postgres-service:5432/sandbox_db?sslmode=disable'"
echo ""

# Example 4: Production with SSL
echo "📝 Example 4: Production with SSL"
echo "export DATABASE_URL='postgres://username:password@host:5432/dbname?sslmode=require'"
echo ""

echo "🚀 After setting DATABASE_URL, run:"
echo "./scripts/migrate.sh"
echo ""

echo "📊 To check migration status:"
echo "migrate -path ./db/migrations -database \"\$DATABASE_URL\" version"
echo ""

echo "🔄 To create a new migration:"
echo "migrate create -ext sql -dir ./db/migrations -seq migration_name"
echo ""

echo "📚 For more information, see: DB_MIGRATIONS.md"
