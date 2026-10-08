#!/bin/bash

# Database Migration Script for KubeBrowse
# This script helps apply database migrations using golang-migrate

set -e

# Default values
DB_URL="${DATABASE_URL:-postgres://postgres:password@localhost:5432/kubebrowse?sslmode=disable}"
MIGRATIONS_DIR="db/migrations"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if migrate CLI is installed
check_migrate_cli() {
    if ! command -v migrate &> /dev/null; then
        print_error "golang-migrate CLI is not installed."
        echo ""
        echo "Install it using one of these methods:"
        echo ""
        echo "macOS (Homebrew):"
        echo "  brew install golang-migrate"
        echo ""
        echo "Linux (curl):"
        echo "  curl -L https://github.com/golang-migrate/migrate/releases/latest/download/migrate.linux-amd64.tar.gz | tar xvz"
        echo "  sudo mv migrate /usr/local/bin/"
        echo ""
        echo "Go install:"
        echo "  go install -tags 'postgres' github.com/golang-migrate/migrate/v4/cmd/migrate@latest"
        echo ""
        exit 1
    fi
}

# Show usage
show_usage() {
    echo "Usage: $0 [COMMAND] [OPTIONS]"
    echo ""
    echo "Commands:"
    echo "  up [N]       Apply all or N up migrations"
    echo "  down [N]     Apply all or N down migrations"
    echo "  force V      Set version V but don't run migration (dirty database recovery)"
    echo "  version      Print current migration version"
    echo "  status       Show migration status"
    echo "  create NAME  Create new migration files"
    echo ""
    echo "Environment Variables:"
    echo "  DATABASE_URL - Database connection string"
    echo "                 Default: postgres://postgres:password@localhost:5432/kubebrowse?sslmode=disable"
    echo ""
    echo "Examples:"
    echo "  $0 up                    # Apply all pending migrations"
    echo "  $0 up 1                  # Apply next 1 migration"
    echo "  $0 down 1                # Rollback 1 migration"
    echo "  $0 version               # Show current version"
    echo "  $0 create add_new_table  # Create new migration files"
}

# Apply migrations up
migrate_up() {
    local steps=${1:-""}
    print_status "Applying migrations up..."
    
    if [ -n "$steps" ]; then
        print_status "Applying $steps migration(s)"
        migrate -path "$MIGRATIONS_DIR" -database "$DB_URL" up "$steps"
    else
        print_status "Applying all pending migrations"
        migrate -path "$MIGRATIONS_DIR" -database "$DB_URL" up
    fi
    
    print_status "Migrations applied successfully!"
}

# Apply migrations down
migrate_down() {
    local steps=${1:-""}
    print_warning "Rolling back migrations..."
    
    if [ -n "$steps" ]; then
        print_warning "Rolling back $steps migration(s)"
        migrate -path "$MIGRATIONS_DIR" -database "$DB_URL" down "$steps"
    else
        print_error "Rolling back ALL migrations. This will destroy all data!"
        read -p "Are you sure? Type 'yes' to continue: " confirm
        if [ "$confirm" = "yes" ]; then
            migrate -path "$MIGRATIONS_DIR" -database "$DB_URL" down
        else
            print_status "Migration rollback cancelled."
            exit 0
        fi
    fi
    
    print_status "Migrations rolled back successfully!"
}

# Force version (for dirty database recovery)
force_version() {
    local version=$1
    if [ -z "$version" ]; then
        print_error "Version number required for force command"
        exit 1
    fi
    
    print_warning "Forcing database version to $version"
    migrate -path "$MIGRATIONS_DIR" -database "$DB_URL" force "$version"
    print_status "Database version forced to $version"
}

# Show current version
show_version() {
    print_status "Current migration version:"
    migrate -path "$MIGRATIONS_DIR" -database "$DB_URL" version
}

# Show migration status
show_status() {
    print_status "Migration status:"
    echo "Database URL: $DB_URL"
    echo "Migrations directory: $MIGRATIONS_DIR"
    echo ""
    
    # List migration files
    print_status "Available migrations:"
    ls -la "$MIGRATIONS_DIR"/*.sql 2>/dev/null || echo "No migration files found"
    
    echo ""
    print_status "Current database version:"
    migrate -path "$MIGRATIONS_DIR" -database "$DB_URL" version 2>/dev/null || echo "No migrations applied yet"
}

# Create new migration
create_migration() {
    local name=$1
    if [ -z "$name" ]; then
        print_error "Migration name required"
        echo "Usage: $0 create migration_name"
        exit 1
    fi
    
    print_status "Creating new migration: $name"
    migrate create -ext sql -dir "$MIGRATIONS_DIR" -seq "$name"
    print_status "Migration files created successfully!"
}

# Main script
main() {
    check_migrate_cli
    
    local command=${1:-""}
    
    case $command in
        "up")
            migrate_up "$2"
            ;;
        "down")
            migrate_down "$2"
            ;;
        "force")
            force_version "$2"
            ;;
        "version")
            show_version
            ;;
        "status")
            show_status
            ;;
        "create")
            create_migration "$2"
            ;;
        "help"|"-h"|"--help"|"")
            show_usage
            ;;
        *)
            print_error "Unknown command: $command"
            echo ""
            show_usage
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"