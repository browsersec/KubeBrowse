import Keycloak from 'keycloak-js';

// Use environment variables for configuration, or fall back to defaults
// These would typically be set at build time or runtime via a config file or env vars.
// For VITE, use import.meta.env.VITE_KEYCLOAK_URL etc.
// Ensure these VITE_ variables are defined in your .env file for local dev
// and set up in your deployment environment.

const keycloakConfig = {
  url: import.meta.env.VITE_KEYCLOAK_URL || 'http://localhost:8080', // Local Keycloak URL if not set via env
  realm: import.meta.env.VITE_KEYCLOAK_REALM || 'kubebrowse-realm',
  clientId: import.meta.env.VITE_KEYCLOAK_FRONTEND_CLIENT_ID || 'kubebrowse-frontend',
};

const keycloak = new Keycloak(keycloakConfig);

export default keycloak;
