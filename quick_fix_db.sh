#!/bin/bash

# Quick fix script to apply email verification migration
# This script connects to your database and applies the migration

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
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

# Get database URL from environment or use default
DB_URL="${DATABASE_URL:-postgres://postgres:password@localhost:5432/kubebrowse?sslmode=disable}"

print_status "Applying email verification migration..."
print_status "Database URL: $DB_URL"

# Check if psql is available
if ! command -v psql &> /dev/null; then
    print_error "psql is not installed. Please install PostgreSQL client tools."
    echo ""
    echo "Install psql:"
    echo "  Ubuntu/Debian: sudo apt-get install postgresql-client"
    echo "  macOS: brew install postgresql"
    echo "  CentOS/RHEL: sudo yum install postgresql"
    exit 1
fi

# Apply the migration
print_status "Executing migration SQL..."

psql "$DB_URL" << 'EOF'
-- Add email verification fields to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS email_verification_token VARCHAR(255),
ADD COLUMN IF NOT EXISTS email_verification_expires_at TIMESTAMP;

-- Create indexes for the new columns
CREATE INDEX IF NOT EXISTS idx_users_email_verification_token ON users(email_verification_token);
CREATE INDEX IF NOT EXISTS idx_users_email_verified ON users(email_verified);

-- Set email_verified to TRUE for existing OAuth users (they don't need email verification)
UPDATE users 
SET email_verified = TRUE 
WHERE provider != 'email' OR provider IS NULL;

-- Set email_verified to TRUE for existing email users (backward compatibility)
UPDATE users 
SET email_verified = TRUE 
WHERE provider = 'email' AND (email_verified = FALSE OR email_verified IS NULL);

-- Show the results
\echo 'Migration completed successfully!'
\echo 'New columns added to users table:'

SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns 
WHERE table_name = 'users' 
    AND column_name IN ('email_verified', 'email_verification_token', 'email_verification_expires_at')
ORDER BY column_name;

\echo 'User verification status:'
SELECT 
    provider,
    email_verified,
    COUNT(*) as user_count
FROM users 
GROUP BY provider, email_verified
ORDER BY provider, email_verified;
EOF

if [ $? -eq 0 ]; then
    print_status "✅ Migration applied successfully!"
    print_status "Your KubeBrowse application should now work with email verification."
    echo ""
    print_status "Next steps:"
    echo "1. Restart your application"
    echo "2. Configure SMTP settings in your environment variables"
    echo "3. Test user registration and email verification"
else
    print_error "❌ Migration failed!"
    print_error "Please check the error messages above and try again."
    exit 1
fi