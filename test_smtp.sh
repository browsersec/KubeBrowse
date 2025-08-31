#!/bin/bash

# SMTP Configuration Test Script
# This script helps you test your SMTP configuration

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

# Load environment variables if .env file exists
if [ -f .env ]; then
    print_status "Loading environment variables from .env file..."
    export $(grep -v '^#' .env | xargs)
fi

print_status "🧪 SMTP Configuration Test"
echo "=================================="

# Check required environment variables
print_status "Checking SMTP configuration..."

SMTP_HOST="${SMTP_HOST:-}"
SMTP_PORT="${SMTP_PORT:-587}"
SMTP_USERNAME="${SMTP_USERNAME:-}"
SMTP_PASSWORD="${SMTP_PASSWORD:-}"
FROM_EMAIL="${FROM_EMAIL:-}"
FROM_NAME="${FROM_NAME:-KubeBrowse}"
BASE_URL="${BASE_URL:-http://localhost:4567}"

echo "SMTP_HOST: ${SMTP_HOST:-'❌ NOT SET'}"
echo "SMTP_PORT: ${SMTP_PORT}"
echo "SMTP_USERNAME: ${SMTP_USERNAME:-'❌ NOT SET'}"
echo "SMTP_PASSWORD: ${SMTP_PASSWORD:+✅ SET}${SMTP_PASSWORD:-❌ NOT SET}"
echo "FROM_EMAIL: ${FROM_EMAIL:-'❌ NOT SET'}"
echo "FROM_NAME: ${FROM_NAME}"
echo "BASE_URL: ${BASE_URL}"

# Check if all required variables are set
missing_vars=()
[ -z "$SMTP_HOST" ] && missing_vars+=("SMTP_HOST")
[ -z "$SMTP_USERNAME" ] && missing_vars+=("SMTP_USERNAME")
[ -z "$SMTP_PASSWORD" ] && missing_vars+=("SMTP_PASSWORD")
[ -z "$FROM_EMAIL" ] && missing_vars+=("FROM_EMAIL")

if [ ${#missing_vars[@]} -gt 0 ]; then
    print_error "Missing required environment variables:"
    for var in "${missing_vars[@]}"; do
        echo "  - $var"
    done
    echo ""
    print_status "Example configuration for Gmail:"
    echo "SMTP_HOST=smtp.gmail.com"
    echo "SMTP_PORT=587"
    echo "SMTP_USERNAME=your_email@gmail.com"
    echo "SMTP_PASSWORD=your_app_password"
    echo "FROM_EMAIL=your_email@gmail.com"
    echo "FROM_NAME=KubeBrowse"
    echo "BASE_URL=http://localhost:4567"
    exit 1
fi

# Test SMTP connection
print_status "Testing SMTP connection to $SMTP_HOST:$SMTP_PORT..."

if command -v nc >/dev/null 2>&1; then
    if nc -z -w5 "$SMTP_HOST" "$SMTP_PORT" 2>/dev/null; then
        print_status "✅ Successfully connected to SMTP server"
    else
        print_error "❌ Failed to connect to SMTP server"
        print_error "Please check your SMTP_HOST and SMTP_PORT"
        exit 1
    fi
elif command -v telnet >/dev/null 2>&1; then
    if timeout 5 telnet "$SMTP_HOST" "$SMTP_PORT" </dev/null >/dev/null 2>&1; then
        print_status "✅ Successfully connected to SMTP server"
    else
        print_error "❌ Failed to connect to SMTP server"
        exit 1
    fi
else
    print_warning "Neither 'nc' nor 'telnet' available, skipping connection test"
fi

# Test with Go program if available
if [ -f "bin/kubebrowse" ]; then
    print_status "Testing with KubeBrowse binary..."
    
    # Set test email environment variable
    export TEST_EMAIL="${TEST_EMAIL:-$FROM_EMAIL}"
    
    print_debug "Starting KubeBrowse with email test mode..."
    print_debug "Check the application logs for email service status"
    
    # You can uncomment the test functions in main.go and run:
    # ./bin/kubebrowse &
    # sleep 5
    # kill %1
else
    print_warning "KubeBrowse binary not found. Build it with: go build -o bin/kubebrowse cmd/guac/main.go"
fi

# Provide manual testing instructions
echo ""
print_status "📋 Manual Testing Steps:"
echo "1. Start your KubeBrowse application"
echo "2. Check the logs for email service configuration messages"
echo "3. Try registering a new user with a valid email"
echo "4. Check your email inbox (and spam folder)"
echo "5. Look for verification email from $FROM_EMAIL"

echo ""
print_status "🔧 Common Issues and Solutions:"
echo ""
echo "Gmail Users:"
echo "  - Enable 2-factor authentication"
echo "  - Generate an App Password (not your regular password)"
echo "  - Use the App Password in SMTP_PASSWORD"
echo ""
echo "Outlook/Hotmail Users:"
echo "  - Use SMTP_HOST=smtp-mail.outlook.com"
echo "  - Use your regular email password"
echo ""
echo "Corporate Email:"
echo "  - Check with your IT department for SMTP settings"
echo "  - May require VPN or specific network access"
echo ""
echo "Firewall Issues:"
echo "  - Ensure port $SMTP_PORT is not blocked"
echo "  - Check if your hosting provider blocks SMTP"

echo ""
print_status "✅ SMTP configuration test completed!"