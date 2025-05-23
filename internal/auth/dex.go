package auth

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	// "encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/coreos/go-oidc/v3/oidc"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/oauth2"
)

type Server struct {
	oauth2Config *oauth2.Config
	verifier     *oidc.IDTokenVerifier
	jwtSecret    []byte
}

type User struct {
	ID       string `json:"id"`
	Email    string `json:"email"`
	Name     string `json:"name"`
	Username string `json:"username"`
}

type AuthResponse struct {
	Token string `json:"token"`
	User  User   `json:"user"`
}

type Claims struct {
	User User `json:"user"`
	jwt.RegisteredClaims
}

func generateRandomBytes(n int) ([]byte, error) {
	b := make([]byte, n)
	_, err := rand.Read(b)
	if err != nil {
		return nil, err
	}
	return b, nil
}

// func main() {
// 	// Initialize JWT secret
// 	jwtSecret, err := generateRandomBytes(32)
// 	if err != nil {
// 		log.Fatal("Failed to generate JWT secret:", err)
// 	}

// 	ctx := context.Background()

// 	// Initialize OIDC provider
// 	provider, err := oidc.NewProvider(ctx, "http://localhost:5556/dex")
// 	if err != nil {
// 		log.Fatal("Failed to get provider:", err)
// 	}

// 	// Configure OAuth2
// 	oauth2Config := &oauth2.Config{
// 		ClientID:     "react-app",
// 		ClientSecret: "ZXhhbXBsZS1hcHAtc2VjcmV0",
// 		RedirectURL:  "http://localhost:8080/callback",
// 		Endpoint:     provider.Endpoint(),
// 		Scopes:       []string{oidc.ScopeOpenID, "profile", "email"},
// 	}

// 	// Create ID token verifier
// 	verifier := provider.Verifier(&oidc.Config{ClientID: "react-app"})

// 	server := &Server{
// 		oauth2Config: oauth2Config,
// 		verifier:     verifier,
// 		jwtSecret:    jwtSecret,
// 	}

// 	r := gin.Default()

// 	// CORS configuration
// 	config := cors.DefaultConfig()
// 	config.AllowOrigins = []string{"http://localhost:3000"}
// 	config.AllowCredentials = true
// 	config.AllowHeaders = []string{"Origin", "Content-Length", "Content-Type", "Authorization"}
// 	r.Use(cors.New(config))

// 	// Routes
// 	r.GET("/auth/login", server.handleLogin)
// 	r.GET("/callback", server.handleCallback)
// 	r.POST("/auth/verify", server.handleVerifyToken)
// 	r.GET("/auth/user", server.authMiddleware(), server.handleGetUser)
// 	r.POST("/auth/logout", server.handleLogout)

// 	log.Println("Server starting on :8080")
// 	r.Run(":8080")
// }

func InitDexServer() (*Server, error) {

	// Initialize JWT secret
	jwtSecret, err := generateRandomBytes(32)
	if err != nil {
		log.Fatal("Failed to generate JWT secret:", err)
		return nil, err
	}

	ctx := context.Background()

	// Initialize OIDC provider
	provider, err := oidc.NewProvider(ctx, "http://localhost:5556/dex")
	if err != nil {
		log.Fatal("Failed to get provider:", err)
		return nil, err
	}

	// Configure OAuth2
	oauth2Config := &oauth2.Config{
		ClientID:     "react-app",
		ClientSecret: "ZXhhbXBsZS1hcHAtc2VjcmV0",
		RedirectURL:  "http://localhost:8080/callback",
		Endpoint:     provider.Endpoint(),
		Scopes:       []string{oidc.ScopeOpenID, "profile", "email"},
	}

	// Create ID token verifier
	verifier := provider.Verifier(&oidc.Config{ClientID: "react-app"})

	server := &Server{
		oauth2Config: oauth2Config,
		verifier:     verifier,
		jwtSecret:    jwtSecret,
	}
	return server, nil
}

func (s *Server) HandleLogin(c *gin.Context) {
	state, err := generateRandomString(16)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate state"})
		return
	}

	// Store state in a secure way (in production, use Redis or database)
	authURL := s.oauth2Config.AuthCodeURL(state)

	c.JSON(http.StatusOK, gin.H{
		"auth_url": authURL,
		"state":    state,
	})
}

func (s *Server) HandleCallback(c *gin.Context) {
	code := c.Query("code")
	_ = c.Query("state")

	if code == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Missing authorization code"})
		return
	}

	// Exchange code for token
	ctx := context.Background()
	token, err := s.oauth2Config.Exchange(ctx, code)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to exchange token"})
		return
	}

	// Extract ID token
	rawIDToken, ok := token.Extra("id_token").(string)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "No id_token in token response"})
		return
	}

	// Verify ID token
	idToken, err := s.verifier.Verify(ctx, rawIDToken)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to verify ID token"})
		return
	}

	// Extract user info
	var claims struct {
		Email    string `json:"email"`
		Name     string `json:"name"`
		Username string `json:"preferred_username"`
	}

	if err := idToken.Claims(&claims); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to parse claims"})
		return
	}

	user := User{
		ID:       idToken.Subject,
		Email:    claims.Email,
		Name:     claims.Name,
		Username: claims.Username,
	}

	// Generate JWT token
	jwtToken, err := s.generateJWT(user)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate JWT"})
		return
	}

	// Redirect to frontend with token
	c.Redirect(http.StatusFound, fmt.Sprintf("http://localhost:3000/callback?token=%s", jwtToken))
}

func (s *Server) HandleVerifyToken(c *gin.Context) {
	var request struct {
		Token string `json:"token"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	claims, err := s.validateJWT(request.Token)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token"})
		return
	}

	c.JSON(http.StatusOK, AuthResponse{
		Token: request.Token,
		User:  claims.User,
	})
}

func (s *Server) HandleGetUser(c *gin.Context) {
	user, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"user": user})
}

func (s *Server) HandleLogout(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"message": "Logged out successfully"})
}

func (s *Server) generateJWT(user User) (string, error) {
	claims := Claims{
		User: user,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(s.jwtSecret)
}

func (s *Server) validateJWT(tokenString string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
		return s.jwtSecret, nil
	})

	if err != nil {
		return nil, err
	}

	if claims, ok := token.Claims.(*Claims); ok && token.Valid {
		return claims, nil
	}

	return nil, fmt.Errorf("invalid token")
}

func (s *Server) AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Authorization header required"})
			c.Abort()
			return
		}

		tokenString := authHeader[7:] // Remove "Bearer " prefix
		claims, err := s.validateJWT(tokenString)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token"})
			c.Abort()
			return
		}

		c.Set("user", claims.User)
		c.Next()
	}
}

func generateRandomString(length int) (string, error) {
	bytes, err := generateRandomBytes(length)
	if err != nil {
		return "", err
	}
	return base64.URLEncoding.EncodeToString(bytes)[:length], nil
}
