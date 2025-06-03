# Testing Keycloak Integration

This document outlines test cases for verifying the Keycloak authentication integration with the KubeBrowse application. These tests should be performed once the application (both frontend and backend) is built with all Keycloak-related changes and deployed alongside a configured Keycloak instance.

## I. Backend API Tests

These tests target the backend API endpoints that are protected by Keycloak.

**Test Environment Setup:**
*   A running Keycloak instance, configured with the `kubebrowse-realm`, `kubebrowse-frontend` (public client), and `kubebrowse-backend` (bearer-only client).
*   The backend API service running, with Keycloak integration enabled (`api/auth_middleware.go`) and correctly configured via environment variables (`KEYCLOAK_URL`, `KEYCLOAK_REALM`, `KEYCLOAK_BACKEND_CLIENT_ID`).
*   A tool capable of making HTTP requests (e.g., curl, Postman) or a Go testing environment.
*   A valid JWT access token obtained from Keycloak for a test user (e.g., `testuser` from `deployments/keycloak-realm-config.json`).

**Test Cases:**

1.  **Access Protected Endpoint Without Token:**
    *   **Description:** Attempt to access a Keycloak-protected API endpoint (e.g., `/api/v1/test/deploy-office`, assuming it's protected) without an `Authorization` header.
    *   **Expected Result:** The API should return an HTTP `401 Unauthorized` status code. The response body might contain an error message indicating a missing token.

2.  **Access Protected Endpoint With Invalid/Malformed Token:**
    *   **Description:** Attempt to access a protected API endpoint with an `Authorization: Bearer <token>` header where the `<token>` is invalid, malformed, or expired.
    *   **Expected Result:** The API should return an HTTP `401 Unauthorized` status code. The response body might indicate an invalid token.

3.  **Access Protected Endpoint With Valid Token (Incorrect Audience - Optional):**
    *   **Description:** If audience (`aud`) claim validation is strictly enforced on the backend for the `kubebrowse-backend` client, attempt to access a protected endpoint with a valid token intended for a *different* client (audience).
    *   **Expected Result:** The API should return an HTTP `403 Forbidden` or `401 Unauthorized` status code, depending on implementation.

4.  **Access Protected Endpoint With Valid Token (Correct Audience):**
    *   **Description:** Obtain a valid access token from Keycloak for the `kubebrowse-frontend` client (which the backend is configured to accept or at least not reject based on audience if audience check is lenient for bearer tokens). Attempt to access a protected API endpoint (e.g., `/api/v1/test/deploy-office`) with this token in the `Authorization: Bearer <token>` header.
    *   **Expected Result:** The API should return an HTTP `2xx` status code (e.g., `200 OK`, `201 Created` depending on the endpoint). The endpoint should function as expected.

**Conceptual Go Test Snippet (Illustrative):**
This assumes a Go testing setup where you can make HTTP requests to your running server or use `httptest`.

```go
// package api_test // Or your actual test package
//
// import (
// 	"net/http"
// 	"net/http/httptest"
// 	"testing"
// 	// "github.com/browsersec/KubeBrowse/api" // Your API package
// 	// "github.com/gin-gonic/gin"
// )

// func setupTestRouterWithAuth() *gin.Engine {
// 	// Simplified setup: In reality, initialize Gin, Keycloak, and routes
// 	// This requires the actual router setup code which is currently missing from the repo.
// 	// router := gin.Default()
// 	// api.InitKeycloak() // Ensure this uses test-friendly Keycloak settings if needed
//
// 	// protected := router.Group("/protected")
// 	// protected.Use(api.AuthMiddleware())
// 	// protected.GET("/resource", func(c *gin.Context) {
// 	// 	c.JSON(http.StatusOK, gin.H{"message": "accessed"})
// 	// })
// 	// return router
//   return nil // Placeholder
// }

// func TestProtectedEndpoint_NoToken(t *testing.T) {
// 	// router := setupTestRouterWithAuth()
// 	// if router == nil { t.Skip("Router setup missing"); }
// 	// w := httptest.NewRecorder()
// 	// req, _ := http.NewRequest("GET", "/protected/resource", nil)
// 	// router.ServeHTTP(w, req)
//
// 	// if w.Code != http.StatusUnauthorized {
// 	// 	t.Errorf("Expected status %d, got %d", http.StatusUnauthorized, w.Code)
// 	// }
// }

// func TestProtectedEndpoint_WithValidToken(t *testing.T) {
// 	// router := setupTestRouterWithAuth()
// 	// if router == nil { t.Skip("Router setup missing"); }
//   // validToken := "your_valid_test_token_here" // Obtain this from Keycloak
// 	// w := httptest.NewRecorder()
// 	// req, _ := http.NewRequest("GET", "/protected/resource", nil)
//   // req.Header.Set("Authorization", "Bearer " + validToken)
// 	// router.ServeHTTP(w, req)
//
// 	// if w.Code != http.StatusOK {
// 	// 	t.Errorf("Expected status %d, got %d", http.StatusOK, w.Code)
// 	// }
// }
```

## II. Frontend E2E Tests

These tests require a running frontend application, a running backend API, and a running Keycloak instance, all correctly configured and accessible.

**Test Cases:**

1.  **Redirect to Keycloak Login:**
    *   **Description:** Attempt to access the frontend application URL.
    *   **Expected Result:** The user should be redirected to the Keycloak login page because `onLoad: 'login-required'` is used.

2.  **Successful Login and Token Storage:**
    *   **Description:** On the Keycloak login page, enter valid credentials for a test user (e.g., `testuser`/`testpassword`).
    *   **Expected Result:**
        *   User is redirected back to the frontend application.
        *   The application recognizes the user as authenticated (e.g., displays username, logout button).
        *   The `keycloak.js` instance should have the token details.

3.  **Accessing Application Features Post-Login:**
    *   **Description:** After logging in, try to use application features that would previously have been inaccessible or would make calls to protected backend endpoints.
    *   **Expected Result:** Features should work correctly, implying that API calls are being made with the valid token.

4.  **Logout:**
    *   **Description:** Click the "Logout" button in the frontend application.
    *   **Expected Result:**
        *   User is logged out from Keycloak.
        *   User is redirected to the application's configured post-logout URL (e.g., home page).
        *   Attempting to access protected parts of the application should again redirect to Keycloak login.

5.  **Token Refresh (Manual Verification or DevTools):**
    *   **Description:** While the user is logged in, monitor network requests or Keycloak logs (if possible) or observe application behavior over a period longer than the token's initial validity but shorter than the refresh token's validity. The frontend is configured to attempt token refresh every 60 seconds.
    *   **Expected Result:** Keycloak token refresh attempts should be visible, and the session should remain active without requiring the user to log in again, as long as the refresh token is valid.

## III. Manual Smoke Tests

Combine backend and frontend testing for an end-to-end check.

1.  **Full User Journey:**
    *   Open browser, navigate to frontend application.
    *   Be redirected to Keycloak, log in as `testuser`.
    *   Be redirected back to the application.
    *   Verify username is displayed.
    *   Attempt an action that calls a protected backend API (e.g., "Deploy Office" or "Deploy Browser" if these UI elements are available and call the backend).
    *   Verify the action is successful (e.g., pod deployment starts, UI updates accordingly).
    *   Log out from the application.
    *   Verify redirection to login or public page.
```
