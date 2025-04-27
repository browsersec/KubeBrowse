# Build stage
FROM node:lts-slim AS build

WORKDIR /app

# Copy package.json first
COPY package.json ./
# Use npm install instead of npm ci since there's no package-lock.json
RUN npm install

# Copy the rest of the application code
COPY . .

# Build the application (default guacClient URL will be used unless overridden)
ARG GUAC_CLIENT_URL
ENV GUAC_CLIENT_URL=${GUAC_CLIENT_URL}
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy the built application from the build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Copy a custom nginx configuration if needed
# COPY ./nginx.conf /etc/nginx/conf.d/default.conf

# Add healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:80/ || exit 1

# Expose the port
EXPOSE 80

# Start nginx with daemon off to keep the container running
CMD ["nginx", "-g", "daemon off;"]
