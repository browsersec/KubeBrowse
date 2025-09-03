-- Run this script against your database to add email verification support

-- Add email verification fields to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS email_verification_token VARCHAR(255),
ADD COLUMN IF NOT EXISTS email_verification_expires_at TIMESTAMP;

-- Create indexes for the new columns
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_verification_token
  ON users(email_verification_token)
  WHERE email_verification_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_email_verified ON users(email_verified);

-- Set email_verified to TRUE for existing OAuth users (they don't need email verification)
UPDATE users 
SET email_verified = TRUE 
WHERE provider != 'email' OR provider IS NULL;

-- Set email_verified to TRUE for existing email users (backward compatibility)
-- In production, you might want to require re-verification instead
UPDATE users 
SET email_verified = TRUE 
WHERE provider = 'email' AND (email_verified = FALSE OR email_verified IS NULL);

-- Verify the changes
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns 
WHERE table_name = 'users' 
    AND column_name IN ('email_verified', 'email_verification_token', 'email_verification_expires_at')
ORDER BY column_name;