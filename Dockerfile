FROM golang:1.23-alpine AS builder

WORKDIR /app

# Install dependencies
RUN apk add --no-cache git make

# Copy go.mod and go.sum files
COPY go.mod go.sum ./

# Download dependencies
RUN go mod download

# Copy source code
COPY . .

# Build the application from the correct path
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o guac cmd/guac/guac.go

# Use a small image for the final container
FROM alpine:3.17

# Install ca-certificates for HTTPS requests
RUN apk --no-cache add ca-certificates

WORKDIR /root/

# Create certificates directory
RUN mkdir -p /root/certs

# Copy the binary from the builder stage
COPY --from=builder /app/templates /root/templates
COPY --from=builder /app/guac .
COPY --from=builder /app/certs /root/certs

# Set environment variables for certificates
ENV CERT_PATH=/root/certs/certificate.crt
ENV CERT_KEY_PATH=/root/certs/private.key

# Expose the correct port (from guac.go)
EXPOSE 4567

# Command to run the correct binary
CMD ["./guac"]