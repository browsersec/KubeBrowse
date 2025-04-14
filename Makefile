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
# if certs do not exist, create them

# Install dependencies
deps:
	go mod tidy

# Install git hooks
hooks:
	@echo "Installing git hooks..."
	@mkdir -p .git/hooks
	@cp -f .githooks/pre-commit .git/hooks/pre-commit
	@chmod +x .git/hooks/pre-commit
	@echo "Git hooks installed successfully"

# Run pre-commit checks on all files
lint-all:
	@echo "Running pre-commit checks on all files..."
	@./.githooks/pre-commit --all

# Run pre-commit checks on staged files only
lint:
	@echo "Running pre-commit checks on staged files..."
	@./.githooks/pre-commit

# run the server 
run: deps
	@echo "Running server..."
	@echo "Using certs from $(CERT_PATH) and $(CERT_KEY_PATH)"
	@echo "Starting server..."
	CERT_PATH=./certs/certificate.crt CERT_KEY_PATH=./certs/private.key go run cmd/guac/guac.go

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
	go build -v -o guac cmd/guac/guac.go

# Setup development environment
setup: deps hooks
	@echo "Development environment setup complete"

help:
	go run cmd/guac/guac.go -h
	@echo ""
	@echo "Additional Make targets:"
	@echo "  deps         - Install dependencies"
	@echo "  hooks        - Install git hooks"
	@echo "  setup        - Set up development environment (deps + hooks)"
	@echo "  lint         - Run pre-commit checks on staged files"
	@echo "  lint-all     - Run pre-commit checks on all files"
	@echo "  test         - Run tests"
	@echo "  build        - Build the project"
	@echo "  generate     - Generate self-signed certificates"
	@echo "  generate_prod - Generate Let's Encrypt certificates"