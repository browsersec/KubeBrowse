### KubeBrowse
---

Secure browser-in-browser isolation platform powered by Kubernetes. KubeBrowse provides ephemeral sandboxed browsing environments accessed through your browser with no additional software. Each session runs in an isolated container with real-time threat analysis for uploaded files and automatic cleanup after timeout.

#### Features
- Containerized browser sessions for complete isolation
- Strict per-pod network isolation and automatic container cleanup after session timeout
- Scalable ingress using Istio for load balancing and mTLS
- Redis for caching session metadata and PostgreSQL for persistent user and session records
- Chrome Extension support to launch isolated browser or office-file sessions and import attachments directly from Gmail, WhatsApp, or Telegram with automatic threat analysis
- Distributed architecture with multi-region support


#### Architecture
