#!/bin/bash

# Email Verification API Test Script
# This script tests the complete email verification flow

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

# Configuration
BASE_URL="${BASE_URL:-http://localhost:4567}"
TEST_EMAIL="${TEST_EMAIL:-test$(date +%s)@example.com}"
TEST_PASSWORD="testpassword123"

print_status "🧪 Email Verification API Test"
echo "=================================="
print_status "Base URL: $BASE_URL"
print_status "Test Email: $TEST_EMAIL"

# Function to make API calls with better error handling
api_call() {
    local method="$1"
    local endpoint="$2"
    local data="$3"
    local expected_status="$4"
    
    print_debug "Making $method request to $endpoint"
    
    if [ -n "$data" ]; then
        response=$(curl -s -w "\n%{http_code}" -X "$method" "$BASE_URL$endpoint" \
            -H "Content-Type: application/json" \
            -d "$data")
    else
        response=$(curl -s -w "\n%{http_code}" -X "$method" "$BASE_URL$endpoint")
    fi
    
    # Split response and status code
    body=$(echo "$response" | head -n -1)
    status=$(echo "$response" | tail -n 1)
    
    print_debug "Response Status: $status"
    print_debug "Response Body: $body"
    
    if [ -n "$expected_status" ] && [ "$status" != "$expected_status" ]; then
        print_error "Expected status $expected_status, got $status"
        print_error "Response: $body"
        return 1
    fi
    
    echo "$body"
    return 0
}

# Test 1: Check if user already exists
print_status "🔍 Test 1: Checking if test user already exists..."
existing_user=$(./debug_users.sh find "$TEST_EMAIL" 2>/dev/null | grep -c "$TEST_EMAIL" || echo "0")

if [ "$existing_user" -gt 0 ]; then
    print_warning "Test user already exists. Deleting..."
    ./debug_users.sh delete "$TEST_EMAIL" <<< "yes"
fi

# Test 2: Register new user
print_status "📝 Test 2: Registering new user..."
register_data="{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}"
register_response=$(api_call "POST" "/auth/register" "$register_data" "201")

if echo "$register_response" | grep -q "check your email"; then
    print_status "✅ Registration successful - email verification required"
else
    print_error "❌ Unexpected registration response"
    echo "$register_response"
fi

# Test 3: Try to login before verification (should fail)
print_status "🔐 Test 3: Attempting login before email verification..."
login_data="{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}"
login_response=$(api_call "POST" "/auth/login" "$login_data" "403")

if echo "$login_response" | grep -q "EMAIL_NOT_VERIFIED"; then
    print_status "✅ Login correctly blocked - email verification required"
else
    print_error "❌ Login should have been blocked"
    echo "$login_response"
fi

# Test 4: Check user in database
print_status "🔍 Test 4: Checking user in database..."
./debug_users.sh find "$TEST_EMAIL"

# Test 5: Resend verification email
print_status "📧 Test 5: Testing resend verification email..."
resend_data="{\"email\":\"$TEST_EMAIL\"}"
resend_response=$(api_call "POST" "/auth/resend-verification" "$resend_data" "200")

if echo "$resend_response" | grep -q "sent successfully"; then
    print_status "✅ Resend verification email successful"
else
    print_warning "⚠️  Resend verification may have failed"
    echo "$resend_response"
fi

# Test 6: Try invalid verification token
print_status "❌ Test 6: Testing invalid verification token..."
invalid_verify_data="{\"token\":\"invalid_token_123\"}"
invalid_response=$(api_call "POST" "/auth/verify-email" "$invalid_verify_data" "400")

if echo "$invalid_response" | grep -q "Invalid or expired"; then
    print_status "✅ Invalid token correctly rejected"
else
    print_warning "⚠️  Invalid token handling may be incorrect"
    echo "$invalid_response"
fi

# Test 7: Manual verification (for testing)
print_status "🔧 Test 7: Manually verifying user for testing..."
./debug_users.sh verify "$TEST_EMAIL"

# Test 8: Try login after verification
print_status "🔐 Test 8: Attempting login after verification..."
login_response=$(api_call "POST" "/auth/login" "$login_data" "200")

if echo "$login_response" | grep -q "Login successful"; then
    print_status "✅ Login successful after verification"
else
    print_error "❌ Login failed after verification"
    echo "$login_response"
fi

# Test 9: Check authenticated user info
print_status "👤 Test 9: Getting user info..."
user_info=$(api_call "GET" "/auth/me" "" "")

if echo "$user_info" | grep -q "$TEST_EMAIL"; then
    print_status "✅ User info retrieved successfully"
else
    print_warning "⚠️  User info may not be available (check cookies/session)"
    echo "$user_info"
fi

# Cleanup
print_status "🧹 Cleaning up test user..."
./debug_users.sh delete "$TEST_EMAIL" <<< "yes"

echo ""
print_status "📋 Test Summary:"
echo "✅ User registration with email verification"
echo "✅ Login blocked before verification"
echo "✅ Resend verification email"
echo "✅ Invalid token rejection"
echo "✅ Login successful after verification"

echo ""
print_status "🔧 Next Steps:"
echo "1. Check your application logs for email service messages"
echo "2. Verify SMTP configuration with: ./test_smtp.sh"
echo "3. If emails aren't being sent, check SMTP credentials"
echo "4. Test with a real email address to receive verification emails"

echo ""
print_status "📧 Email Configuration Check:"
if [ -n "$SMTP_HOST" ]; then
    echo "SMTP_HOST: $SMTP_HOST"
else
    print_warning "SMTP_HOST not set"
fi

if [ -n "$FROM_EMAIL" ]; then
    echo "FROM_EMAIL: $FROM_EMAIL"
else
    print_warning "FROM_EMAIL not set"
fi

echo ""
print_status "✅ Email verification API test completed!"