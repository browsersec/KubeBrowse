package auth

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/go-redis/redis/v8"
	"github.com/gorilla/sessions"
	"github.com/markbates/goth"
	"github.com/markbates/goth/gothic"
	"github.com/markbates/goth/providers/github"
	"github.com/sirupsen/logrus"
)

const (
	SessionCookieName = "kubebrowse_session"
	UserContextKey    = "user"
)

type Handler struct {
	service     *Service
	redisClient *redis.Client
}

func NewHandler(service *Service) *Handler {
	return &Handler{
		service: service,
	}
}

func NewHandlerWithRedis(service *Service, redisClient *redis.Client) *Handler {
	return &Handler{
		service:     service,
		redisClient: redisClient,
	}
}

// InitializeGoth initializes the Goth OAuth providers
func InitializeGoth() {
	// Configure session store for Gothic
	sessionSecret := os.Getenv("SESSION_SECRET")
	if sessionSecret == "" {
		sessionSecret = "default-secret-change-this-in-production"
		logrus.Warn("SESSION_SECRET not set, using default secret - this is insecure for production")
	}

	// Create session store with more permissive settings for development
	store := sessions.NewCookieStore([]byte(sessionSecret))
	store.MaxAge(3600) // 1 hour (shorter for OAuth state)
	store.Options.Path = "/"
	store.Options.HttpOnly = false // Allow JavaScript access for debugging
	store.Options.Secure = false   // Allow HTTP cookies (important for development)
	store.Options.Domain = ""      // Use default domain

	// Set the store globally for Gothic
	gothic.Store = store

	logrus.Infof("Configured OAuth session store with secret length: %d", len(sessionSecret))

	goth.UseProviders(
		github.New(
			os.Getenv("GITHUB_CLIENT_ID"),
			os.Getenv("GITHUB_CLIENT_SECRET"),
			os.Getenv("GITHUB_CALLBACK_URL"),
		),
	)

	logrus.Infof("Initialized GitHub OAuth with callback URL: %s", os.Getenv("GITHUB_CALLBACK_URL"))
}

// RegisterRequest represents the request body for email registration
type RegisterRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=8"`
}

// LoginRequest represents the request body for email login
type LoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

// AuthResponse represents the response for successful authentication
type AuthResponse struct {
	User    *User  `json:"user"`
	Message string `json:"message"`
}

// RegisterWithEmail handles user registration with email and password
func (h *Handler) RegisterWithEmail(c *gin.Context) {
	var req RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	user, err := h.service.RegisterWithEmail(req.Email, req.Password)
	if err != nil {
		if err == ErrUserAlreadyExists {
			c.JSON(http.StatusConflict, gin.H{"error": "User already exists"})
			return
		}
		logrus.Errorf("Failed to register user: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to register user"})
		return
	}

	// Don't create session immediately - user needs to verify email first
	c.JSON(http.StatusCreated, gin.H{
		"user":    user,
		"message": "User registered successfully. Please check your email to verify your account.",
	})
}

// LoginWithEmail handles user login with email and password
func (h *Handler) LoginWithEmail(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	user, session, err := h.service.LoginWithEmail(req.Email, req.Password)
	if err != nil {
		if err == ErrInvalidCredentials {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
			return
		}
		if err == ErrEmailNotVerified {
			c.JSON(http.StatusForbidden, gin.H{
				"error": "Email not verified. Please check your email and verify your account.",
				"code":  "EMAIL_NOT_VERIFIED",
			})
			return
		}
		logrus.Errorf("Failed to login user: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to login"})
		return
	}

	// Set session cookie
	h.setSessionCookie(c, session.SessionToken)

	c.JSON(http.StatusOK, AuthResponse{
		User:    user,
		Message: "Login successful",
	})
}

// generateStateToken generates a random state token
func (h *Handler) generateStateToken() (string, error) {
	b := make([]byte, 32)
	_, err := rand.Read(b)
	if err != nil {
		return "", err
	}
	return base64.URLEncoding.EncodeToString(b), nil
}

// BeginOAuth starts the OAuth flow with Redis-based state management
func (h *Handler) BeginOAuth(c *gin.Context) {
	provider := c.Param("provider")
	if provider == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Provider is required"})
		return
	}

	logrus.Infof("Starting OAuth flow for provider: %s", provider)

	// If Redis is available, use custom state management
	if h.redisClient != nil {
		h.beginOAuthWithRedis(c, provider)
		return
	}

	// Fallback to Gothic's session-based approach
	c.Request.URL.RawQuery = "provider=" + provider
	logrus.Debugf("Request URL: %s", c.Request.URL.String())
	gothic.BeginAuthHandler(c.Writer, c.Request)
}

// beginOAuthWithRedis implements OAuth flow with Redis state storage
func (h *Handler) beginOAuthWithRedis(c *gin.Context, provider string) {
	// Generate state token
	state, err := h.generateStateToken()
	if err != nil {
		logrus.Errorf("Failed to generate state token: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate state token"})
		return
	}

	// Store state in Redis with 10-minute expiration
	stateKey := "oauth_state:" + state
	ctx := context.Background()
	err = h.redisClient.Set(ctx, stateKey, provider, 10*time.Minute).Err()
	if err != nil {
		logrus.Errorf("Failed to store state in Redis: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to store OAuth state"})
		return
	}

	logrus.Infof("Stored OAuth state in Redis: %s for provider: %s", state, provider)

	// Get GitHub provider and build authorization URL
	githubProvider, err := goth.GetProvider("github")
	if err != nil {
		logrus.Errorf("Failed to get GitHub provider: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "OAuth provider not configured"})
		return
	}
	sess, err := githubProvider.BeginAuth(state)
	if err != nil {
		logrus.Errorf("Failed to begin auth: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to begin OAuth"})
		return
	}

	authURL, err := sess.GetAuthURL()
	if err != nil {
		logrus.Errorf("Failed to get auth URL: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get authorization URL"})
		return
	}

	logrus.Infof("Redirecting to GitHub OAuth: %s", authURL)
	c.Redirect(http.StatusTemporaryRedirect, authURL)
}

// CallbackOAuth handles the OAuth callback
func (h *Handler) CallbackOAuth(c *gin.Context) {
	provider := c.Param("provider")
	if provider == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Provider is required"})
		return
	}

	logrus.Infof("Processing OAuth callback for provider: %s", provider)

	// Get state and code from query parameters
	stateParam := c.Request.URL.Query().Get("state")
	codeParam := c.Request.URL.Query().Get("code")

	logrus.Infof("OAuth callback - State: %s", stateParam)
	if len(codeParam) > 10 {
		logrus.Infof("OAuth callback - Code: %s...", codeParam[:10])
	} else {
		logrus.Infof("OAuth callback - Code: %s", codeParam)
	}

	// If Redis is available, use custom state validation
	if h.redisClient != nil {
		h.callbackOAuthWithRedis(c, provider, stateParam, codeParam)
		return
	}

	// Fallback to Gothic's session-based approach
	c.Request.URL.RawQuery = "provider=" + provider
	logrus.Debugf("Callback URL: %s", c.Request.URL.String())

	gothUser, err := gothic.CompleteUserAuth(c.Writer, c.Request)
	if err != nil {
		logrus.Errorf("OAuth callback error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "OAuth authentication failed",
			"details": err.Error(),
		})
		return
	}

	h.processOAuthUser(c, gothUser)
}

// callbackOAuthWithRedis handles OAuth callback with Redis state validation
func (h *Handler) callbackOAuthWithRedis(c *gin.Context, provider, state, code string) {
	if state == "" || code == "" {
		logrus.Error("Missing state or code parameter")
		c.JSON(http.StatusBadRequest, gin.H{"error": "Missing required parameters"})
		return
	}

	// Validate state token from Redis
	stateKey := "oauth_state:" + state
	ctx := context.Background()

	storedProvider, err := h.redisClient.Get(ctx, stateKey).Result()
	if err == redis.Nil {
		logrus.Errorf("State token not found in Redis: %s", state)
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid or expired state token"})
		return
	} else if err != nil {
		logrus.Errorf("Failed to get state from Redis: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to validate state"})
		return
	}

	if storedProvider != provider {
		logrus.Errorf("Provider mismatch: expected %s, got %s", storedProvider, provider)
		c.JSON(http.StatusBadRequest, gin.H{"error": "Provider mismatch"})
		return
	}

	logrus.Infof("State token validated successfully for provider: %s", provider)

	// Clean up the state token
	h.redisClient.Del(ctx, stateKey)

	// Get the provider and complete authentication
	githubProvider, err := goth.GetProvider("github")
	if err != nil {
		logrus.Errorf("Failed to get GitHub provider: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "OAuth provider not configured"})
		return
	}
	sess, err := githubProvider.BeginAuth(state)
	if err != nil {
		logrus.Errorf("Failed to begin auth for callback: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to process callback"})
		return
	}

	// Complete the authentication with the authorization code
	// Use url.Values which implements the goth.Params interface
	params := make(url.Values)
	params.Set("code", code)
	params.Set("state", state)

	_, err = sess.Authorize(githubProvider, params)
	if err != nil {
		logrus.Errorf("Failed to authorize: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to complete OAuth authorization"})
		return
	}

	user, err := githubProvider.FetchUser(sess)
	if err != nil {
		logrus.Errorf("Failed to fetch user: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch user information"})
		return
	}

	logrus.Infof("Successfully authenticated user: %s (%s)", user.Email, user.Provider)
	h.processOAuthUser(c, user)
}

// processOAuthUser processes the authenticated OAuth user
func (h *Handler) processOAuthUser(c *gin.Context, gothUser goth.User) {

	// Create or update user
	user, err := h.service.CreateOrUpdateOAuthUser(
		gothUser.Email,
		gothUser.Provider,
		gothUser.UserID,
		gothUser.AvatarURL,
		gothUser.Name,
		gothUser.NickName,
	)
	if err != nil {
		logrus.Errorf("Failed to create/update OAuth user: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to process OAuth user"})
		return
	}

	// Create session
	session, err := h.service.CreateSession(user.ID)
	if err != nil {
		logrus.Errorf("Failed to create session: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create session"})
		return
	}

	// Set session cookie
	h.setSessionCookie(c, session.SessionToken)
	logrus.Infof("Session cookie set for user %s with token: %s", user.Email, session.SessionToken)

	// Redirect to frontend success page
	frontendURL := os.Getenv("FRONTEND_URL")
	if frontendURL == "" {
		frontendURL = "http://localhost:5173"
	}

	c.Redirect(http.StatusTemporaryRedirect, frontendURL+"/auth/success")
}

// Logout handles user logout
func (h *Handler) Logout(c *gin.Context) {
	// Get session token from cookie
	sessionToken, err := c.Cookie(SessionCookieName)
	if err == nil && sessionToken != "" {
		// Delete session from database
		err = h.service.DeleteSession(sessionToken)
		if err != nil {
			logrus.Errorf("Failed to delete session: %v", err)
		}
	}

	// Clear session cookie
	h.clearSessionCookie(c)

	c.JSON(http.StatusOK, gin.H{"message": "Logged out successfully"})
}

// GetCurrentUser returns the current authenticated user
func (h *Handler) GetCurrentUser(c *gin.Context) {
	user, exists := c.Get(UserContextKey)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Not authenticated"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"user": user})
}

// UpdateProfileRequest represents the request body for profile updates
type UpdateProfileRequest struct {
	Username  *string `json:"username"`
	Name      *string `json:"name"`
	AvatarURL *string `json:"avatar_url"`
}

// UpdatePasswordRequest represents the request body for password updates
type UpdatePasswordRequest struct {
	CurrentPassword string `json:"current_password" binding:"required"`
	NewPassword     string `json:"new_password" binding:"required,min=8"`
}

// UpdateProfile handles user profile updates
func (h *Handler) UpdateProfile(c *gin.Context) {
	user, exists := c.Get(UserContextKey)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Not authenticated"})
		return
	}

	authUser := user.(*User)

	var req UpdateProfileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Update user profile
	updatedUser, err := h.service.UpdateUserProfile(authUser.ID, req.Username, req.Name, req.AvatarURL)
	if err != nil {
		logrus.Errorf("Failed to update user profile: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update profile"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"user":    updatedUser,
		"message": "Profile updated successfully",
	})
}

// UpdatePassword handles user password updates
func (h *Handler) UpdatePassword(c *gin.Context) {
	user, exists := c.Get(UserContextKey)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Not authenticated"})
		return
	}

	authUser := user.(*User)

	var req UpdatePasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Verify current password
	_, session, err := h.service.LoginWithEmail(authUser.Email, req.CurrentPassword)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Current password is incorrect"})
		return
	}

	// Update password
	err = h.service.UpdateUserPassword(authUser.ID, req.NewPassword)
	if err != nil {
		logrus.Errorf("Failed to update password: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update password"})
		return
	}

	// Delete old session and create new one
	if session != nil {
		if err := h.service.DeleteSession(session.SessionToken); err != nil {
			logrus.Errorf("Failed to delete old session: %v", err)
		}
	}

	newSession, err := h.service.CreateSession(authUser.ID)
	if err != nil {
		logrus.Errorf("Failed to create new session: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create new session"})
		return
	}

	// Set new session cookie
	h.setSessionCookie(c, newSession.SessionToken)

	c.JSON(http.StatusOK, gin.H{
		"message": "Password updated successfully",
	})
}

// GetUserProfile returns the current user's profile
func (h *Handler) GetUserProfile(c *gin.Context) {
	user, exists := c.Get(UserContextKey)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Not authenticated"})
		return
	}

	authUser := user.(*User)

	// Get fresh user data from database
	freshUser, err := h.service.GetUserByID(authUser.ID)
	if err != nil {
		logrus.Errorf("Failed to get user profile: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get user profile"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"user": freshUser})
}

// setSessionCookie sets the session cookie
func (h *Handler) setSessionCookie(c *gin.Context, sessionToken string) {
	// Get the request host to set proper cookie domain
	host := c.Request.Host
	var domain string
	var secure bool

	// For local development with proxy, set cookie for localhost
	if strings.Contains(host, "localhost") || strings.Contains(host, "127.0.0.1") {
		domain = "localhost"
		secure = false // HTTP for local development
	} else {
		// For production, extract domain from host
		if strings.Contains(host, ":") {
			domain = strings.Split(host, ":")[0]
		} else {
			domain = host
		}
		secure = true // HTTPS for production
	}

	logrus.Debugf("Setting session cookie for host: %s, domain: %s, secure: %v", host, domain, secure)

	c.SetCookie(
		SessionCookieName,
		sessionToken,
		7*24*60*60, // 7 days
		"/",        // Path - root path to ensure it's sent with all requests
		domain,     // Domain - set to localhost for local development
		secure,     // Secure - false for local development, true for production
		true,       // httpOnly
	)
}

// VerifyEmailRequest represents the request body for email verification
type VerifyEmailRequest struct {
	Token string `json:"token" binding:"required"`
}

// ResendVerificationRequest represents the request body for resending verification email
type ResendVerificationRequest struct {
	Email string `json:"email" binding:"required,email"`
}

// VerifyEmail handles email verification
func (h *Handler) VerifyEmail(c *gin.Context) {
	token := c.Query("token")
	if token == "" {
		// Try to get token from request body
		var req VerifyEmailRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Verification token is required"})
			return
		}
		token = req.Token
	}

	user, err := h.service.VerifyEmail(token)
	if err != nil {
		if err == ErrInvalidToken {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid or expired verification token"})
			return
		}
		logrus.Errorf("Failed to verify email: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to verify email"})
		return
	}

	// Create session for the verified user
	session, err := h.service.CreateSession(user.ID)
	if err != nil {
		logrus.Errorf("Failed to create session after verification: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create session"})
		return
	}

	// Set session cookie
	h.setSessionCookie(c, session.SessionToken)

	// If this is a GET request (from email link), redirect to frontend
	if c.Request.Method == "GET" {
		frontendURL := os.Getenv("FRONTEND_URL")
		if frontendURL == "" {
			frontendURL = "http://localhost:5173"
		}
		c.Redirect(http.StatusTemporaryRedirect, frontendURL+"/auth/verification-success")
		return
	}

	// For API requests, return JSON response
	c.JSON(http.StatusOK, gin.H{
		"user":    user,
		"message": "Email verified successfully",
	})
}

// ResendVerificationEmail handles resending verification email
func (h *Handler) ResendVerificationEmail(c *gin.Context) {
	var req ResendVerificationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	err := h.service.ResendVerificationEmail(req.Email)
	if err != nil {
		if err == ErrUserNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "User not found or email already verified"})
			return
		}
		logrus.Errorf("Failed to resend verification email: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to resend verification email"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Verification email sent successfully",
	})
}

// clearSessionCookie clears the session cookie
func (h *Handler) clearSessionCookie(c *gin.Context) {
	c.SetCookie(
		SessionCookieName,
		"",
		-1,
		"/",
		"",
		false,
		true,
	)
}
