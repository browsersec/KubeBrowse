FROM golang:1.24-alpine AS builder

WORKDIR /app

# Install dependencies for builder
RUN apk add --no-cache git make bash

COPY go.mod go.sum ./
RUN sed -i '/^tool github.com\/evilmartians\/lefthook/d' go.mod
RUN go mod download

# Copy all source files. Tilt live_update will handle incremental changes.
COPY . .

# Initial build of the application to /app/main
# This path must match what CMD expects and what Tilt's live_update rebuilds.
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o guac cmd/guac/main.go
# Original was: RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o guac cmd/guac/main.go
# The path ./api/main.go is from the Tiltfile configuration.

# Final stage for running the application
FROM alpine:3.20

# Install Go, bash, ca-certificates, and openssl.
# Go and bash are needed for Tilt's live_update run steps if they compile/run scripts.
RUN apk --no-cache add ca-certificates openssl go bash

WORKDIR /app

# Copy the built binary from the builder stage.
COPY --from=builder /app/guac /app/guac
# Copy templates (if your application uses them from filesystem at runtime)
# If templates are embedded in Go binary, this is not needed.
# Assuming ./templates exists and is used, based on original Dockerfile.
COPY --from=builder /app/templates /app/templates

# Create and copy certificates as before
RUN mkdir -p /app/certs
# COPY --from=builder /app/certs/ /app/certs/ # This line might not be needed if certs are always generated
RUN echo "Generating self-signed certificates..." && \
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
      -keyout /app/certs/private.key \
      -out /app/certs/certificate.crt \
      -subj "/C=US/ST=California/L=San Francisco/O=My Company/CN=mydomain.com"

ENV CERT_PATH=/app/certs/certificate.crt
ENV CERT_KEY_PATH=/app/certs/private.key
ENV GUACD_ADDRESS=guacd:4822 

EXPOSE 4567
CMD ["/app/guac"]
