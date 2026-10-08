#!/bin/bash

# Kubernetes Migration Script for KubeBrowse
# This script applies database migrations in your Kubernetes cluster

set -e

NAMESPACE="browser-sandbox"
DB_SECRET_NAME="kubebrowse-secrets"
DB_SECRET_KEY="database-url"

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

# Check if kubectl is available
if ! command -v kubectl &> /dev/null; then
    print_error "kubectl is not installed or not in PATH"
    exit 1
fi

# Check if we can access the cluster
if ! kubectl cluster-info &> /dev/null; then
    print_error "Cannot connect to Kubernetes cluster"
    exit 1
fi

print_status "Applying email verification migration in Kubernetes..."

# Method 1: Run migration as a one-time job
run_migration_job() {
    print_status "Creating migration job..."
    
    # Create a temporary migration job
    cat << 'EOF' | kubectl apply -f -
apiVersion: batch/v1
kind: Job
metadata:
  name: kubebrowse-email-verification-migration
  namespace: browser-sandbox
spec:
  template:
    spec:
      restartPolicy: Never
      containers:
      - name: migrate
        image: postgres:15-alpine
        command:
        - /bin/sh
        - -c
        - |
          echo "Connecting to database..."
          psql "$DATABASE_URL" << 'EOSQL'
          -- Add email verification fields to users table
          ALTER TABLE users 
          ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE,
          ADD COLUMN IF NOT EXISTS email_verification_token VARCHAR(255),
          ADD COLUMN IF NOT EXISTS email_verification_expires_at TIMESTAMP;

          -- Create indexes for the new columns
          CREATE INDEX IF NOT EXISTS idx_users_email_verification_token ON users(email_verification_token);
          CREATE INDEX IF NOT EXISTS idx_users_email_verified ON users(email_verified);

          -- Set email_verified to TRUE for existing OAuth users
          UPDATE users 
          SET email_verified = TRUE 
          WHERE provider != 'email' OR provider IS NULL;

          -- Set email_verified to TRUE for existing email users (backward compatibility)
          UPDATE users 
          SET email_verified = TRUE 
          WHERE provider = 'email' AND (email_verified = FALSE OR email_verified IS NULL);

          -- Verify the migration
          SELECT 'Migration completed successfully!' as status;
          SELECT column_name, data_type FROM information_schema.columns 
          WHERE table_name = 'users' AND column_name LIKE '%email%';
          EOSQL
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: kubebrowse-secrets
              key: database-url
              optional: true
        - name: PGPASSWORD
          valueFrom:
            secretKeyRef:
              name: kubebrowse-secrets
              key: postgres-password
              optional: true
EOF

    print_status "Waiting for migration job to complete..."
    kubectl wait --for=condition=complete --timeout=300s job/kubebrowse-email-verification-migration -n "$NAMESPACE"
    
    print_status "Migration job completed. Checking logs..."
    kubectl logs job/kubebrowse-email-verification-migration -n "$NAMESPACE"
    
    print_status "Cleaning up migration job..."
    kubectl delete job kubebrowse-email-verification-migration -n "$NAMESPACE"
}

# Method 2: Run migration using existing pod
run_migration_in_pod() {
    print_status "Finding KubeBrowse pod..."
    
    # Find a running KubeBrowse pod
    POD_NAME=$(kubectl get pods -n "$NAMESPACE" -l app=browser-sandbox-api -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")
    
    if [ -z "$POD_NAME" ]; then
        print_error "No KubeBrowse pods found in namespace $NAMESPACE"
        return 1
    fi
    
    print_status "Using pod: $POD_NAME"
    print_status "Executing migration in pod..."
    
    kubectl exec -n "$NAMESPACE" "$POD_NAME" -- /bin/sh -c '
        echo "Running email verification migration..."
        
        # Check if we have psql available
        if command -v psql >/dev/null 2>&1; then
            echo "Using psql to run migration..."
            psql "$DATABASE_URL" << "EOSQL"
-- Add email verification fields to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS email_verification_token VARCHAR(255),
ADD COLUMN IF NOT EXISTS email_verification_expires_at TIMESTAMP;

-- Create indexes for the new columns
CREATE INDEX IF NOT EXISTS idx_users_email_verification_token ON users(email_verification_token);
CREATE INDEX IF NOT EXISTS idx_users_email_verified ON users(email_verified);

-- Set email_verified to TRUE for existing OAuth users
UPDATE users 
SET email_verified = TRUE 
WHERE provider != 'email' OR provider IS NULL;

-- Set email_verified to TRUE for existing email users (backward compatibility)
UPDATE users 
SET email_verified = TRUE 
WHERE provider = 'email' AND (email_verified = FALSE OR email_verified IS NULL);

-- Verify the migration
SELECT '\''Migration completed successfully!'\'' as status;
EOSQL
        else
            echo "psql not available in pod. Migration must be run externally."
            exit 1
        fi
    '
}

# Method 3: Direct database connection (if accessible)
run_direct_migration() {
    print_status "Attempting direct database migration..."
    
    # Try to get database URL from secret
    DB_URL=$(kubectl get secret "$DB_SECRET_NAME" -n "$NAMESPACE" -o jsonpath="{.data.$DB_SECRET_KEY}" 2>/dev/null | base64 -d || echo "")
    
    if [ -z "$DB_URL" ]; then
        print_warning "Cannot retrieve database URL from Kubernetes secret"
        return 1
    fi
    
    if command -v psql &> /dev/null; then
        print_status "Running migration with local psql..."
        psql "$DB_URL" -f apply_email_verification_migration.sql
    else
        print_warning "psql not available locally"
        return 1
    fi
}

# Main execution
main() {
    print_status "KubeBrowse Email Verification Migration"
    print_status "Namespace: $NAMESPACE"
    
    # Try different methods in order of preference
    if run_migration_job; then
        print_status "✅ Migration completed using Kubernetes job"
    elif run_migration_in_pod; then
        print_status "✅ Migration completed using existing pod"
    elif run_direct_migration; then
        print_status "✅ Migration completed using direct connection"
    else
        print_error "❌ All migration methods failed"
        echo ""
        print_status "Manual migration options:"
        echo "1. Apply the migration job: kubectl apply -f deployments/migration-job.yaml"
        echo "2. Run the SQL script directly: psql \$DATABASE_URL -f apply_email_verification_migration.sql"
        echo "3. Use the quick fix script: ./quick_fix_db.sh"
        exit 1
    fi
    
    print_status "🎉 Email verification migration completed successfully!"
    print_status "Your KubeBrowse application should now support email verification."
}

main "$@"