-- Migration: Add email verification fields to users table
-- This migration adds email verification functionality to existing users table

-- Add new columns for email verification
ALTER TABLE users
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS email_verification_token VARCHAR(255),
ADD COLUMN IF NOT EXISTS email_verification_expires_at TIMESTAMPTZ;

-- Enforce non-nullable verified flag
ALTER TABLE users
  ALTER COLUMN email_verified SET NOT NULL;

-- Create indexes for the new columns
CREATE INDEX IF NOT EXISTS idx_users_email_verification_token ON users(email_verification_token);
CREATE INDEX IF NOT EXISTS idx_users_email_verified ON users(email_verified);

-- Set email_verified to TRUE for existing OAuth users (they don't need email verification)
UPDATE users 
SET email_verified = TRUE 
WHERE provider != 'email' OR provider IS NULL;

-- Set email_verified to TRUE for existing email users (backward compatibility)
-- In production, you might want to require re-verification instead
UPDATE users 
SET email_verified = TRUE 
WHERE provider = 'email' AND email_verified = FALSE;