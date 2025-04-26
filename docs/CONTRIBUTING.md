*---
label: Contributing to KubeBrowse
icon:  book
order: 800
---

# Contributing to KubeBrowse

Thank you for your interest in contributing to GUAC! This document provides guidelines and instructions for contributing to this project.

## Table of Contents

- [Contributing to KubeBrowse](#contributing-to-kubebrowse)
  - [Table of Contents](#table-of-contents)
  - [Code of Conduct](#code-of-conduct)
  - [Getting Started](#getting-started)
    - [Development Environment Setup](#development-environment-setup)
  - [Working with Database Migrations](#working-with-database-migrations)
    - [Creating a New Migration](#creating-a-new-migration)
    - [Applying Migrations](#applying-migrations)
    - [Project Structure](#project-structure)
  - [Development Workflow](#development-workflow)
    - [Branching Strategy](#branching-strategy)
    - [Commit Guidelines](#commit-guidelines)
    - [Pre-commit Hooks](#pre-commit-hooks)
  - [Pull Requests](#pull-requests)
    - [PR Process](#pr-process)
    - [PR Requirements](#pr-requirements)
  - [Coding Standards](#coding-standards)
    - [Go Guidelines](#go-guidelines)
    - [Testing](#testing)
    - [Documentation](#documentation)
  - [Release Process](#release-process)

## Code of Conduct

We are committed to fostering a welcoming community. Please read and adhere to our [Code of Conduct](CODE_OF_CONDUCT.md) in all interactions.

## Getting Started

### Development Environment Setup

1. **Fork and clone the repository**

   ```bash
   git clone https://github.com/browsersec/KubeBrowse.git
   cd KubeBrowse
   ```

2. **Set up the development environment**

   ```bash
   # Install dependencies and Git hooks
   make setup
   ```

3. **Run the application**

   ```bash
   make run
   ```

4. **Access the application**

   - Open a browser and navigate to `http://localhost:4567/connect`


5. **Install required tools:**

   ```bash
   # Install golang-migrate
   go install -tags 'postgres' github.com/golang-migrate/migrate/v4/cmd/migrate@latest

   # Install sqlc
   go install github.com/sqlc-dev/sqlc/cmd/sqlc@latest

   # Install lefthook (for Git hooks)
   go install github.com/evilmartians/lefthook/v1/cmd/lefthook@latest
   ```

6. **Set up your local database:**

   ```bash
   docker compose up -d
   ```

## Working with Database Migrations

We use [golang-migrate](https://github.com/golang-migrate/migrate) to manage database schema changes.

### Creating a New Migration

```bash
migrate create -ext sql -dir db/migrations -seq migration_name
```

This will create two files:
- `db/migrations/NNNNNN_migration_name.up.sql` - Contains the changes to apply
- `db/migrations/NNNNNN_migration_name.down.sql` - Contains the SQL to revert the changes
- `db/migrations/NNNNNN_migration_name.sql` - Contains the SQL to apply and revert the changes

### Applying Migrations

```bash
# Apply all pending migrations
migrate -path db/migrations -database "postgresql://username:password@localhost:5432/database_name?sslmode=disable" up

# Revert last migration
migrate -path db/migrations -database "postgresql://username:password@localhost:5432/database_name?sslmode=disable" down 1

# Revert all migrations
migrate -path db/migrations -database "postgresql://username:password@localhost:5432/database_name?sslmode=disable" down
```

### Project Structure

- `/cmd/guac/` - Main application entry point
- `/utils/` - Utility functions
- `/certs/` - Certificate files for TLS
- `/.githooks/` - Git hooks for development



## Development Workflow

### Branching Strategy

- `main` - Stable branch containing the latest release
- `dev` - Development branch for integrating features
- Feature branches should be created from `dev` and named using the format: `feature/short-description` or `fix/issue-description`

### Commit Guidelines

We follow [Conventional Commits](https://www.conventionalcommits.org/) for commit messages:

```
<type>(<scope>): <description>

<body>

<footer>
```

Types include:
- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code changes that neither fix bugs nor add features
- `test`: Adding or modifying tests
- `chore`: Changes to the build process or auxiliary tools

Example:
```
feat(api): add endpoint for user authentication

- Implement JWT token generation
- Add middleware for token validation

Fixes #123
```

### Pre-commit Hooks

This project uses [Lefthook](https://github.com/evilmartians/lefthook) for managing Git hooks to ensure code quality. The pre-commit hook checks:

- Code formatting
- Static analysis
- Linting
- Tests
- Potential secrets

Install the hooks with:
```bash
make hooks
```

You can manually run the pre-commit checks:
```bash
# Check only staged files
make lint

# Check all files in the repository
make lint-all
```

If Lefthook is not found, you'll be prompted to install it. Lefthook hooks are automatically installed when you run `make setup`.

## Pull Requests

### PR Process

1. Create a new branch from `dev`
2. Implement your changes
3. Ensure tests pass and code meets quality standards
4. Push your branch and create a pull request against `dev`
5. Address any feedback from reviewers

### PR Requirements

- PRs must have a clear description of changes
- All tests must pass
- Code must be properly formatted
- Documentation must be updated if necessary
- Changes should be covered by tests

## Coding Standards

### Go Guidelines

- Follow the [Go Code Review Comments](https://github.com/golang/go/wiki/CodeReviewComments)
- Use the standard Go formatting (`gofmt`)
- Write idiomatic Go code
- Keep functions small and focused
- Add comments for exported functions, types, and packages

### Testing

- Write tests for all new features and bug fixes
- Aim for high test coverage, especially for critical paths
- Use table-driven tests when appropriate
- Run tests with `make test`

### Documentation

- Document all exported functions, types, and packages
- Update the README.md if adding new features or changing existing functionality
- Add examples for complex features

## Release Process

1. Create a release branch from `dev`
2. Update version information
3. Run comprehensive tests
4. Merge to `main` once approved
5. Tag the release with the version number
6. Update documentation with release notes

Thank you for contributing to GUAC!
*