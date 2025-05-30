# KubeBrowse Helm Chart

## Description

A Helm chart for deploying KubeBrowse, a secure browsing and office sandbox environment. This chart bootstraps a KubeBrowse deployment on a Kubernetes cluster using the Helm package manager.

## Prerequisites

*   Kubernetes: `>= 1.20.0` (as a general guideline, adjust if specific versions are known)
*   Helm: `>= 3.2.0`
*   **Istio**: This chart assumes Istio is installed and configured on your cluster if you plan to use the Istio Gateway and VirtualService resources included. The Istio Operator CRDs should be present. If you manage Istio separately, ensure the `istio.gateway.selector` in `values.yaml` matches your Istio ingress gateway labels.
*   **Persistent Volume Provisioner**: If using persistence for PostgreSQL and MinIO (enabled by default), a dynamic persistent volume provisioner must be available in your cluster, or you must manually create PersistentVolumes.

## Installing the Chart

1.  **Add Repository** (if the chart is hosted in a Helm repository):
    ```bash
    helm repo add kubebrowse <YOUR_HELM_REPO_URL>
    helm repo update
    ```
    (Replace `<YOUR_HELM_REPO_URL>` with the actual repository URL. If installing from a local directory, this step is not needed.)

2.  **Create Namespace** (if it doesn't exist):
    The chart can create a namespace if `namespace.create` is true and `namespace.name` is set (default is `browser-sandbox`). Alternatively, you can create it manually:
    ```bash
    kubectl create namespace browser-sandbox
    ```

3.  **Install Chart**:
    To install the chart with the release name `my-kubebrowse` into the `browser-sandbox` namespace:
    ```bash
    helm install my-kubebrowse kubebrowse --namespace browser-sandbox
    ```
    If installing from a local path (e.g., you cloned the repository):
    ```bash
    helm install my-kubebrowse ./charts/kubebrowse --namespace browser-sandbox
    ```

## Uninstalling the Chart

To uninstall/delete the `my-kubebrowse` deployment:
```bash
helm uninstall my-kubebrowse --namespace browser-sandbox
```
The command removes all the Kubernetes components associated with the chart and deletes the release.

## Configuration

The following table lists the configurable parameters of the KubeBrowse chart and their default values. You can override these values using a custom `values.yaml` file or by specifying `--set` arguments during Helm installation.

For example:
```bash
helm install my-kubebrowse kubebrowse \
  --namespace browser-sandbox \
  --set postgres.credentials.password=MySecurePsqlPassword \
  --set istio.virtualservice.hosts[0]="kubebrowse.mydomain.com"
```

Or, with a `custom-values.yaml`:
```yaml
# custom-values.yaml
postgres:
  credentials:
    password: "MySecurePsqlPassword"
    username: "customuser"
istio:
  virtualservice:
    hosts:
      - "kubebrowse.mydomain.com"
  gateway:
    servers:
      - port:
          number: 443
          name: https
          protocol: HTTPS
        hosts:
          - "kubebrowse.mydomain.com"
        tls:
          mode: SIMPLE
          credentialName: "mydomain-tls-secret" # Ensure this secret exists with your cert
```
```bash
helm install my-kubebrowse kubebrowse -f custom-values.yaml --namespace browser-sandbox
```

### Key Parameters

| Parameter                                  | Description                                                                 | Default                                                                    |
|--------------------------------------------|-----------------------------------------------------------------------------|----------------------------------------------------------------------------|
| `nameOverride`                             | Override the chart name part of the fullname.                               | `""`                                                                       |
| `fullnameOverride`                         | Override the fully qualified app name.                                      | `""`                                                                       |
| `namespace.create`                         | Whether the chart should create the Kubernetes namespace.                   | `true`                                                                     |
| `namespace.name`                           | Name of the namespace to create if `namespace.create` is true.              | `browser-sandbox`                                                          |
| `serviceAccount.create`                    | Whether to create a service account for the application.                    | `true`                                                                     |
| `serviceAccount.name`                      | Name of the service account to use or create.                               | `browser-sandbox-sa`                                                       |
| `rbac.create`                              | Whether to create RBAC Role and RoleBinding.                                | `true`                                                                     |
|                                            |                                                                             |                                                                            |
| **PostgreSQL**                             |                                                                             |                                                                            |
| `postgres.replicaCount`                    | Number of PostgreSQL replicas.                                              | `1`                                                                        |
| `postgres.image.repository`                | PostgreSQL image repository.                                                | `postgres`                                                                 |
| `postgres.image.tag`                       | PostgreSQL image tag.                                                       | `15`                                                                       |
| `postgres.persistence.enabled`             | Enable PostgreSQL persistence using PersistentVolumeClaims.                 | `true` (implicitly, as it's a StatefulSet)                                 |
| `postgres.persistence.size`                | Size of the PersistentVolumeClaim for PostgreSQL.                           | `10Gi`                                                                     |
| `postgres.createSecret`                    | Whether the chart should create a new secret for PostgreSQL credentials.    | `true`                                                                     |
| `postgres.secretName`                      | Name of the Kubernetes secret for PostgreSQL credentials.                   | `postgres-secret`                                                          |
| `postgres.credentials.username`            | PostgreSQL username (used if `createSecret` is true).                       | `postgresuser`                                                             |
| `postgres.credentials.password`            | PostgreSQL password (used if `createSecret` is true).                       | `postgrespassword`                                                         |
| `postgres.dbName`                          | Name of the PostgreSQL database.                                            | `sandbox_db`                                                               |
|                                            |                                                                             |                                                                            |
| **Redis**                                  |                                                                             |                                                                            |
| `redis.replicaCount`                       | Number of Redis replicas.                                                   | `1`                                                                        |
| `redis.image.repository`                   | Redis image repository.                                                     | `redis`                                                                    |
| `redis.image.tag`                          | Redis image tag.                                                            | `alpine`                                                                   |
|                                            |                                                                             |                                                                            |
| **MinIO**                                  |                                                                             |                                                                            |
| `minio.replicaCount`                       | Number of MinIO replicas.                                                   | `1`                                                                        |
| `minio.image.repository`                   | MinIO image repository.                                                     | `minio/minio`                                                              |
| `minio.image.tag`                          | MinIO image tag.                                                            | `latest`                                                                   |
| `minio.persistence.enabled`                | Enable MinIO persistence using PersistentVolumeClaims.                      | `true`                                                                     |
| `minio.persistence.size`                   | Size of the PersistentVolumeClaim for MinIO.                                | `10Gi`                                                                     |
| `minio.createSecret`                       | Whether the chart should create a new secret for MinIO credentials.         | `true`                                                                     |
| `minio.secretName`                         | Name of the Kubernetes secret for MinIO credentials.                        | `minio-secret`                                                             |
| `minio.credentials.rootUser`               | MinIO root user (access key).                                               | `minioaccesskey`                                                           |
| `minio.credentials.rootPassword`           | MinIO root password (secret key).                                           | `miniosecretkey`                                                           |
| `minio.bucketName`                         | Default MinIO bucket name.                                                  | `browser-sandbox`                                                          |
|                                            |                                                                             |                                                                            |
| **API (KubeBrowse Backend)**               |                                                                             |                                                                            |
| `api.replicaCount`                         | Number of API server replicas.                                              | `1`                                                                        |
| `api.image.repository`                     | API image repository.                                                       | `ghcr.io/browsersec/kubebrowse`                                            |
| `api.image.tag`                            | API image tag.                                                              | `sha-101400e`                                                              |
| `api.service.type`                         | API service type.                                                           | `NodePort`                                                                 |
| `api.service.port`                         | API service port.                                                           | `4567`                                                                     |
| `api.service.nodePort`                     | API service NodePort (if type is NodePort).                                 | `30006`                                                                    |
|                                            |                                                                             |                                                                            |
| **Frontend (KubeBrowse UI)**               |                                                                             |                                                                            |
| `frontend.enabled`                         | Enable the KubeBrowse frontend.                                             | `true`                                                                     |
| `frontend.replicaCount`                    | Number of frontend replicas.                                                | `2`                                                                        |
| `frontend.image.repository`                | Frontend image repository.                                                  | `ghcr.io/browsersec/kubebrowse-frontend`                                   |
| `frontend.image.tag`                       | Frontend image tag.                                                         | `chore-improve-back`                                                       |
| `frontend.service.type`                    | Frontend service type.                                                      | `NodePort`                                                                 |
| `frontend.service.port`                    | Frontend service port.                                                      | `8000`                                                                     |
| `frontend.service.nodePort`                | Frontend service NodePort (if type is NodePort).                            | `30007`                                                                    |
| `frontend.env.VITE_GUAC_CLIENT_URL`        | External URL for Guacamole client (often API endpoint).                     | `""` (User must configure, e.g., `https://<your-host>/api`)                |
|                                            |                                                                             |                                                                            |
| **Istio Integration**                      |                                                                             |                                                                            |
| `istio.gateway.enabled`                    | Enable Istio Gateway resource creation.                                     | `true`                                                                     |
| `istio.gateway.servers[0].hosts[0]`        | Hostname for the HTTP Istio Gateway server.                                 | `sandbox.example.com`                                                      |
| `istio.gateway.servers[1].hosts[0]`        | Hostname for the HTTPS Istio Gateway server.                                | `sandbox.example.com`                                                      |
| `istio.gateway.servers[1].tls.credentialName` | Kubernetes secret name for TLS certificate for HTTPS.                    | `browser-sandbox-cert`                                                     |
| `istio.virtualservice.enabled`             | Enable Istio VirtualService resource creation.                              | `true`                                                                     |
| `istio.virtualservice.hosts[0]`            | Hostname for the VirtualService.                                            | `sandbox.example.com`                                                      |
|                                            |                                                                             |                                                                            |
| **ClamAV Components**                      |                                                                             |                                                                            |
| `clamd.enabled`                            | Enable ClamAV daemon (clamd).                                               | `true`                                                                     |
| `clamd.replicaCount`                       | Number of clamd replicas.                                                   | `1`                                                                        |
| `clamd.image.tag`                          | ClamAV image tag.                                                           | `stable`                                                                   |
| `clamvdApi.enabled`                        | Enable ClamAV Go API.                                                       | `true`                                                                     |
| `clamvdApi.replicaCount`                   | Number of ClamAV Go API replicas.                                           | `2`                                                                        |
| `clamvdApi.image.tag`                      | ClamAV Go API image tag.                                                    | `latest`                                                                   |
| `clamvdApi.config.clamdIp`                 | Internal address for clamd (auto-constructed).                              | `{{fullname}}-clamd.{{namespace}}.svc.cluster.local`                     |
| `clamvdApi.config.redisUrl`                | Internal address for Redis (auto-constructed).                              | `redis://{{fullname}}-redis.{{namespace}}.svc.cluster.local:{{redis-port}}` |

This is not an exhaustive list. Please refer to the `values.yaml` file for all available configuration options.
---
*This README is a starting point. You may need to adjust URLs, repository names, and specific instructions based on how and where the chart is hosted and used.*
