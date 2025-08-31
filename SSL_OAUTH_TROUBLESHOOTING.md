# SSL Certificate Issues - OAuth Testing Solutions

## Problem
Getting "RequestError - self signed certificate" when testing OAuth endpoints with HTTPS.

## Solutions (Multiple Approaches)

### Solution 1: VS Code REST Client Settings (Recommended for Testing)

If you're using VS Code with the REST Client extension:

1. **Open VS Code Settings** (`Ctrl/Cmd + ,`)
2. **Search for "rest-client"**
3. **Add to settings.json**:

```json
{
  "rest-client.certificates": {
    "localhost:4567": {
      "cert": "",
      "key": "",
      "pfx": "",
      "passphrase": "",
      "rejectUnauthorized": false
    }
  }
}
```

### Solution 2: Use HTTP for Local Testing

Update your environment configuration to use HTTP instead of HTTPS for local development:

#### Update `.env` file:
```bash
# Use HTTP for local OAuth testing
GITHUB_CALLBACK_URL=http://localhost:4567/auth/oauth/github/callback
FRONTEND_URL=http://localhost:3000

# Other settings remain the same
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
```

#### Update GitHub OAuth App:
1. Go to your GitHub OAuth App settings
2. Change the **Authorization callback URL** to: `http://localhost:4567/auth/oauth/github/callback`

### Solution 3: cURL with SSL Verification Disabled

For command-line testing:

```bash
# Test OAuth endpoint with SSL verification disabled
curl -k -v https://localhost:4567/auth/oauth/github

# Or use HTTP
curl -v http://localhost:4567/auth/oauth/github

# Test health endpoint
curl -k https://localhost:4567/health
# or
curl http://localhost:4567/health
```

### Solution 4: Generate Proper SSL Certificates

For a more permanent solution, generate proper SSL certificates:

```bash
# Navigate to certs directory
cd certs/

# Run the certificate generation script
chmod +x generate.sh
./generate.sh

# This should create proper certificates for localhost
```

### Solution 5: Postman Configuration

If using Postman:
1. Go to **Settings** → **General**
2. Turn OFF **SSL certificate verification**
3. Test your OAuth endpoints

### Solution 6: Browser Testing (Bypass Certificate Warnings)

For manual browser testing:
1. Navigate to `https://localhost:4567/health`
2. Click "Advanced" when you see the certificate warning
3. Click "Proceed to localhost (unsafe)"
4. Now the browser will accept the self-signed certificate for this session

## Recommended Testing Approach

### For Development/Testing:
1. **Use HTTP** for local OAuth testing (Solution 2)
2. **Update GitHub OAuth app** callback URL to use HTTP
3. **Use the HTTP endpoints** in `oauth-test.http`

### For Production:
1. **Use proper SSL certificates** (Solution 4)
2. **Configure HTTPS properly** in your deployment
3. **Update OAuth callback URLs** to use HTTPS with your domain

## Updated Environment Variables for HTTP Testing

Create a `.env.local` file for HTTP testing:

```bash
# Local HTTP testing configuration
DATABASE_URL=postgres://postgresuser:postgrespassword@localhost:5432/sandbox_db?sslmode=disable

# GitHub OAuth Configuration (HTTP for local testing)
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GITHUB_CALLBACK_URL=http://localhost:4567/auth/oauth/github/callback

# Frontend URL
FRONTEND_URL=http://localhost:3000

# Session Configuration
SESSION_SECRET=your_session_secret_key_here

# Other configuration
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=postgresuser
POSTGRES_PASSWORD=postgrespassword
POSTGRES_DB=sandbox_db
```

## Testing Commands

After applying Solution 2 (HTTP), test with:

```bash
# Test health endpoint
curl http://localhost:4567/health

# Test OAuth flow
curl -v http://localhost:4567/auth/oauth/github

# Check if backend is running
curl -s -o /dev/null -w "%{http_code}" http://localhost:4567/health
```

## Quick Fix Summary

**Immediate fix for testing:**
1. Use the HTTP endpoints in the updated `oauth-test.http` file (sections marked with "1b", "2b", etc.)
2. Update your GitHub OAuth app callback URL to use HTTP
3. Test the OAuth flow through your browser at `http://localhost:3000`

This will bypass all SSL certificate issues for local development and testing.
