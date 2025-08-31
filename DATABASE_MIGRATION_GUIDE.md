# Database Migration Guide - Email Verification

## 🚨 Quick Fix for Current Error

You're getting this error because the database doesn't have the new email verification columns yet:
```
pq: column "email_verification_token" of relation "users" does not exist
```

## 🚀 Immediate Solutions

### Option 1: Quick Fix Script (Recommended)
```bash
# Run this script to immediately fix the issue
./quick_fix_db.sh
```

### Option 2: Kubernetes Migration
```bash
# If running in Kubernetes cluster
./k8s_migrate.sh
```

### Option 3: Manual SQL Execution
```bash
# Run the SQL script directly
psql "$DATABASE_URL" -f apply_email_verification_migration.sql
```

### Option 4: Direct SQL Commands
Connect to your database and run:
```sql
-- Add email verification fields
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS email_verification_token VARCHAR(255),
ADD COLUMN IF NOT EXISTS email_verification_expires_at TIMESTAMP;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_users_email_verification_token ON users(email_verification_token);
CREATE INDEX IF NOT EXISTS idx_users_email_verified ON users(email_verified);

-- Set existing users as verified (backward compatibility)
UPDATE users SET email_verified = TRUE WHERE provider != 'email' OR provider IS NULL;
UPDATE users SET email_verified = TRUE WHERE provider = 'email' AND (email_verified = FALSE OR email_verified IS NULL);
```

## 📋 Migration Methods

### 1. Using golang-migrate CLI

#### Install golang-migrate
```bash
# macOS
brew install golang-migrate

# Linux
curl -L https://github.com/golang-migrate/migrate/releases/latest/download/migrate.linux-amd64.tar.gz | tar xvz
sudo mv migrate /usr/local/bin/

# Go install
go install -tags 'postgres' github.com/golang-migrate/migrate/v4/cmd/migrate@latest
```

#### Run Migration
```bash
# Using our migration script
./migrate.sh up

# Or directly with migrate CLI
migrate -path db/migrations -database "$DATABASE_URL" up
```

### 2. Using Kubernetes Job

#### Apply Migration Job
```bash
kubectl apply -f deployments/migration-job.yaml
```

#### Check Job Status
```bash
kubectl get jobs -n browser-sandbox
kubectl logs job/kubebrowse-migration -n browser-sandbox
```

### 3. Using Docker

#### Run Migration Container
```bash
docker run --rm \
  -v $(pwd)/db/migrations:/migrations \
  -e DATABASE_URL="$DATABASE_URL" \
  migrate/migrate:v4.17.0 \
  -path /migrations \
  -database "$DATABASE_URL" \
  up
```

## 🔍 Verification

After running the migration, verify it worked:

```sql
-- Check new columns exist
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'users' 
  AND column_name IN ('email_verified', 'email_verification_token', 'email_verification_expires_at');

-- Check user verification status
SELECT provider, email_verified, COUNT(*) as user_count
FROM users 
GROUP BY provider, email_verified;
```

## 🐛 Troubleshooting

### Error: "relation users does not exist"
The initial migration hasn't been run. Run:
```bash
./migrate.sh up 1  # Apply first migration
./migrate.sh up    # Apply all migrations
```

### Error: "database is dirty"
The migration state is corrupted. Fix with:
```bash
./migrate.sh force 1  # Force to version 1
./migrate.sh up       # Apply remaining migrations
```

### Error: "permission denied"
Database user doesn't have ALTER TABLE permissions. Use a superuser or grant permissions:
```sql
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO your_user;
```

### Error: "connection refused"
Check your DATABASE_URL and ensure the database is accessible:
```bash
# Test connection
psql "$DATABASE_URL" -c "SELECT version();"
```

## 📁 Migration Files

### Created Files:
- `db/migrations/000002_add_email_verification.up.sql` - Add email verification
- `db/migrations/000002_add_email_verification.down.sql` - Remove email verification
- `apply_email_verification_migration.sql` - Standalone SQL script
- `migrate.sh` - Migration management script
- `quick_fix_db.sh` - Quick fix for immediate issue
- `k8s_migrate.sh` - Kubernetes-specific migration
- `deployments/migration-job.yaml` - Kubernetes migration job

### Migration Structure:
```
db/migrations/
├── 000001_create_users_table.up.sql
├── 000001_create_users_table.down.sql
├── 000002_add_email_verification.up.sql
└── 000002_add_email_verification.down.sql
```

## 🔄 Rollback

If you need to rollback the email verification migration:

```bash
# Using migration script
./migrate.sh down 1

# Using migrate CLI
migrate -path db/migrations -database "$DATABASE_URL" down 1

# Manual SQL
psql "$DATABASE_URL" << 'EOF'
DROP INDEX IF EXISTS idx_users_email_verification_token;
DROP INDEX IF EXISTS idx_users_email_verified;
ALTER TABLE users 
DROP COLUMN IF EXISTS email_verified,
DROP COLUMN IF EXISTS email_verification_token,
DROP COLUMN IF EXISTS email_verification_expires_at;
EOF
```

## 🚀 Production Deployment

### Pre-deployment Checklist:
1. ✅ Backup database
2. ✅ Test migration on staging
3. ✅ Verify application works after migration
4. ✅ Configure SMTP settings
5. ✅ Plan rollback strategy

### Deployment Steps:
1. Apply database migration
2. Deploy new application version
3. Configure email settings
4. Test email verification flow
5. Monitor for issues

## 📞 Support

If you encounter issues:
1. Check the error logs carefully
2. Verify database connectivity
3. Ensure proper permissions
4. Try the quick fix script first
5. Use the troubleshooting section above

## 🎯 Next Steps

After migration is complete:
1. Restart your application
2. Configure SMTP environment variables
3. Test user registration and email verification
4. Monitor email delivery and verification rates