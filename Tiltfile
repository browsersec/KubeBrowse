# Tiltfile for kubebrowse

print("Tilt starting up...")

# Backend API (Go)
docker_build(
    'ghcr.io/browsersec/kubebrowse',
    '.',
    dockerfile='Dockerfile',
    live_update=[
        sync('./api', '/app/api'),
        sync('./cmd', '/app/cmd'),
        sync('./internal', '/app/internal'),
        sync('./go.mod', '/app/go.mod'),
        sync('./go.sum', '/app/go.sum'),
        run(
            'cd /app && go build -v -o /app/main ./api/main.go',
            trigger=['./api', './cmd', './internal', 'go.mod', 'go.sum']
        )
    ]
)

# Frontend (React/Vite)
docker_build(
    'ghcr.io/browsersec/kubebrowse-frontend',
    './frontend',
    dockerfile='./frontend/Dockerfile',
    live_update=[
        sync('./frontend/src', '/app/src'),
        sync('./frontend/public', '/app/public'),
        sync('./frontend/index.html', '/app/index.html'),
        sync('./frontend/vite.config.js', '/app/vite.config.js'),
        sync('./frontend/tailwind.config.js', '/app/tailwind.config.js'),
        sync('./frontend/package.json', '/app/package.json'),
        sync('./frontend/bun.lockb', '/app/bun.lockb'),
        run(
            'cd /app && bun install',
            trigger=['./frontend/package.json', './frontend/bun.lockb']
        ),
        run(
            'cd /app && bun run build',
            trigger=['./frontend/src', './frontend/public', './frontend/index.html', './frontend/vite.config.js', './frontend/tailwind.config.js']
        )
    ]
)

# Load Kubernetes manifests.
k8s_yaml([
  './deployments/manifest.yml',
], allow_duplicates=True)

# Define Kubernetes resources for Tilt to manage.
# The resource name must exactly match 'metadata.name' from your manifest.
# Namespace is inferred from the manifest, and pod readiness uses a default timeout.
k8s_resource(
    'browser-sandbox-api',
    port_forwards=['4567:4567']
)

k8s_resource(
    'browser-sandbox-frontend',
    port_forwards=['3000:80']
)

print("Tiltfile configured successfully.")
print("This version should be compatible with your older Tilt installation.")
print("Run `tilt up` to start the development environment.")