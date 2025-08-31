#!/bin/bash

# KubeBrowse OAuth Testing Script
set -e

echo "🔧 KubeBrowse OAuth Testing Script"
echo "=================================="

# Check if required environment variables are set
if [ -z "$GITHUB_CLIENT_ID" ] || [ -z "$GITHUB_CLIENT_SECRET" ]; then
    echo "❌ Error: GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET must be set"
    echo "Please create a .env file with your GitHub OAuth credentials"
    exit 1
fi

echo "✅ Environment variables configured"

# Check if PostgreSQL is running
if ! pg_isready -h localhost -p 5432 >/dev/null 2>&1; then
    echo "❌ Error: PostgreSQL is not running on localhost:5432"
    echo "Please start PostgreSQL before testing OAuth"
    exit 1
fi

echo "✅ PostgreSQL is running"

# Check if backend is running (try HTTPS first, then HTTP)
echo "🔍 Checking backend availability..."
if curl -k -s https://localhost:4567/health >/dev/null 2>&1; then
    echo "✅ Backend is running on HTTPS (localhost:4567)"
    BACKEND_URL="https://localhost:4567"
    CURL_OPTS="-k"  # Ignore SSL certificate verification
elif curl -s http://localhost:4567/health >/dev/null 2>&1; then
    echo "✅ Backend is running on HTTP (localhost:4567)"
    BACKEND_URL="http://localhost:4567"
    CURL_OPTS=""
else
    echo "❌ Error: Backend is not running on localhost:4567 (tried both HTTP and HTTPS)"
    echo "Please start the backend: go run cmd/guac/main.go"
    exit 1
fi

# Test OAuth endpoint
echo "🧪 Testing OAuth endpoint..."
response=$(curl $CURL_OPTS -s -o /dev/null -w "%{http_code}" $BACKEND_URL/auth/oauth/github)

if [ "$response" = "302" ] || [ "$response" = "200" ]; then
    echo "✅ OAuth endpoint is responding (HTTP $response)"
else
    echo "❌ OAuth endpoint returned HTTP $response"
    exit 1
fi

echo ""
echo "🎉 OAuth setup appears to be working!"
echo "Backend URL: $BACKEND_URL"
echo ""
echo "Next steps:"
echo "1. Open http://localhost:3000 in your browser"
echo "2. Click 'Continue with GitHub'"
echo "3. Authorize the application"
echo "4. Check if you're redirected back and logged in"
echo ""
echo "📝 Important Notes:"
if [ "$BACKEND_URL" = "https://localhost:4567" ]; then
    echo "- Backend is using HTTPS with self-signed certificates"
    echo "- You may need to accept certificate warnings in your browser"
    echo "- For testing, consider using HTTP by updating your .env file"
else
    echo "- Backend is using HTTP (good for local testing)"
    echo "- Make sure your GitHub OAuth app callback URL uses HTTP"
fi
echo ""
echo "For debugging, check:"
echo "- Backend logs for OAuth-related messages"
echo "- Browser developer tools for network requests"
echo "- Database for new user records"
echo "- SSL_OAUTH_TROUBLESHOOTING.md for certificate issues"
