# Local Development with Tilt

This document describes how to use Tilt for local development of the Kubebrowse project on Kubernetes. Tilt provides a streamlined workflow with live updates, automated builds, and easy resource management.

## Prerequisites

1.  **Docker**: Ensure Docker is installed and running. Tilt uses Docker to build container images. (https://docs.docker.com/get-docker/)
2.  **Kubernetes Cluster**: You need a local Kubernetes cluster. Options include:
    *   [Kind (Kubernetes IN Docker)](https://kind.sigs.k8s.io/docs/user/quick-start/)
    *   [Minikube](https://minikube.sigs.k8s.io/docs/start/)
    *   Docker Desktop's built-in Kubernetes cluster.
    Ensure your `kubectl` context is pointing to your local development cluster (`kubectl config current-context`).
3.  **Tilt**: Install Tilt by following the instructions on the official Tilt website: [Install Tilt](https://docs.tilt.dev/install.html)

## Getting Started

1.  **Clone the Repository**:
    If you haven't already, clone the project repository:
    ```bash
    git clone <repository-url>
    cd <repository-directory>
    ```

2.  **Configure Kubernetes Context (if needed)**:
    The `Tiltfile` attempts to use your current Kubernetes context. If Tilt has trouble connecting or you need to specify a context:
    *   Uncomment and modify the `allow_k8s_contexts` line in the `Tiltfile` at the root of the project. For example:
        ```python
        # allow_k8s_contexts('kind-kind', 'docker-desktop')
        ```
    *   Replace `'kind-kind'` or `'docker-desktop'` with the name of your `kubectl` context.

3.  **Start Tilt**:
    Navigate to the root directory of the project in your terminal and run:
    ```bash
    tilt up
    ```
    Tilt will:
    *   Build the container images for the frontend and backend services.
    *   Deploy all resources defined in `deployments/manifest.yml` to your Kubernetes cluster.
    *   Set up port forwarding for accessing the services locally:
        *   Backend API (`browser-sandbox-api`): `localhost:4567`
        *   Frontend (`browser-sandbox-frontend`): `localhost:3000`
    *   Open a web browser with the Tilt UI, where you can monitor the status of your services, view logs, and manage resources.

4.  **Accessing the Application**:
    *   Frontend: Open your browser and go to `http://localhost:3000`
    *   API: Accessible at `http://localhost:4567`

## Development Workflow

*   **Live Updates**:
    *   **Backend (Go)**: When you save changes to Go files in the `./api`, `./cmd`, or `./internal` directories, Tilt will automatically sync the changes to the running container, rebuild the Go application, and restart the pod.
    *   **Frontend (Vite/React)**: When you save changes to files in the `./frontend/src` directory (or other relevant frontend paths like `index.html`, `package.json`), Tilt will sync the files.
        *   If `package.json` or `bun.lockb` changes, dependencies will be reinstalled, and static assets will be rebuilt.
        *   Caddy will serve the updated static files. You may need to refresh your browser to see these changes.
        *(Note: For a Hot Module Replacement (HMR) experience with Vite, the frontend Dockerfile's CMD and Tiltfile's port-forwarding would need to be adjusted to use Vite's dev server directly.)*

*   **Logs**: View real-time logs for each service in the Tilt UI.

*   **Resource Management**: The Tilt UI allows you to manually trigger updates, restart pods, and view Kubernetes resource details.

## Stopping Tilt

*   To stop Tilt and remove the deployed resources from your Kubernetes cluster, press `Ctrl+C` in the terminal where `tilt up` is running.
*   Alternatively, you can use `tilt down`.

## Troubleshooting

*   **`tilt doctor`**: Run `tilt doctor` in your terminal. This command checks your Tilt and Kubernetes setup and provides suggestions for fixing common issues.
*   **Kubernetes Context**: Ensure `kubectl config current-context` points to the correct local cluster. If not, use `kubectl config use-context <your-local-cluster-context>`.
*   **Image Pull Issues**: If Kubernetes has trouble pulling images, ensure your `imagePullPolicy` in `deployments/manifest.yml` is `IfNotPresent` for the services managed by Tilt (api, frontend). This should already be set by a previous step. Also, check your local Docker environment and Kubernetes cluster's ability to access local images (e.g., if using Minikube, you might need `minikube image load <image_name>` or configure Docker environment sharing). The `update_mode(UPDATE_MODE_AUTO)` in Tiltfile usually handles this for local clusters.
*   **Port Conflicts**: If the default ports (4567 for API, 3000 for frontend) are already in use on your local machine, you can change the local port in the `port_forwards` section of the `Tiltfile`. For example, change `port_forwards=['3000:80']` to `port_forwards=['3001:80']` to use `localhost:3001` for the frontend.

This setup should significantly improve the local development experience when working with Kubernetes.
