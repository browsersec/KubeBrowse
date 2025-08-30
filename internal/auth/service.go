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
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

var (
	ErrUserNotFound       = errors.New("user not found")
	ErrInvalidCredentials = errors.New("invalid credentials")
	ErrUserAlreadyExists  = errors.New("user already exists")
	ErrSessionExpired     = errors.New("session expired")
)

type Service struct {
	db     *sqlc.Queries
	dbConn *sql.DB
	ctx    context.Context
}

func NewService(db *sqlc.Queries, dbConn *sql.DB) *Service {
	return &Service{
		db:     db,
		dbConn: dbConn,
		ctx:    context.Background(),
	}
}

// User represents a user in the system
type User struct {
	ID        uuid.UUID `json:"id"`
	Username  *string   `json:"username"`
	Email     string    `json:"email"`
	Provider  string    `json:"provider"`
	AvatarURL *string   `json:"avatar_url"`
	Name      *string   `json:"name"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
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

	// Create user
	dbUser, err := s.db.CreateEmailUser(s.ctx, sqlc.CreateEmailUserParams{
		Email:        email,
		PasswordHash: sql.NullString{String: string(hashedPassword), Valid: true},
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create user: %w", err)
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

// ValidateSession validates a session token and returns the user
func (s *Service) ValidateSession(token string) (*User, *Session, error) {
	dbSession, err := s.db.GetSession(s.ctx, token)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil, ErrSessionExpired
		}
		return nil, nil, fmt.Errorf("failed to get session: %w", err)
	}

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

// generateSessionToken generates a secure random session token
func (s *Service) generateSessionToken() (string, error) {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}

// convertDBUser converts a database user to our User struct
func (s *Service) convertDBUser(dbUser sqlc.User) *User {
	user := &User{
		ID:        dbUser.ID,
		Email:     dbUser.Email,
		Provider:  dbUser.Provider.String,
		CreatedAt: dbUser.CreatedAt,
		UpdatedAt: dbUser.UpdatedAt,
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
