// Base URL for backend REST API calls.
// In production (e.g. Cloudflare Pages) set VITE_API_BASE_URL to the backend origin,
// e.g. https://api.kubebrowse.example.com or https://kubebrowse-tunnel.pages.dev
//
// For local dev with an HTTP backend, set VITE_API_BASE_URL=http://localhost:4567
// and run `npm run dev` (HTTP dev server).
export const API_BASE = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

// Derive WebSocket / HTTP tunnel bases from the same origin so they stay in sync.
const apiUrl = API_BASE ? new URL(API_BASE) : null;

export const WS_BASE = apiUrl
  ? `${apiUrl.protocol === "https:" ? "wss" : "ws"}://${apiUrl.host}`
  : `${window.location.protocol === "https:" ? "wss" : "ws"}://${location.host}`;

export const HTTP_TUNNEL_BASE = apiUrl
  ? `${apiUrl.protocol}//${apiUrl.host}`
  : `${window.location.protocol}//${location.host}`;
