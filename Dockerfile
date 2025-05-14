FROM golang:1.24-alpine AS builder

WORKDIR /app

# Install dependencies
RUN apk add --no-cache git make bash

# Copy go.mod and go.sum files
COPY go.mod go.sum ./

# Remove any tool directive referencing lefthook
RUN sed -i '/^tool github.com\/evilmartians\/lefthook/d' go.mod

# Download dependencies
RUN go mod download

# Copy source code
COPY . .

# Build the application from the correct path
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o guac cmd/guac/main.go

# Use a small image for the final container
FROM alpine:3.20

# Install ca-certificates and OpenSSL for HTTPS requests and certificate generation
RUN apk --no-cache add ca-certificates openssl

WORKDIR /app

# Create certificates directory
RUN mkdir -p /app/certs

# Copy the binary and supporting files from the builder stage
COPY --from=builder /app/templates /app/templates
COPY --from=builder /app/guac .

# Copy the certificate directory - this is safer than using wildcards with shell redirects
COPY --from=builder /app/certs/ /app/certs/

# Always generate self-signed certificates in the Dockerfile
# This ensures we have valid certificates regardless of what's copied
RUN echo "Generating self-signed certificates..." && \
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
      -keyout /app/certs/private.key \
      -out /app/certs/certificate.crt \
      -subj "/C=US/ST=California/L=San Francisco/O=My Company/CN=mydomain.com"

# Set environment variables
# Note: For production, consider using Docker secrets or environment variables at runtime
ENV CERT_PATH=/app/certs/certificate.crt 
ENV CERT_KEY_PATH=/app/certs/private.key
ENV GUACD_ADDRESS=guacd:4822

# Expose the correct port (from main.go)
EXPOSE 4567

# Command to run the correct binary
CMD ["./guac"]