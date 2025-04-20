# Guacamole Web Client

This is a Go implementation of a web client for Apache Guacamole.

## Features

- HTTP and WebSocket tunneling
- Session management
- HTMX-powered connection form

## Usage

### Running the Server

```bash
go run cmd/guac/main.go
```

### Environment Variables

- `GUACD_ADDRESS`: Address of guacd (default: "127.0.0.1:4822")
- `CERT_PATH`: Path to TLS certificate
- `CERT_KEY_PATH`: Path to TLS key

### Endpoints

- `/connect`: HTMX form for generating connection query strings
- `/tunnel`: HTTP tunnel endpoint
- `/websocket-tunnel`: WebSocket tunnel endpoint
- `/sessions/`: Session management endpoint

### Connection Form

Visit http://localhost:4567/connect to access the connection form. This form allows you to:

1. Enter connection parameters (protocol, host, credentials, etc.)
2. Generate a query string for connecting to Guacamole
3. Connect directly via HTTP tunnel or WebSocket tunnel
