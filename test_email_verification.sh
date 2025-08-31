#!/bin/bash

# Test script for email verification functionality
# This script tests the email verification API endpoints

BASE_URL="http://localhost:4567"
TEST_EMAIL="test@example.com"
TEST_PASSWORD="testpassword123"

echo "🧪 Testing Email Verification Implementation"
echo "============================================="

# Test 1: Register a new user
echo "📝 Test 1: Registering new user..."
REGISTER_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}")

echo "Register Response: $REGISTER_RESPONSE"

# Test 2: Try to login before verification (should fail)
echo ""
echo "🔐 Test 2: Attempting login before email verification..."
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}")

echo "Login Response: $LOGIN_RESPONSE"

# Test 3: Resend verification email
echo ""
echo "📧 Test 3: Resending verification email..."
RESEND_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/resend-verification" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\"}")

echo "Resend Response: $RESEND_RESPONSE"

# Test 4: Try to verify with invalid token
echo ""
echo "❌ Test 4: Testing invalid verification token..."
INVALID_VERIFY_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/verify-email" \
  -H "Content-Type: application/json" \
  -d "{\"token\":\"invalid_token_123\"}")

echo "Invalid Verify Response: $INVALID_VERIFY_RESPONSE"

echo ""
echo "✅ Email verification API tests completed!"
echo ""
echo "📋 Manual Testing Steps:"
echo "1. Check your email service logs for verification emails"
echo "2. If email service is configured, check your inbox for verification email"
echo "3. Use the verification token from the email to test successful verification"
echo "4. After verification, test login again (should succeed)"
echo ""
echo "🔧 Configuration Check:"
echo "- Ensure SMTP_* environment variables are set for email sending"
echo "- Check DATABASE_URL is properly configured"
echo "- Verify the database migration has been applied"