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
	bun --dir frontend run dev

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

# MkDocs documentation targets
docs-setup:
	pip install mkdocs mkdocs-material

docs-serve:
	mkdocs serve

docs-build:
	mkdocs build

# Setup development environment
setup: deps hooks
	@echo "Development environment setup complete"

KIND_CLUSTER ?= kubebrowse-cluster
ARCH := $(shell uname -m)
ifeq ($(ARCH),x86_64)
  PLATFORM := linux/amd64
else ifeq ($(ARCH),arm64)
  PLATFORM := linux/arm64
else
  PLATFORM := linux/$(ARCH)
endif
CHROMIUM_IMAGE := ghcr.io/browsersec/rdp-chromium:latest
OFFICE_IMAGE := ghcr.io/browsersec/rdp-onlyoffice-lxde:latest

# Load chromium image into KIND
load-chromium:
	@echo "Pulling $(CHROMIUM_IMAGE)..."
	docker pull --platform $(PLATFORM) $(CHROMIUM_IMAGE)
	@echo "Loading $(CHROMIUM_IMAGE) into KIND cluster $(KIND_CLUSTER)..."
	docker save $(CHROMIUM_IMAGE) -o /tmp/chromium.tar
	kind load image-archive /tmp/chromium.tar --name $(KIND_CLUSTER)
	@rm -f /tmp/chromium.tar
	@echo "Chromium image loaded."

# Load onlyoffice image into KIND
load-office:
	@echo "Pulling $(OFFICE_IMAGE)..."
	docker pull --platform $(PLATFORM) $(OFFICE_IMAGE)
	@echo "Loading $(OFFICE_IMAGE) into KIND cluster $(KIND_CLUSTER)..."
	docker save $(OFFICE_IMAGE) -o /tmp/onlyoffice.tar
	kind load image-archive /tmp/onlyoffice.tar --name $(KIND_CLUSTER)
	@rm -f /tmp/onlyoffice.tar
	@echo "Onlyoffice image loaded."

# Load all sandbox images into KIND
load-images: load-chromium load-office

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
	@echo "  docs-setup   - Install MkDocs and Material theme via pip"
	@echo "  docs-serve   - Serve documentation locally"
	@echo "  docs-build   - Build documentation into static files"
	@echo "  load-images  - Pull all sandbox images from GHCR and load into KIND"
	@echo "  load-chromium - Pull and load chromium image into KIND"
	@echo "  load-office  - Pull and load onlyoffice image into KIND"
	@echo "  generate     - Generate self-signed certificates"
	@echo "  generate_prod - Generate Let's Encrypt certificates"
