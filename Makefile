all: run

# check if the certs directory exists and .key and .crt files exist
ifneq ("$(wildcard certs)","")
	ifneq ("$(wildcard certs/private.key)","")
		ifneq ("$(wildcard certs/certificate.crt)","")
			CERTS_EXIST := true
		endif
	endif
endif
# if certs exist, set the cert path and key path
ifeq ($(CERTS_EXIST), true)
	CERT_PATH := "$(shell pwd)/certs/certificate.crt"
	CERT_KEY_PATH := "$(shell pwd)/certs/private.key"
else
	CERT_PATH := "$(shell pwd)/certs/certificate.crt"
	CERT_KEY_PATH := "$(shell pwd)/certs/private.key"
	bash ./certs/generate.sh
endif



# Install dependencies
deps:
	go mod tidy

# Install git hooks using lefthook
hooks:
	@echo "Installing git hooks using lefthook..."
	@if ! command -v lefthook &> /dev/null; then \
		echo "lefthook command not found. Please install lefthook: https://github.com/evilmartians/lefthook"; \
		exit 1; \
	fi
	@lefthook install
	@echo "Lefthook Git hooks installed successfully"

# Run pre-commit checks on all files using lefthook
lint-all:
	@echo "Running pre-commit checks on all files using lefthook..."
	@lefthook run pre-commit --all-files
	@echo "Pre-commit checks completed"

# Run pre-commit checks on staged files only using lefthook
lint:
	@echo "Running pre-commit checks on staged files using lefthook..."
	@lefthook run pre-commit --files $(git diff --name-only --cached)

# run the server 
run: deps
	@echo "Running server..."
	@echo "Using certs from $(CERT_PATH) and $(CERT_KEY_PATH)"
	@echo "Starting server..."
	CERT_PATH=./certs/certificate.crt CERT_KEY_PATH=./certs/private.key go run cmd/guac/main.go

run_frontend:
	@echo "Running frontend..."
	@echo "Starting frontend..."
	pnpm --dir frontend run dev 
	
generate:
	bash ./certs/generate.sh

# generate lets encrypt
generate_prod:
	sudo certbot certonly --standalone -d $(DOMAIN) --email $(EMAIL) --agree-tos --non-interactive
	@echo "Certs generated in /etc/letsencrypt/live/$(DOMAIN)/"
	@echo "Copying certs to certs directory..."
	sudo cp /etc/letsencrypt/live/$(DOMAIN)/fullchain.pem certs/prod/certificate.crt
	sudo cp /etc/letsencrypt/live/$(DOMAIN)/privkey.pem certs/prod/private.key

test:
	go test -race -v .

test_coverage:
	go test -race -coverprofile=coverage.out -v .
	go tool cover -html=coverage.out

build: deps
	go build -v -o guac cmd/guac/main.go

# Setup development environment
setup: deps hooks
	@echo "Development environment setup complete"

# Database migration targets using golang-migrate
migrate:
	@echo "Running database migrations using golang-migrate..."
	@if [ -z "$(DATABASE_URL)" ]; then \
		echo "❌ DATABASE_URL environment variable is not set"; \
		echo "Please set DATABASE_URL with your database connection string"; \
		echo "Example: export DATABASE_URL='postgres://username:password@localhost:5432/dbname?sslmode=disable'"; \
		exit 1; \
	fi
	@./scripts/migrate.sh

migrate-status:
	@echo "Checking migration status..."
	@if [ -z "$(DATABASE_URL)" ]; then \
		echo "❌ DATABASE_URL environment variable is not set"; \
		echo "Please set DATABASE_URL with your database connection string"; \
		exit 1; \
	fi
	@migrate -path ./db/migrations -database "$(DATABASE_URL)" version

migrate-create:
	@echo "Creating new migration..."
	@if [ -z "$(NAME)" ]; then \
		echo "❌ Migration name not specified"; \
		echo "Usage: make migrate-create NAME=migration_name"; \
		exit 1; \
	fi
	@migrate create -ext sql -dir ./db/migrations -seq $(NAME)

migrate-up:
	@echo "Running migrations up..."
	@if [ -z "$(DATABASE_URL)" ]; then \
		echo "❌ DATABASE_URL environment variable is not set"; \
		exit 1; \
	fi
	@migrate -path ./db/migrations -database "$(DATABASE_URL)" up

migrate-down:
	@echo "Rolling back migrations..."
	@if [ -z "$(DATABASE_URL)" ]; then \
		echo "❌ DATABASE_URL environment variable is not set"; \
		exit 1; \
	fi
	@migrate -path ./db/migrations -database "$(DATABASE_URL)" down

migrate-force:
	@echo "Forcing migration version..."
	@if [ -z "$(DATABASE_URL)" ] || [ -z "$(VERSION)" ]; then \
		echo "❌ DATABASE_URL and VERSION environment variables must be set"; \
		echo "Usage: make migrate-force DATABASE_URL='...' VERSION=1"; \
		exit 1; \
	fi
	@migrate -path ./db/migrations -database "$(DATABASE_URL)" force $(VERSION)

help:
	go run cmd/guac/main.go -h
	@echo ""
	@echo "Additional Make targets:"
	@echo "  deps         - Install dependencies"
	@echo "  hooks        - Install lefthook git hooks"
	@echo "  setup        - Set up development environment (deps + hooks)"
	@echo "  lint         - Run lefthook pre-commit checks on staged files"
	@echo "  lint-all     - Run lefthook pre-commit checks on all files"
	@echo "  test         - Run tests"
	@echo "  build        - Build the project"
	@echo "  generate     - Generate self-signed certificates"
	@echo "  generate_prod - Generate Let's Encrypt certificates"
	@echo ""
	@echo "Database Migration Commands (using golang-migrate):"
	@echo "  migrate      - Run all pending migrations"
	@echo "  migrate-status - Check current migration version"
	@echo "  migrate-create - Create new migration (NAME=migration_name)"
	@echo "  migrate-up   - Run migrations up"
	@echo "  migrate-down - Rollback migrations"
	@echo "  migrate-force - Force migration version (VERSION=1)"
	@echo ""
	@echo "Migration Examples:"
	@echo "  export DATABASE_URL='postgres://user:pass@localhost:5432/db?sslmode=disable'"
	@echo "  make migrate"
	@echo "  make migrate-create NAME=add_user_preferences"