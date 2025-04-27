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

WORKDIR /root/

# Create certificates directory
RUN mkdir -p /root/certs

# Copy the binary and supporting files from the builder stage
COPY --from=builder /app/templates /root/templates
COPY --from=builder /app/guac .

# Copy certificate generation script to generate certs if needed
COPY certs/generate.sh /root/
RUN chmod +x /root/generate.sh

# Copy existing certificates if available
COPY --from=builder /app/certs/ /root/certs/

# Generate self-signed certificates if they don't exist
RUN if [ ! -f "/root/certs/certificate.crt" ] || [ ! -f "/root/certs/private.key" ]; then \
      echo "Generating self-signed certificates..."; \
      cd /root && ./generate.sh; \
    fi

# Set environment variables
ENV CERT_PATH=/root/certs/certificate.crt
ENV CERT_KEY_PATH=/root/certs/private.key
ENV GUACD_ADDRESS=guacd:4822

# Expose the correct port (from main.go)
EXPOSE 4567

# Command to run the correct binary
CMD ["./guac"]