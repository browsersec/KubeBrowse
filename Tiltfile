# Tiltfile for kubebrowse
load('ext://restart_process', 'docker_build_with_restart')
allow_k8s_contexts("default")
print("Tilt starting up...")

# Backend API (Go) with restart support - include all necessary files
docker_build_with_restart(
    'ghcr.io/browsersec/kubebrowse',
    '.',
    dockerfile='Dockerfile',
    entrypoint='/app/guac',
    only=[
        './.tilt/guac',
        './templates',
        './certs',
        './go.mod',
        './go.sum',
        './api',
        './cmd',
        './internal',
        './docs',
        './db',
        './sqlc.yaml'
    ],
    live_update=[
        sync('./.tilt/guac', '/app/guac'),
        sync('./templates', '/app/templates'),
        run('chmod +x /app/guac')  # Ensure binary is executable
    ]
)

# Frontend (optional dev build) - uses Caddyfile.dev via build arg
# Build only when needed; does not deploy any k8s resources here
docker_build(
    'ghcr.io/browsersec/kubebrowse-frontend',
    './frontend',
    dockerfile='frontend/Dockerfile',
    build_args={'CADDYFILE': 'Caddyfile.dev'},
    ignore=['frontend/dist']
)

# Clean up dangling images and build cache periodically
local_resource(
    'docker-cleanup',
    cmd='docker system prune -f --volumes && docker image prune -f',
    deps=[],
    resource_deps=['browser-sandbox-api'],
    trigger_mode=TRIGGER_MODE_MANUAL,
    auto_init=False
)

# Load Kubernetes manifests
k8s_yaml([
  './deployments/manifest.yml',
], allow_duplicates=True)

# Add PostgreSQL port forward for local database access
k8s_resource(
    'postgres',
    port_forwards=['5432:5432'],
    labels=["database"],
    auto_init=False
)

# Add Redis port forward for local development
k8s_resource(
    'redis',
    port_forwards=['6379:6379'],
    labels=["database"],
    auto_init=False
)

# Define Kubernetes resources - simplified to avoid object reference errors
k8s_resource(
    'browser-sandbox-api',
    port_forwards=['4567:4567'],
    pod_readiness='wait',
    labels=["api"]
)

# Infrastructure resources - simplified to avoid object reference issues
k8s_resource(
    objects=[
        'browser-sandbox:Namespace:default',
        'minio-pvc:PersistentVolumeClaim:browser-sandbox',
        'sandbox-instances:Service:browser-sandbox'
    ],
    new_name='infrastructure-services'
)

# Update permissions resources to match what's available in the cluster
k8s_resource(
    objects=[
        'browser-sandbox-sa:ServiceAccount:browser-sandbox',
        'pod-manager:Role:browser-sandbox',
        'pod-manager-binding:RoleBinding:browser-sandbox',
        'postgres-secret:Secret:browser-sandbox',
        'minio-secret:Secret:browser-sandbox'
    ],
    new_name='permissions-and-secrets'
)

print("Tiltfile configured successfully.")
print("Run `tilt up` to start the development environment.")
print("For cleanup, trigger the docker-cleanup resource manually with: tilt trigger docker-cleanup")
print("")
print("Database Access:")
print("- PostgreSQL: localhost:5432 (postgresuser/postgrespassword)")
print("- Redis: localhost:6379")
print("- API: localhost:4567")
print("")
print("To run migrations locally:")
print("export DATABASE_URL='postgres://postgresuser:postgrespassword@localhost:5432/sandbox_db?sslmode=disable'")
print("make migrate")