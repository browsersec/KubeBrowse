# Tiltfile for kubebrowse

print("Tilt starting up...")

# Backend API (Go)
# Assumes Dockerfile will be updated to have WORKDIR /app
# and necessary Go build tools.
docker_build(
    'ghcr.io/browsersec/kubebrowse',  # Image name from k8s deployment
    '.',  # Context for the build
    dockerfile='Dockerfile', # Path to the Dockerfile for the backend
    live_update=[
        sync('./api', '/app/api'),
        sync('./cmd', '/app/cmd'),
        sync('./internal', '/app/internal'),
        sync('./go.mod', '/app/go.mod'),
        sync('./go.sum', '/app/go.sum'),
        # This run step rebuilds the Go binary in the container.
        # Tilt detects the change and updates the Kubernetes pod.
        run(
            command='go build -v -o /app/main ./api/main.go', # Build Go binary
            trigger=['./api/**/*.go', './cmd/**/*.go', './internal/**/*.go', 'go.mod', 'go.sum'],
            workdir='/app' # Assumes WORKDIR /app in Dockerfile
        )
    ]
)

# Frontend (React/Vite)
# This setup serves static files with Caddy. For HMR, Dockerfile & CMD would need to change.
docker_build(
    'ghcr.io/browsersec/kubebrowse-frontend', # Image name from k8s deployment
    './frontend',  # Context for the build
    dockerfile='./frontend/Dockerfile', # Path to the Dockerfile for the frontend
    live_update=[
        sync('./frontend/src', '/app/src'),
        sync('./frontend/public', '/app/public'),
        sync('./frontend/index.html', '/app/index.html'),
        sync('./frontend/vite.config.js', '/app/vite.config.js'),
        sync('./frontend/tailwind.config.js', '/app/tailwind.config.js'),
        sync('./frontend/package.json', '/app/package.json'),
        sync('./frontend/bun.lockb', '/app/bun.lockb'), # Assuming bun is used
        # If package.json or lock file changes, reinstall dependencies and rebuild static assets.
        run(
            command='bun install && bun run build',
            trigger=['./frontend/package.json', './frontend/bun.lockb'],
            workdir='/app' # Matches WORKDIR in frontend Dockerfile
        )
    ]
)

# Load Kubernetes manifests
# Tilt will find the 'browser-sandbox' namespace from here.
k8s_yaml(['./deployments/manifest.yml'])

# Define Kubernetes resources Tilt should manage and forward ports for.
# Names must match 'kind/metadata.name' from the YAML.
k8s_resource(
    'deployment/browser-sandbox-api',
    namespace='browser-sandbox', # Explicit namespace
    port_forwards=['4567:4567']  # local_port:pod_port for the API
)

k8s_resource(
    'deployment/browser-sandbox-frontend',
    namespace='browser-sandbox', # Explicit namespace
    port_forwards=['3000:80']    # local_port:pod_port for the frontend (Caddy serves on 80)
)

# --- Tilt Settings ---
# This setting helps Tilt update images in k8s, especially for local clusters.
# For non-local clusters or if image pushes are handled by a CI/CD pipeline for dev images,
# this might need adjustment or a default_registry() setting.
update_mode(UPDATE_MODE_AUTO, pod_readiness_timeout=300) # Auto update k8s resources, wait up to 5m for pods.

# IMPORTANT: If Tilt cannot detect your Kubernetes cluster or has issues deploying,
# you may need to specify your kubectl context.
# Example: allow_k8s_contexts('kind-kind', 'docker-desktop', 'minikube')
# Run `kubectl config current-context` to find your current context name.
# For now, we'll rely on the default context. Add `allow_k8s_contexts` if needed.

print("Tiltfile configured. Dockerfiles will be reviewed in the next step.")
print("Run `tilt up` to start. If you have issues, `tilt doctor` can help diagnose.")
