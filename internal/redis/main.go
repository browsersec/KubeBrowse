package redis

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"time"

	"github.com/go-redis/redis/v8"
	"github.com/sirupsen/logrus"
)

type SessionData struct {
	PodName            string            `json:"podName"`
	PodIP              string            `json:"podIP"`
	FQDN               string            `json:"fqdn"`
	ConnectionID       string            `json:"connection_id"`
	ConnectionParams   map[string]string `json:"connection_params"`
	Share              bool              `json:"share"`
	DisconnectionCount int               `json:"disconnection_count"`
	CreatedAt          time.Time         `json:"created_at"`
	LastExtendedAt     time.Time         `json:"last_extended_at"`
	TimeoutDuration    time.Duration     `json:"timeout_duration"`
	ExpireAt           time.Time         `json:"expire_at"` // New field to store absolute expiration
}

// InitRedis initializes and returns a new Redis client
func InitRedis() *redis.Client {
	// Retrieve Redis connection details from environment variables or use defaults
	redisHost := "localhost"
	redisPort := "6379"
	if os.Getenv("REDIS_HOST") != "" {
		redisHost = os.Getenv("REDIS_HOST")
	}
	if os.Getenv("REDIS_PORT") != "" {
		redisPort = os.Getenv("REDIS_PORT")
	}
	redisAddr := fmt.Sprintf("%s:%s", redisHost, redisPort)

	// Create a new Redis client
	client := redis.NewClient(&redis.Options{
		Addr:     redisAddr,
		Password: "", // no password set
		DB:       0,  // use default DB
	})

	// Ping the Redis server to check the connection
	_, err := client.Ping(context.Background()).Result()
	if err != nil {
		logrus.Errorf("Could not connect to Redis: %v", err)
		// Depending on your application's requirements, you might want to panic here
		// panic(err)
	}

	logrus.Infof("Connected to Redis at %s", redisAddr)

	return client
}

// CheckSessionExists checks if a session exists for a given pod
func CheckSessionExists(client *redis.Client, podName string) (bool, error) {
	ctx := context.Background()

	// Check if session key exists
	exists, err := client.Exists(ctx, fmt.Sprintf("session:%s", podName)).Result()
	if err != nil {
		return false, fmt.Errorf("error checking session existence: %v", err)
	}

	return exists > 0, nil
}

// GetSessionData retrieves session data for a given pod
func GetSessionData(client *redis.Client, podName string) (*SessionData, error) {
	ctx := context.Background()

	sessionKey := fmt.Sprintf("session:%s", podName)
	sessionJSON, err := client.Get(ctx, sessionKey).Result()
	if err == redis.Nil {
		return nil, fmt.Errorf("session not found for pod: %s", podName)
	} else if err != nil {
		return nil, fmt.Errorf("error retrieving session: %v", err)
	}

	var sessionData SessionData
	err = json.Unmarshal([]byte(sessionJSON), &sessionData)
	if err != nil {
		return nil, fmt.Errorf("error unmarshaling session data: %v", err)
	}

	return &sessionData, nil
}

// GetRemainingTTL calculates how much time is left based on ExpireAt
func GetRemainingTTL(session *SessionData) time.Duration {
	return time.Until(session.ExpireAt)
}

// SetSessionData stores session data for a given pod with TTL
func SetSessionData(client *redis.Client, podName string, sessionData *SessionData, ttl time.Duration) error {
	ctx := context.Background()

	sessionJSON, err := json.Marshal(sessionData)
	if err != nil {
		return fmt.Errorf("error marshaling session data: %v", err)
	}

	sessionKey := fmt.Sprintf("session:%s", podName)
	err = client.Set(ctx, sessionKey, sessionJSON, ttl).Err()
	if err != nil {
		return fmt.Errorf("error setting session data: %v", err)
	}

	return nil
}

// SetSessionDataWithContext stores session data with context for better timeout control
func SetSessionDataWithContext(ctx context.Context, client *redis.Client, podName string, sessionData *SessionData, ttl time.Duration) error {
	sessionJSON, err := json.Marshal(sessionData)
	if err != nil {
		return fmt.Errorf("error marshaling session data: %v", err)
	}

	sessionKey := fmt.Sprintf("session:%s", podName)
	err = client.Set(ctx, sessionKey, sessionJSON, ttl).Err()
	if err != nil {
		return fmt.Errorf("error setting session data: %v", err)
	}

	return nil
}

// GetSessionExpireTime returns the absolute expiration time for a session
func GetSessionExpireTime(client *redis.Client, sessionID string) (time.Time, error) {
	ttl, err := GetSessionTimeLeft(client, sessionID)
	if err != nil {
		return time.Time{}, err
	}

	return time.Now().Add(ttl), nil
}

// SetSessionWithExpireTime sets session data with an absolute expire time
func SetSessionWithExpireTime(client *redis.Client, podName string, sessionData *SessionData, expireTime time.Time) error {
	// Calculate TTL from absolute expiration time
	ttl := time.Until(expireTime)
	if ttl <= 0 {
		return fmt.Errorf("expiration time must be in the future")
	}

	return SetSessionData(client, podName, sessionData, ttl)
}

// DeleteSession removes a session for a given pod
func DeleteSession(client *redis.Client, podName string) error {
	ctx := context.Background()

	sessionKey := fmt.Sprintf("session:%s", podName)
	err := client.Del(ctx, sessionKey).Err()
	if err != nil {
		return fmt.Errorf("error deleting session: %v", err)
	}

	return nil
}

// GetAllActiveSessions returns all active session pod names
func GetAllActiveSessions(client *redis.Client) ([]string, error) {
	ctx := context.Background()

	keys, err := client.Keys(ctx, "session:*").Result()
	if err != nil {
		return nil, fmt.Errorf("error retrieving session keys: %v", err)
	}

	var podNames []string
	for _, key := range keys {
		// Extract pod name from session key (remove "session:" prefix)
		podName := key[8:] // len("session:") = 8
		podNames = append(podNames, podName)
	}
	logrus.Infof("Found %d active sessions in Redis: %v", len(podNames), podNames)

	return podNames, nil
}

// CanExtendSession checks if a session can be extended (within last 2 minutes of timeout)
func CanExtendSession(client *redis.Client, sessionID string) (bool, time.Duration, error) {
	ctx := context.Background()

	// Get current TTL from Redis (most accurate)
	sessionKey := fmt.Sprintf("session:%s", sessionID)
	ttl, err := client.TTL(ctx, sessionKey).Result()
	if err != nil {
		return false, 0, fmt.Errorf("error getting session TTL: %v", err)
	}

	if ttl == -2 {
		return false, 0, fmt.Errorf("session does not exist")
	}
	if ttl == -1 {
		return false, 0, fmt.Errorf("session has no expiration")
	}
	// TODO: Handle case where TTL is 9 (session has expired) for testing purposes
	// Allow extension only within last 9 minutes
	if ttl <= 9*time.Minute && ttl > 0 {
		return true, ttl, nil
	}

	return false, ttl, nil
}

// ExtendSession extends the session timeout by the specified duration
func ExtendSession(client *redis.Client, sessionID string, extensionDuration time.Duration) error {
	// ctx := context.Background()

	// Check if extension is allowed
	canExtend, timeLeft, err := CanExtendSession(client, sessionID)
	if err != nil {
		return fmt.Errorf("error checking if session can be extended: %v", err)
	}

	if !canExtend {
		if timeLeft <= 0 {
			return fmt.Errorf("session has already expired")
		}
		return fmt.Errorf("session can only be extended within the last 2 minutes (time left: %v)", timeLeft)
	}

	// Get current session data
	sessionData, err := GetSessionData(client, sessionID)
	if err != nil {
		return fmt.Errorf("error retrieving session data: %v", err)
	}

	// Update last extended timestamp
	sessionData.LastExtendedAt = time.Now()

	// Calculate new TTL for Redis key (add extension to current time left)
	newTTL := timeLeft + extensionDuration

	// Update session in Redis with new TTL
	err = SetSessionData(client, sessionID, sessionData, newTTL)
	if err != nil {
		return fmt.Errorf("error updating session with extended timeout: %v", err)
	}

	logrus.Infof("Extended session %s by %v, new total time: %v", sessionID, extensionDuration, newTTL)
	return nil
}

// GetSessionTimeLeft returns the remaining time for a session
func GetSessionTimeLeft(client *redis.Client, sessionID string) (time.Duration, error) {
	ctx := context.Background()

	sessionKey := fmt.Sprintf("session:%s", sessionID)
	ttl, err := client.TTL(ctx, sessionKey).Result()
	if err != nil {
		return 0, fmt.Errorf("error getting session TTL: %v", err)
	}

	if ttl == -1 {
		return 0, fmt.Errorf("session has no expiration")
	}
	if ttl == -2 {
		return 0, fmt.Errorf("session does not exist")
	}

	return ttl, nil
}

// GetSessionDataWithContext retrieves session data with context
func GetSessionDataWithContext(ctx context.Context, client *redis.Client, podName string) (*SessionData, error) {
	sessionKey := fmt.Sprintf("session:%s", podName)
	sessionJSON, err := client.Get(ctx, sessionKey).Result()
	if err == redis.Nil {
		return nil, fmt.Errorf("session not found for pod: %s", podName)
	} else if err != nil {
		return nil, fmt.Errorf("error retrieving session: %v", err)
	}

	var sessionData SessionData
	err = json.Unmarshal([]byte(sessionJSON), &sessionData)
	if err != nil {
		return nil, fmt.Errorf("error unmarshaling session data: %v", err)
	}

	return &sessionData, nil
}

// GetCurrentSessionTTL gets the actual TTL from Redis for a session
func GetCurrentSessionTTL(ctx context.Context, client *redis.Client, sessionID string) (time.Duration, error) {
	sessionKey := fmt.Sprintf("session:%s", sessionID)
	ttl, err := client.TTL(ctx, sessionKey).Result()
	if err != nil {
		return 0, fmt.Errorf("error getting session TTL from Redis: %v", err)
	}

	if ttl == -2 {
		return 0, fmt.Errorf("session does not exist")
	}
	if ttl == -1 {
		return 0, fmt.Errorf("session has no expiration")
	}

	return ttl, nil
}

// PreserveSessionTimeout preserves the current session timeout during reconnection
func PreserveSessionTimeout(ctx context.Context, client *redis.Client, sessionID string, sessionData *SessionData) error {
	// Get current TTL from Redis
	currentTTL, err := GetCurrentSessionTTL(ctx, client, sessionID)
	if err != nil {
		// Fallback to ExpireAt calculation if Redis TTL fails
		if !sessionData.ExpireAt.IsZero() {
			currentTTL = time.Until(sessionData.ExpireAt)
			logrus.Warnf("Redis TTL failed for session %s, using ExpireAt calculation: %v", sessionID, currentTTL)
		} else {
			// Last resort - use TimeoutDuration
			currentTTL = sessionData.TimeoutDuration
			logrus.Warnf("No TTL or ExpireAt for session %s, using TimeoutDuration: %v", sessionID, currentTTL)
		}
	}

	// Ensure we have a reasonable minimum time
	if currentTTL <= 0 {
		currentTTL = 1 * time.Minute
		logrus.Warnf("Session %s had non-positive TTL, setting to 1 minute grace period", sessionID)
	}

	// Update session with preserved TTL
	return SetSessionDataWithContext(ctx, client, sessionID, sessionData, currentTTL)
}
