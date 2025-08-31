-- Add email verification fields to users table
ALTER TABLE users 
ADD COLUMN email_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN email_verification_token VARCHAR(255),
ADD COLUMN email_verification_expires_at TIMESTAMP;

-- Create indexes for the new columns
CREATE INDEX idx_users_email_verification_token ON users(email_verification_token);
CREATE INDEX idx_users_email_verified ON users(email_verified);

-- Set email_verified to TRUE for existing OAuth users (they don't need email verification)
UPDATE users 
SET email_verified = TRUE 
WHERE provider != 'email' OR provider IS NULL;

-- Set email_verified to TRUE for existing email users (backward compatibility)
-- In production, you might want to require re-verification instead
UPDATE users 
SET email_verified = TRUE 
WHERE provider = 'email' AND email_verified = FALSE;