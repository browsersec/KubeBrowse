# Keycloak Integration for API

This document outlines how to integrate the Keycloak authentication middleware into the Go backend API.

## Prerequisites

1.  Ensure Keycloak is deployed and configured as per `deployments/keycloak.yaml` and `deployments/keycloak-realm-config.json`.
2.  The backend API deployment (`browser-sandbox-api` in `deployments/manifest.yml`) must have the following environment variables set:
    *   `KEYCLOAK_URL`: The URL to your Keycloak server (e.g., `http://keycloak.browser-sandbox.svc.cluster.local:8080`)
    *   `KEYCLOAK_REALM`: The Keycloak realm name (e.g., `kubebrowse-realm`)
    *   `KEYCLOAK_BACKEND_CLIENT_ID`: The Client ID for the backend (e.g., `kubebrowse-backend`)

## Middleware Usage

The authentication middleware is defined in `api/auth_middleware.go`.

### 1. Initialize Keycloak Client

Call the `api.InitKeycloak()` function once when your API server starts. This initializes the connection to Keycloak.

```go
// Example of where to call InitKeycloak (e.g., in your main function)
// import "github.com/browsersec/KubeBrowse/api" // Adjust import path as necessary

func main() {
    // ... other initializations
    api.InitKeycloak() // Initialize Keycloak client
    // ... setup Gin router
    // router.Run()
}
```

### 2. Apply Authentication Middleware to Routes

Use the `api.AuthMiddleware()` Gin handler for routes that require authentication.

```go
// Example of applying middleware to routes
// import (
// 	"github.com/gin-gonic/gin"
// 	"github.com/browsersec/KubeBrowse/api" // Adjust import path
//      // ... other necessary imports like k8s client, redis, activeTunnels
// )

// func setupRouter(k8sClient *kubernetes.Clientset, k8sNamespace string, redisClient *redis.Client, activeTunnels *guac.ActiveTunnelStore) *gin.Engine {
//     router := gin.Default()

//     // Public routes (if any)
//     // router.GET("/public/some-endpoint", api.PublicHandler)

//     // Protected routes
//     protectedRoutes := router.Group("/api/v1") // Or any other group
//     protectedRoutes.Use(api.AuthMiddleware())
//     {
//         // Assuming DeployOffice and DeployBrowser are adapted to fit gin.HandlerFunc signature directly
//         // or wrapped if they need other parameters passed not from gin.Context
//         // For example, if they are methods of a struct that holds dependencies:
//         // apiService := api.NewApiService(k8sClient, k8sNamespace, redisClient, activeTunnels)
//         // protectedRoutes.POST("/deploy-office", apiService.DeployOfficeHandler)
//         // protectedRoutes.POST("/deploy-browser", apiService.DeployBrowserHandler)

//         // If using the existing functions directly, they need to match gin.HandlerFunc
//         // or be wrapped. The current functions (e.g., api.DeployOffice) take more arguments
//         // than a standard gin.HandlerFunc. These would need to be refactored or
//         // dependencies injected via context or a struct.

//         // For demonstration, let's assume they are refactored or we are protecting hypothetical handlers:
//         protectedRoutes.POST("/test/deploy-office", func(c *gin.Context) {
//             // Placeholder: Actual call to api.DeployOffice would need k8sClient, etc.
//             // These dependencies would typically be available via a struct holding them,
//             // or passed via c.Set/c.Get if set by a preceding middleware.
//             // For now, just showing it's a protected route.
//             api.DeployOffice(c, nil, "", nil, nil) // This call will not work as is.
//         })
//         protectedRoutes.POST("/test/deploy-browser", func(c *gin.Context) {
//             api.DeployBrowser(c, nil, "", nil, nil) // This call will not work as is.
//         })
//         // Add other protected routes here
//     }
//     return router
// }
```

**Important**: The existing handler functions in `api/main.go` (like `DeployOffice`, `DeployBrowser`) have signatures such as `func(c *gin.Context, k8sClient *kubernetes.Clientset, ...)`. To be used directly with Gin routes after a middleware, they would typically need to be closures or methods on a struct that already has access to these dependencies (e.g., `k8sClient`, `redisClient`). The example above illustrates where the middleware is placed; actual integration will require adapting the handler invocation.

## Building with Keycloak Dependency

The `gocloak` library (`github.com/Nerzal/gocloak/v13`) has been added to `api/go.mod`. The Docker build process for the main API service (`ghcr.io/browsersec/kubebrowse:sha-09dfa1f`) **must** ensure this dependency is correctly fetched (e.g., via `go mod download` or `go mod tidy`) before building the binary. The Dockerfile for this service is currently not part of this repository.
