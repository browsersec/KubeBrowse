package auth

import (
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
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
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{
		service: service,
	}
}

// InitializeGoth initializes the Goth OAuth providers
func InitializeGoth() {
	goth.UseProviders(
		github.New(
			os.Getenv("GITHUB_CLIENT_ID"),
			os.Getenv("GITHUB_CLIENT_SECRET"),
			os.Getenv("GITHUB_CALLBACK_URL"),
		),
	)
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

	// Create session
	session, err := h.service.CreateSession(user.ID)
	if err != nil {
		logrus.Errorf("Failed to create session: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create session"})
		return
	}

	// Set session cookie
	h.setSessionCookie(c, session.SessionToken)

	c.JSON(http.StatusCreated, AuthResponse{
		User:    user,
		Message: "User registered successfully",
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

// BeginOAuth starts the OAuth flow
func (h *Handler) BeginOAuth(c *gin.Context) {
	provider := c.Param("provider")
	if provider == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Provider is required"})
		return
	}

	// Set provider in query for gothic
	c.Request.URL.RawQuery = "provider=" + provider

	gothic.BeginAuthHandler(c.Writer, c.Request)
}

// CallbackOAuth handles the OAuth callback
func (h *Handler) CallbackOAuth(c *gin.Context) {
	provider := c.Param("provider")
	if provider == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Provider is required"})
		return
	}

	// Set provider in query for gothic
	c.Request.URL.RawQuery = "provider=" + provider

	gothUser, err := gothic.CompleteUserAuth(c.Writer, c.Request)
	if err != nil {
		logrus.Errorf("OAuth callback error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "OAuth authentication failed"})
		return
	}

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

	// Redirect to frontend success page
	frontendURL := os.Getenv("FRONTEND_URL")
	if frontendURL == "" {
		frontendURL = "http://localhost:3000"
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

// setSessionCookie sets the session cookie
func (h *Handler) setSessionCookie(c *gin.Context, sessionToken string) {
	c.SetCookie(
		SessionCookieName,
		sessionToken,
		7*24*60*60, // 7 days
		"/",
		"",
		false, // secure - set to true in production with HTTPS
		true,  // httpOnly
	)
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
