# Build stage
FROM node:lts-slim AS build

# Install bun globally
RUN npm install -g bun

WORKDIR /app

# Copy package.json, bun.lockb, and other relevant config files first
COPY package.json bun.lockb* vite.config.js tailwind.config.js postcss.config.js ./
# If other config files (tsconfig.json, etc.) are needed for build, copy them too.

# Install dependencies using bun
RUN bun install --frozen-lockfile

# Copy the rest of the application source code
COPY . .

# Build the application with GUAC_CLIENT_URL as an empty string for relative paths
ARG GUAC_CLIENT_URL=""
ENV GUAC_CLIENT_URL=${GUAC_CLIENT_URL}
RUN bun run build

# Production stage (Caddy)
FROM caddy:alpine

# Copy the Caddyfile
COPY Caddyfile /etc/caddy/Caddyfile

# Copy the built application from the build stage to Caddy's default static file directory /srv
COPY --from=build /app/dist /srv

# Caddy's default port is 80. EXPOSE 80 is handled by the base caddy image.
# Default CMD for caddy image runs Caddy.
