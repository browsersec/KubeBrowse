# Database Migrations with golang-migrate

This project uses [golang-migrate/migrate](https://github.com/golang-migrate/migrate) for database migrations, which provides a robust and reliable way to manage database schema changes.

## Prerequisites

- Go 1.24+ installed
- PostgreSQL database running
- `DATABASE_URL` environment variable set

## Setup

### 1. Install golang-migrate

The migration script will automatically install golang-migrate if it's not available:

```bash
# Manual installation (if needed)
go install -tags 'postgres' github.com/golang-migrate/migrate/v4/cmd/migrate@latest
```

### 2. Set Database URL

Set the `DATABASE_URL` environment variable with your database connection string:

```bash
# For local development
export DATABASE_URL="postgres://postgres:password@localhost:5432/kubebrowse?sslmode=disable"

# For production (with SSL)
export DATABASE_URL="postgres://username:password@host:5432/dbname?sslmode=require"

# For Kubernetes/remote
export DATABASE_URL="postgres://postgresuser:password@postgres-service:5432/sandbox_db?sslmode=disable"
```

## Running Migrations

### Basic Usage

```bash
# Run all pending migrations
./scripts/migrate.sh

# Or manually using migrate command
migrate -path ./db/migrations -database "$DATABASE_URL" up
```

### Manual Migration Commands

```bash
# Check current version
migrate -path ./db/migrations -database "$DATABASE_URL" version

# Run specific number of migrations
migrate -path ./db/migrations -database "$DATABASE_URL" up 2

# Rollback specific number of migrations
migrate -path ./db/migrations -database "$DATABASE_URL" down 1

# Rollback all migrations
migrate -path ./db/migrations -database "$DATABASE_URL" down

# Force version (useful for fixing migration state)
migrate -path ./db/migrations -database "$DATABASE_URL" force VERSION

# Create new migration files
migrate create -ext sql -dir ./db/migrations -seq migration_name
```

## Migration Files

### File Naming Convention

Migrations follow the pattern: `{version}_{description}.{up|down}.sql`

- `000001_create_users_table.up.sql` - Creates the users table
- `000001_create_users_table.down.sql` - Removes the users table

### Current Migrations

1. **000001_create_users_table** - Initial user and session tables
   - `users` table with profile fields (username, name, avatar_url, etc.)
   - `user_sessions` table for authentication
   - Proper indexes for performance

### Creating New Migrations

```bash
# Create a new migration
migrate create -ext sql -dir ./db/migrations -seq add_user_preferences

# This creates:
# - 000002_add_user_preferences.up.sql
# - 000002_add_user_preferences.down.sql
```

### Example Migration Files

**000002_add_user_preferences.up.sql:**
```sql
CREATE TABLE user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  theme VARCHAR(20) DEFAULT 'system',
  language VARCHAR(10) DEFAULT 'en',
  notifications_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_preferences_user_id ON user_preferences(user_id);
```

**000002_add_user_preferences.down.sql:**
```sql
DROP TABLE IF EXISTS user_preferences;
```

## Best Practices

### 1. Always Create Down Migrations

Every migration should have a corresponding down migration that can reverse the changes.

### 2. Use Transactions

Wrap migrations in transactions when possible:

```sql
BEGIN;
-- Your migration SQL here
COMMIT;
```

### 3. Test Migrations

Always test both up and down migrations:

```bash
# Test up migration
migrate -path ./db/migrations -database "$DATABASE_URL" up 1

# Test down migration
migrate -path ./db/migrations -database "$DATABASE_URL" down 1
```

### 4. Version Control

- Commit migration files to version control
- Never modify existing migration files
- Create new migrations for schema changes

### 5. Database URLs

Use proper URL encoding for special characters in passwords:

```bash
# Example with special characters
export DATABASE_URL="postgres://user:pass%21%23%24@localhost:5432/db"
```

## Troubleshooting

### Common Issues

1. **Migration Already Applied**
   ```bash
   # Check current version
   migrate -path ./db/migrations -database "$DATABASE_URL" version
   
   # Force to specific version if needed
   migrate -path ./db/migrations -database "$DATABASE_URL" force VERSION
   ```

2. **Database Connection Issues**
   - Verify `DATABASE_URL` is correct
   - Ensure database is running and accessible
   - Check firewall and network settings

3. **Migration State Corrupted**
   ```bash
   # Reset migration state (WARNING: This will mark all migrations as applied)
   migrate -path ./db/migrations -database "$DATABASE_URL" force 1
   ```

### Logging

Enable verbose logging for debugging:

```bash
migrate -path ./db/migrations -database "$DATABASE_URL" up -verbose
```

## Integration with CI/CD

### GitHub Actions Example

```yaml
- name: Run Database Migrations
  env:
    DATABASE_URL: ${{ secrets.DATABASE_URL }}
  run: |
    chmod +x ./scripts/migrate.sh
    ./scripts/migrate.sh
```

### Docker Example

```dockerfile
# Install golang-migrate
RUN go install -tags 'postgres' github.com/golang-migrate/migrate/v4/cmd/migrate@latest

# Copy migrations
COPY db/migrations /app/migrations

# Run migrations
CMD ["migrate", "-path", "/app/migrations", "-database", "$DATABASE_URL", "up"]
```

## References

- [golang-migrate Documentation](https://github.com/golang-migrate/migrate)
- [PostgreSQL Driver](https://github.com/golang-migrate/migrate/tree/master/database/postgres)
- [Migration Best Practices](https://github.com/golang-migrate/migrate#best-practices)
