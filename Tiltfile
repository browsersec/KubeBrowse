# Tiltfile for kubebrowse
load('ext://restart_process', 'docker_build_with_restart')
allow_k8s_contexts("default")
print("Tilt starting up...")

# Local compilation for backend Go app
# local_resource(
#   'kubebrowse-compile',
#   '''
#   # Build Go binary
#   mkdir -p ./.tilt
#   CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o ./.tilt/guac cmd/guac/main.go
#   chmod +x ./.tilt/guac
#   ''',
#   deps=[
#     './api',
#     './cmd',
#     './internal',
#     './docs',
#     './go.mod',
#     './go.sum'
#   ],
#   dir='.'
# )

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

# Define Kubernetes resources - simplified to avoid object reference errors
k8s_resource(
    'browser-sandbox-api',
    port_forwards=['4567:4567'],
    pod_readiness='wait',
    labels=["api"]
)

# Define Kubernetes resources for frontend
# k8s_resource(
#     'browser-sandbox-frontend',
#     port_forwards=['3000:80'],
#     auto_init=False,
#     labels=["frontend"]
# )

# Update infrastructure resources to match what's available in the cluster
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