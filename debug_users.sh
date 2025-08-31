#!/bin/bash

# User Database Debug Script
# This script helps you debug user registration issues

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_debug() {
    echo -e "${BLUE}[DEBUG]${NC} $1"
}

# Get database URL from environment or use default
DB_URL="${DATABASE_URL:-postgres://postgres:password@localhost:5432/kubebrowse?sslmode=disable}"

print_status "🔍 User Database Debug Tool"
echo "=================================="
print_status "Database URL: $DB_URL"

# Check if psql is available
if ! command -v psql &> /dev/null; then
    print_error "psql is not installed. Please install PostgreSQL client tools."
    exit 1
fi

# Test database connection
print_status "Testing database connection..."
if ! psql "$DB_URL" -c "SELECT 1;" >/dev/null 2>&1; then
    print_error "❌ Failed to connect to database"
    print_error "Please check your DATABASE_URL"
    exit 1
fi
print_status "✅ Database connection successful"

# Function to show all users
show_users() {
    print_status "📋 Current users in database:"
    psql "$DB_URL" -c "
        SELECT 
            id,
            email,
            provider,
            email_verified,
            created_at
        FROM users 
        ORDER BY created_at DESC;
    " 2>/dev/null || {
        print_error "Failed to query users table"
        print_error "Make sure the database migration has been applied"
        return 1
    }
}

# Function to show user by email
show_user_by_email() {
    local email="$1"
    if [ -z "$email" ]; then
        print_error "Email address required"
        return 1
    fi
    
    print_status "🔍 User details for: $email"
    psql "$DB_URL" -c "
        SELECT 
            id,
            email,
            provider,
            email_verified,
            email_verification_token IS NOT NULL as has_token,
            email_verification_expires_at,
            created_at,
            updated_at
        FROM users 
        WHERE email = '$email';
    " 2>/dev/null || {
        print_error "Failed to query user"
        return 1
    }
}

# Function to delete user by email
delete_user_by_email() {
    local email="$1"
    if [ -z "$email" ]; then
        print_error "Email address required"
        return 1
    fi
    
    print_warning "⚠️  This will permanently delete the user: $email"
    read -p "Are you sure? Type 'yes' to continue: " confirm
    
    if [ "$confirm" = "yes" ]; then
        print_status "Deleting user: $email"
        psql "$DB_URL" -c "DELETE FROM users WHERE email = '$email';" 2>/dev/null || {
            print_error "Failed to delete user"
            return 1
        }
        print_status "✅ User deleted successfully"
    else
        print_status "Operation cancelled"
    fi
}

# Function to reset user verification
reset_user_verification() {
    local email="$1"
    if [ -z "$email" ]; then
        print_error "Email address required"
        return 1
    fi
    
    print_status "Resetting email verification for: $email"
    psql "$DB_URL" -c "
        UPDATE users 
        SET 
            email_verified = FALSE,
            email_verification_token = NULL,
            email_verification_expires_at = NULL,
            updated_at = NOW()
        WHERE email = '$email';
    " 2>/dev/null || {
        print_error "Failed to reset user verification"
        return 1
    }
    print_status "✅ User verification reset successfully"
}

# Function to verify user manually
verify_user_manually() {
    local email="$1"
    if [ -z "$email" ]; then
        print_error "Email address required"
        return 1
    fi
    
    print_status "Manually verifying user: $email"
    psql "$DB_URL" -c "
        UPDATE users 
        SET 
            email_verified = TRUE,
            email_verification_token = NULL,
            email_verification_expires_at = NULL,
            updated_at = NOW()
        WHERE email = '$email';
    " 2>/dev/null || {
        print_error "Failed to verify user"
        return 1
    }
    print_status "✅ User verified successfully"
}

# Function to check database schema
check_schema() {
    print_status "📊 Checking database schema..."
    
    print_debug "Users table columns:"
    psql "$DB_URL" -c "
        SELECT 
            column_name, 
            data_type, 
            is_nullable, 
            column_default
        FROM information_schema.columns 
        WHERE table_name = 'users' 
        ORDER BY ordinal_position;
    " 2>/dev/null || {
        print_error "Failed to check schema - users table may not exist"
        return 1
    }
    
    print_debug "Users table indexes:"
    psql "$DB_URL" -c "
        SELECT 
            indexname,
            indexdef
        FROM pg_indexes 
        WHERE tablename = 'users';
    " 2>/dev/null || {
        print_warning "Could not check indexes"
    }
}

# Main menu
show_menu() {
    echo ""
    print_status "🛠️  Available Commands:"
    echo "1. Show all users"
    echo "2. Show user by email"
    echo "3. Delete user by email"
    echo "4. Reset user verification"
    echo "5. Verify user manually"
    echo "6. Check database schema"
    echo "7. Exit"
    echo ""
}

# Main script
main() {
    if [ $# -eq 0 ]; then
        # Interactive mode
        while true; do
            show_menu
            read -p "Choose an option (1-7): " choice
            
            case $choice in
                1)
                    show_users
                    ;;
                2)
                    read -p "Enter email address: " email
                    show_user_by_email "$email"
                    ;;
                3)
                    read -p "Enter email address to delete: " email
                    delete_user_by_email "$email"
                    ;;
                4)
                    read -p "Enter email address to reset verification: " email
                    reset_user_verification "$email"
                    ;;
                5)
                    read -p "Enter email address to verify manually: " email
                    verify_user_manually "$email"
                    ;;
                6)
                    check_schema
                    ;;
                7)
                    print_status "Goodbye!"
                    exit 0
                    ;;
                *)
                    print_error "Invalid option"
                    ;;
            esac
        done
    else
        # Command line mode
        case "$1" in
            "list"|"show")
                show_users
                ;;
            "find")
                show_user_by_email "$2"
                ;;
            "delete")
                delete_user_by_email "$2"
                ;;
            "reset")
                reset_user_verification "$2"
                ;;
            "verify")
                verify_user_manually "$2"
                ;;
            "schema")
                check_schema
                ;;
            *)
                echo "Usage: $0 [command] [email]"
                echo "Commands:"
                echo "  list          - Show all users"
                echo "  find <email>  - Show user by email"
                echo "  delete <email> - Delete user by email"
                echo "  reset <email>  - Reset user verification"
                echo "  verify <email> - Verify user manually"
                echo "  schema        - Check database schema"
                echo ""
                echo "Run without arguments for interactive mode"
                ;;
        esac
    fi
}

main "$@"