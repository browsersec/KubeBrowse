package auth

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"errors"
	"fmt"
	"time"

	sqlc "github.com/browsersec/KubeBrowse/db/sqlc"
	"github.com/browsersec/KubeBrowse/internal/email"
	"github.com/google/uuid"
	"github.com/sirupsen/logrus"
	"golang.org/x/crypto/bcrypt"
)

var (
	ErrUserNotFound       = errors.New("user not found")
	ErrInvalidCredentials = errors.New("invalid credentials")
	ErrUserAlreadyExists  = errors.New("user already exists")
	ErrSessionExpired     = errors.New("session expired")
	ErrEmailNotVerified   = errors.New("email not verified")
	ErrInvalidToken       = errors.New("invalid or expired verification token")
)

type Service struct {
	db           *sqlc.Queries
	dbConn       *sql.DB
	ctx          context.Context
	emailService *email.Service
}

func NewService(db *sqlc.Queries, dbConn *sql.DB) *Service {
	return &Service{
		db:           db,
		dbConn:       dbConn,
		ctx:          context.Background(),
		emailService: email.NewService(),
	}
}

// User represents a user in the system
type User struct {
	ID            uuid.UUID `json:"id"`
	Username      *string   `json:"username"`
	Email         string    `json:"email"`
	Provider      string    `json:"provider"`
	AvatarURL     *string   `json:"avatar_url"`
	Name          *string   `json:"name"`
	EmailVerified bool      `json:"email_verified"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

// Session represents a user session
type Session struct {
	ID           uuid.UUID `json:"id"`
	UserID       uuid.UUID `json:"user_id"`
	SessionToken string    `json:"session_token"`
	ExpiresAt    time.Time `json:"expires_at"`
	User         *User     `json:"user,omitempty"`
}

// RegisterWithEmail creates a new user with email and password
func (s *Service) RegisterWithEmail(email, password string) (*User, error) {
	// Check if user already exists
	existingUser, err := s.db.GetUserByEmail(s.ctx, email)
	if err == nil && existingUser.ID != uuid.Nil {
		return nil, ErrUserAlreadyExists
	}

	// Hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, fmt.Errorf("failed to hash password: %w", err)
	}

	// Generate email verification token
	verificationToken, err := s.generateVerificationToken()
	if err != nil {
		return nil, fmt.Errorf("failed to generate verification token: %w", err)
	}

	// Set verification token expiration (24 hours)
	expiresAt := time.Now().Add(24 * time.Hour)

	// Create user with verification token
	dbUser, err := s.db.CreateEmailUser(s.ctx, sqlc.CreateEmailUserParams{
		Email:                      email,
		PasswordHash:               sql.NullString{String: string(hashedPassword), Valid: true},
		EmailVerificationToken:     sql.NullString{String: verificationToken, Valid: true},
		EmailVerificationExpiresAt: sql.NullTime{Time: expiresAt, Valid: true},
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create user: %w", err)
	}

	// Send verification email if email service is configured
	if s.emailService.IsConfigured() {
		name := email // Use email as name if no name provided
		err = s.emailService.SendVerificationEmail(email, name, verificationToken)
		if err != nil {
			// Log error but don't fail registration
			fmt.Printf("Failed to send verification email: %v\n", err)
		}
	}

	return s.convertDBUser(dbUser), nil
}

// LoginWithEmail authenticates a user with email and password
func (s *Service) LoginWithEmail(email, password string) (*User, *Session, error) {
	// Get user by email
	dbUser, err := s.db.GetUserByEmail(s.ctx, email)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil, ErrInvalidCredentials
		}
		return nil, nil, fmt.Errorf("failed to get user: %w", err)
	}

	// Check if user has a password (OAuth users might not have passwords)
	if !dbUser.PasswordHash.Valid {
		return nil, nil, ErrInvalidCredentials
	}

	// Verify password
	err = bcrypt.CompareHashAndPassword([]byte(dbUser.PasswordHash.String), []byte(password))
	if err != nil {
		return nil, nil, ErrInvalidCredentials
	}

	// Check if email is verified for email-based signup
	if dbUser.Provider.String == "email" && (!dbUser.EmailVerified.Valid || !dbUser.EmailVerified.Bool) {
		return nil, nil, ErrEmailNotVerified
	}

	// Create session
	session, err := s.CreateSession(dbUser.ID)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to create session: %w", err)
	}

	user := s.convertDBUser(dbUser)
	session.User = user

	return user, session, nil
}

// CreateOrUpdateOAuthUser creates or updates a user from OAuth provider
func (s *Service) CreateOrUpdateOAuthUser(email, provider, providerID, avatarURL, name, username string) (*User, error) {
	// Try to find existing user by provider
	existingUser, err := s.db.GetUserByProvider(s.ctx, sqlc.GetUserByProviderParams{
		Provider:   sql.NullString{String: provider, Valid: true},
		ProviderID: sql.NullString{String: providerID, Valid: true},
	})

	if err == nil {
		// User exists, return it
		return s.convertDBUser(existingUser), nil
	}

	// Check if user exists with same email
	emailUser, err := s.db.GetUserByEmail(s.ctx, email)
	if err == nil {
		// Update existing user with OAuth info
		// For now, just return the existing user
		return s.convertDBUser(emailUser), nil
	}

	// Create new user
	dbUser, err := s.db.CreateOAuthUser(s.ctx, sqlc.CreateOAuthUserParams{
		Email:      email,
		Provider:   sql.NullString{String: provider, Valid: true},
		ProviderID: sql.NullString{String: providerID, Valid: true},
		AvatarUrl:  sql.NullString{String: avatarURL, Valid: avatarURL != ""},
		Name:       sql.NullString{String: name, Valid: name != ""},
		Username:   sql.NullString{String: username, Valid: username != ""},
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create OAuth user: %w", err)
	}

	return s.convertDBUser(dbUser), nil
}

// CreateSession creates a new session for a user
func (s *Service) CreateSession(userID uuid.UUID) (*Session, error) {
	// Generate session token
	token, err := s.generateSessionToken()
	if err != nil {
		return nil, fmt.Errorf("failed to generate session token: %w", err)
	}

	// Set expiration to 7 days from now
	expiresAt := time.Now().Add(7 * 24 * time.Hour)

	dbSession, err := s.db.CreateSession(s.ctx, sqlc.CreateSessionParams{
		UserID:       userID,
		SessionToken: token,
		ExpiresAt:    expiresAt,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create session: %w", err)
	}

	return &Session{
		ID:           dbSession.ID,
		UserID:       dbSession.UserID,
		SessionToken: dbSession.SessionToken,
		ExpiresAt:    dbSession.ExpiresAt,
	}, nil
}

// UpdateUserProfile updates a user's profile information
func (s *Service) UpdateUserProfile(userID uuid.UUID, username, name, avatarURL *string) (*User, error) {
	// Build update parameters
	params := sqlc.UpdateUserProfileParams{
		ID: userID,
	}

	if username != nil {
		params.Username = sql.NullString{String: *username, Valid: true}
	} else {
		params.Username = sql.NullString{Valid: false}
	}

	if name != nil {
		params.Name = sql.NullString{String: *name, Valid: true}
	} else {
		params.Name = sql.NullString{Valid: false}
	}

	if avatarURL != nil {
		params.AvatarUrl = sql.NullString{String: *avatarURL, Valid: true}
	} else {
		params.AvatarUrl = sql.NullString{Valid: false}
	}

	// Update user profile
	dbUser, err := s.db.UpdateUserProfile(s.ctx, params)
	if err != nil {
		return nil, fmt.Errorf("failed to update user profile: %w", err)
	}

	return s.convertDBUser(dbUser), nil
}

// UpdateUserPassword updates a user's password
func (s *Service) UpdateUserPassword(userID uuid.UUID, newPassword string) error {
	// Hash the new password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("failed to hash password: %w", err)
	}

	// Update password
	_, err = s.db.UpdateUserPassword(s.ctx, sqlc.UpdateUserPasswordParams{
		ID:           userID,
		PasswordHash: sql.NullString{String: string(hashedPassword), Valid: true},
	})
	if err != nil {
		return fmt.Errorf("failed to update password: %w", err)
	}

	return nil
}

// GetUserByID retrieves a user by their ID
func (s *Service) GetUserByID(userID uuid.UUID) (*User, error) {
	dbUser, err := s.db.GetUser(s.ctx, userID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrUserNotFound
		}
		return nil, fmt.Errorf("failed to get user: %w", err)
	}

	return s.convertDBUser(dbUser), nil
}

// ValidateSession validates a session token and returns the user
func (s *Service) ValidateSession(token string) (*User, *Session, error) {
	dbSession, err := s.db.GetSession(s.ctx, token)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil, ErrSessionExpired
		}
		return nil, nil, fmt.Errorf("failed to get session: %w", err)
	}

	// Check if session has expired
	if time.Now().After(dbSession.ExpiresAt) {
		// Session has expired, clean it up
		logrus.Debugf("ValidateSession: Session expired, cleaning up: %s", token)
		if cleanupErr := s.db.DeleteSession(s.ctx, token); cleanupErr != nil {
			logrus.Warnf("ValidateSession: Failed to cleanup expired session: %v", cleanupErr)
		}
		return nil, nil, ErrSessionExpired
	}

	// Add debug logging
	logrus.Debugf("ValidateSession: Retrieved session data - UserID: %s, Email: %s, Provider: %s",
		dbSession.UserID, dbSession.Email, dbSession.Provider.String)

	user := &User{
		ID:       dbSession.UserID,
		Email:    dbSession.Email,
		Provider: dbSession.Provider.String,
	}

	if dbSession.Username.Valid {
		user.Username = &dbSession.Username.String
	}
	if dbSession.Name.Valid {
		user.Name = &dbSession.Name.String
	}
	if dbSession.AvatarUrl.Valid {
		user.AvatarURL = &dbSession.AvatarUrl.String
	}

	// Set default values for required fields
	if user.Provider == "" {
		user.Provider = "unknown"
	}

	// Add debug logging for final user object
	logrus.Debugf("ValidateSession: Created user object - ID: %s, Email: %s, Provider: %s",
		user.ID, user.Email, user.Provider)

	session := &Session{
		ID:           dbSession.ID,
		UserID:       dbSession.UserID,
		SessionToken: dbSession.SessionToken,
		ExpiresAt:    dbSession.ExpiresAt,
		User:         user,
	}

	return user, session, nil
}

// DeleteSession deletes a session
func (s *Service) DeleteSession(token string) error {
	err := s.db.DeleteSession(s.ctx, token)
	if err != nil {
		return fmt.Errorf("failed to delete session: %w", err)
	}
	return nil
}

// CleanupExpiredSessions removes expired sessions
func (s *Service) CleanupExpiredSessions() error {
	err := s.db.DeleteExpiredSessions(s.ctx)
	if err != nil {
		return fmt.Errorf("failed to cleanup expired sessions: %w", err)
	}
	return nil
}

// VerifyEmail verifies a user's email using the verification token
func (s *Service) VerifyEmail(token string) (*User, error) {
	// Verify the token and update user
	dbUser, err := s.db.VerifyUserEmail(s.ctx, sql.NullString{String: token, Valid: true})
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrInvalidToken
		}
		return nil, fmt.Errorf("failed to verify email: %w", err)
	}

	return s.convertDBUser(dbUser), nil
}

// ResendVerificationEmail resends the verification email for a user
func (s *Service) ResendVerificationEmail(email string) error {
	if !s.emailService.IsConfigured() {
		return fmt.Errorf("email service not configured")
	}

	// Generate new verification token
	verificationToken, err := s.generateVerificationToken()
	if err != nil {
		return fmt.Errorf("failed to generate verification token: %w", err)
	}

	// Set verification token expiration (24 hours)
	expiresAt := time.Now().Add(24 * time.Hour)

	// Update user with new verification token
	dbUser, err := s.db.ResendEmailVerification(s.ctx, sqlc.ResendEmailVerificationParams{
		Email:                      email,
		EmailVerificationToken:     sql.NullString{String: verificationToken, Valid: true},
		EmailVerificationExpiresAt: sql.NullTime{Time: expiresAt, Valid: true},
	})
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return ErrUserNotFound
		}
		return fmt.Errorf("failed to update verification token: %w", err)
	}

	// Send verification email
	name := dbUser.Email // Use email as name if no name provided
	if dbUser.Name.Valid {
		name = dbUser.Name.String
	}

	err = s.emailService.SendVerificationEmail(email, name, verificationToken)
	if err != nil {
		return fmt.Errorf("failed to send verification email: %w", err)
	}

	return nil
}

// generateSessionToken generates a secure random session token
func (s *Service) generateSessionToken() (string, error) {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}

// generateVerificationToken generates a secure random verification token
func (s *Service) generateVerificationToken() (string, error) {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}

// convertDBUser converts a database user to our User struct
func (s *Service) convertDBUser(dbUser sqlc.User) *User {
	user := &User{
		ID:            dbUser.ID,
		Email:         dbUser.Email,
		Provider:      dbUser.Provider.String,
		EmailVerified: dbUser.EmailVerified.Valid && dbUser.EmailVerified.Bool,
		CreatedAt:     dbUser.CreatedAt,
		UpdatedAt:     dbUser.UpdatedAt,
	}

	if dbUser.Username.Valid {
		user.Username = &dbUser.Username.String
	}
	if dbUser.Name.Valid {
		user.Name = &dbUser.Name.String
	}
	if dbUser.AvatarUrl.Valid {
		user.AvatarURL = &dbUser.AvatarUrl.String
	}

	return user
}
