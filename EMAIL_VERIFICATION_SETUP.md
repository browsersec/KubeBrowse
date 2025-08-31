# Email Verification Setup Guide

This guide explains how to set up email verification for KubeBrowse's email-based user registration.

## Overview

Email verification is now required for users who register with email and password. Users who sign up via OAuth (GitHub) don't need email verification as their email is already verified by the OAuth provider.

## Features

- ✅ Email verification required for email-based signup
- ✅ Verification email with secure token (24-hour expiration)
- ✅ Resend verification email functionality
- ✅ Automatic session creation after verification
- ✅ Backward compatibility with existing users
- ✅ OAuth users bypass email verification

## Database Changes

The following fields have been added to the `users` table:

```sql
ALTER TABLE users 
ADD COLUMN email_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN email_verification_token VARCHAR(255),
ADD COLUMN email_verification_expires_at TIMESTAMP;
```

## Environment Configuration

Add the following environment variables to your `.env` file:

```bash
# Email Configuration (for email verification)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your_email@gmail.com
SMTP_PASSWORD=your_app_password
FROM_EMAIL=your_email@gmail.com
FROM_NAME=KubeBrowse
BASE_URL=http://localhost:4567
```

### SMTP Provider Examples

#### Gmail
```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your_email@gmail.com
SMTP_PASSWORD=your_app_password  # Use App Password, not regular password
```

#### Outlook/Hotmail
```bash
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_USERNAME=your_email@outlook.com
SMTP_PASSWORD=your_password
```

#### SendGrid
```bash
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USERNAME=apikey
SMTP_PASSWORD=your_sendgrid_api_key
```

#### Mailgun
```bash
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_USERNAME=your_mailgun_username
SMTP_PASSWORD=your_mailgun_password
```

## API Endpoints

### Registration
```http
POST /auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securepassword"
}
```

**Response (201):**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "email_verified": false,
    "provider": "email"
  },
  "message": "User registered successfully. Please check your email to verify your account."
}
```

### Login (Before Verification)
```http
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securepassword"
}
```

**Response (403):**
```json
{
  "error": "Email not verified. Please check your email and verify your account.",
  "code": "EMAIL_NOT_VERIFIED"
}
```

### Email Verification (GET - from email link)
```http
GET /auth/verify-email?token=verification_token_here
```

**Response:** Redirects to `FRONTEND_URL/auth/verification-success`

### Email Verification (POST - API)
```http
POST /auth/verify-email
Content-Type: application/json

{
  "token": "verification_token_here"
}
```

**Response (200):**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "email_verified": true,
    "provider": "email"
  },
  "message": "Email verified successfully"
}
```

### Resend Verification Email
```http
POST /auth/resend-verification
Content-Type: application/json

{
  "email": "user@example.com"
}
```

**Response (200):**
```json
{
  "message": "Verification email sent successfully"
}
```

## Frontend Integration

### Registration Flow
1. User submits registration form
2. Backend creates user with `email_verified: false`
3. Verification email is sent
4. Show message: "Please check your email to verify your account"

### Login Flow
1. User submits login form
2. If email not verified, show error with resend option
3. After verification, user can login normally

### Verification Success Page
Create a page at `/auth/verification-success` to handle successful verifications.

### Example Frontend Code

```javascript
// Registration
const register = async (email, password) => {
  try {
    const response = await fetch('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    
    if (response.ok) {
      // Show verification message
      showMessage('Please check your email to verify your account');
    }
  } catch (error) {
    console.error('Registration failed:', error);
  }
};

// Login with verification check
const login = async (email, password) => {
  try {
    const response = await fetch('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    
    const data = await response.json();
    
    if (response.status === 403 && data.code === 'EMAIL_NOT_VERIFIED') {
      // Show resend verification option
      showEmailNotVerifiedMessage(email);
    } else if (response.ok) {
      // Login successful
      redirectToApp();
    }
  } catch (error) {
    console.error('Login failed:', error);
  }
};

// Resend verification
const resendVerification = async (email) => {
  try {
    const response = await fetch('/auth/resend-verification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    
    if (response.ok) {
      showMessage('Verification email sent successfully');
    }
  } catch (error) {
    console.error('Resend failed:', error);
  }
};
```

## Database Migration

Run the migration to add email verification fields to existing databases:

```bash
# Apply the migration
psql -d your_database -f db/migrations/001_add_email_verification.sql
```

Or regenerate the database schema:

```bash
# Regenerate SQLC code
sqlc generate
```

## Testing

### Local Testing with Gmail

1. Enable 2-factor authentication on your Gmail account
2. Generate an App Password:
   - Go to Google Account settings
   - Security → 2-Step Verification → App passwords
   - Generate password for "Mail"
3. Use the app password in `SMTP_PASSWORD`

### Testing Email Verification

1. Register a new user
2. Check your email for verification link
3. Click the link or use the API endpoint
4. Verify the user can now login

## Security Considerations

- Verification tokens expire after 24 hours
- Tokens are cryptographically secure (32 random bytes)
- Email verification is required only for email-based signup
- OAuth users bypass verification (email already verified by provider)
- Existing users are automatically marked as verified for backward compatibility

## Troubleshooting

### Email Not Sending
- Check SMTP credentials and configuration
- Verify firewall/network access to SMTP server
- Check application logs for detailed error messages
- Test SMTP connection manually

### Verification Link Not Working
- Check token expiration (24 hours)
- Verify BASE_URL is correctly set
- Check for URL encoding issues in email clients

### Database Issues
- Ensure migration has been applied
- Verify new columns exist in users table
- Check indexes are created properly

## Production Deployment

1. Use a reliable SMTP service (SendGrid, Mailgun, etc.)
2. Set secure environment variables
3. Use HTTPS for BASE_URL
4. Monitor email delivery rates
5. Set up proper DNS records (SPF, DKIM) for better deliverability