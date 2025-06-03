package api

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"strings"

	"github.com/Nerzal/gocloak/v13"
	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
)

var keycloakClient *gocloak.GoCloak
var keycloakRealm string
var keycloakClientID string // Backend client ID

func InitKeycloak() {
	keycloakURL := os.Getenv("KEYCLOAK_URL")
	if keycloakURL == "" {
		keycloakURL = "http://keycloak.browser-sandbox.svc.cluster.local:8080" // Default internal URL
	}
	keycloakRealm = os.Getenv("KEYCLOAK_REALM")
	if keycloakRealm == "" {
		keycloakRealm = "kubebrowse-realm" // Default realm
	}
	keycloakClientID = os.Getenv("KEYCLOAK_BACKEND_CLIENT_ID")
	if keycloakClientID == "" {
		keycloakClientID = "kubebrowse-backend" // Default backend client ID from realm config
	}

	keycloakClient = gocloak.NewClient(keycloakURL)
	logrus.Infof("Keycloak initialized: URL=%s, Realm=%s, ClientID=%s", keycloakURL, keycloakRealm, keycloakClientID)
}

func AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			logrus.Warn("Authorization header missing")
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Authorization header required"})
			return
		}

		tokenParts := strings.Split(authHeader, " ")
		if len(tokenParts) != 2 || strings.ToLower(tokenParts[0]) != "bearer" {
			logrus.Warnf("Invalid Authorization header format: %s", authHeader)
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Invalid Authorization header format"})
			return
		}
		accessToken := tokenParts[1]

		if keycloakClient == nil {
			logrus.Error("Keycloak client not initialized before AuthMiddleware used")
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Keycloak client not initialized"})
			return
		}

		// Decode and verify the token
		// For a bearer-only client, we typically validate the token signature against Keycloak's public keys (JWKS).
		// gocloak.RetrospectToken is more for active/inactive check with client credentials, not ideal for bearer-only validation by resource server.
		// Better approach: keycloakClient.DecodeAccessToken or manually validate using JWKS endpoint.

		// Let's use DecodeAccessToken, it fetches realm certs and validates.
		token, _, err := keycloakClient.DecodeAccessToken(context.Background(), accessToken, keycloakRealm)
		if err != nil {
			logrus.Warnf("Failed to decode or verify token: %v", err)
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": fmt.Sprintf("Invalid or expired token: %s", err.Error())})
			return
		}

		if !token.Active {
			logrus.Warn("Token is not active")
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Token is not active"})
			return
		}

        // Optionally, check audience if your tokens have 'aud' claim for specific backend client
        // if !token.VerifyAudience(keycloakClientID, true) {
        //  logrus.Warnf("Token audience validation failed. Expected '%s', got '%s'", keycloakClientID, token.Audience)
        //  c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "Token audience mismatch"})
        //  return
        // }

		// You can store user info from token in context if needed
		// c.Set("userID", token.Subject)
		// c.Set("userName", token.PreferredUsername)
		// c.Set("userEmail", token.Email)
		logrus.Infof("User %s authenticated successfully", token.PreferredUsername)

		c.Next()
	}
}
