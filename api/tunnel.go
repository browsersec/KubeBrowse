package api

import (
	"context"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"time"

	"github.com/browsersec/KubeBrowse/internal/cleanup"
	guac2 "github.com/browsersec/KubeBrowse/internal/guac"
	redis2 "github.com/browsersec/KubeBrowse/internal/redis"
	"github.com/go-redis/redis/v8"
	"github.com/sirupsen/logrus"
)

var SESSION_TIMEOUT int

func init() {
	timeoutStr := os.Getenv("POD_SESSION_TIMEOUT")
	timeout, err := strconv.Atoi(timeoutStr)
	if err != nil || timeout <= 0 {
		SESSION_TIMEOUT = 10 // default to 10 minutes if not set or invalid
		logrus.Warnf("Invalid or unset POD_SESSION_TIMEOUT environment variable, defaulting to %d minutes", SESSION_TIMEOUT)
	} else {
		SESSION_TIMEOUT = timeout
	}
}

// DemoDoConnect creates the tunnel to the remote machine (via guacd)
// Now accepts ActiveTunnelStore to register the tunnel
func DemoDoConnect(request *http.Request, tunnelStore *guac2.ActiveTunnelStore, redisClient *redis.Client, guacdAddr string, cleanupService *cleanup.SessionCleanupService) (guac2.Tunnel, error) {
	config := guac2.NewGuacamoleConfiguration()
	var query url.Values
	uuid := request.URL.Query().Get("uuid")
	var session redis2.SessionData

	if uuid != "" {
		val, err := redisClient.Get(context.Background(), "session:"+uuid).Result()
		if err != nil {
			logrus.Errorf("Failed to get session from Redis for UUID %s: %v", uuid, err)
			return nil, fmt.Errorf("session not found")
		}
		err = json.Unmarshal([]byte(val), &session)
		logrus.Debugf("Retrieved session data for UUID %s: %+v", uuid, session)
		if err != nil {
			logrus.Errorf("Failed to unmarshal session data for UUID %s: %v", uuid, err)
			return nil, fmt.Errorf("failed to unmarshal session data")
		}

		// Initialize timeout fields if they don't exist (for backward compatibility)
		if session.CreatedAt.IsZero() {
			session.CreatedAt = time.Now()
			// TODO: Set a sensible default timeout duration if not set
			session.TimeoutDuration = time.Duration(SESSION_TIMEOUT) * time.Minute
		}

		if session.ExpireAt.IsZero() {
			// First time: set absolute expiration
			session.ExpireAt = time.Now().Add(session.TimeoutDuration)
		}

		query = url.Values{}
		for k, v := range session.ConnectionParams {
			query.Set(k, v)
		}

		// Check if this is a reconnection and clear the reconnect key
		ctx := context.Background()
		reconnectKey := fmt.Sprintf("reconnect:%s", uuid)
		exists, err := redisClient.Exists(ctx, reconnectKey).Result()
		if err == nil && exists > 0 {
			// This is a reconnection - clear the reconnect key to signal successful reconnection
			err = redisClient.Del(ctx, reconnectKey).Err()
			if err != nil {
				logrus.Errorf("Failed to clear reconnect key for %s: %v", uuid, err)
			} else {
				logrus.Infof("User reconnected to session %s, cleared reconnection window", uuid)
			}

			// Reset disconnection count but preserve existing timeout
			session.DisconnectionCount = 0

			// Get the current TTL from Redis (most accurate remaining time)
			sessionKey := fmt.Sprintf("session:%s", uuid)
			currentTTL, err := redisClient.TTL(ctx, sessionKey).Result()
			if err != nil || currentTTL <= 0 {
				// Fallback to calculating from ExpireAt if TTL fails
				if !session.ExpireAt.IsZero() {
					currentTTL = time.Until(session.ExpireAt)
					logrus.Warnf("Could not get TTL from Redis for session %s, calculated from ExpireAt: %v", uuid, currentTTL)
				} else {
					// Last resort fallback
					currentTTL = 10 * time.Minute
					logrus.Warnf("Could not determine remaining time for session %s, using default 10 minutes", uuid)
				}
			}

			// Ensure we don't use negative TTL
			if currentTTL <= 0 {
				currentTTL = 1 * time.Minute // Give at least 1 minute for reconnection
				logrus.Warnf("Session %s had expired or negative TTL, giving 1 minute grace period", uuid)
			}

			// Update session in Redis with the preserved TTL
			err = redis2.SetSessionData(redisClient, uuid, &session, currentTTL)
			if err != nil {
				logrus.Errorf("Failed to update session data for reconnection %s: %v", uuid, err)
			} else {
				logrus.Infof("Preserved session %s timeout (%v remaining) after reconnection", uuid, currentTTL.Round(time.Second))
			}
		} else {
			// Not a reconnection - use normal timeout logic
			remaining := redis2.GetRemainingTTL(&session)
			if remaining <= 0 {
				remaining = session.TimeoutDuration
			}
			err = redis2.SetSessionData(redisClient, uuid, &session, remaining)
			if err != nil {
				logrus.Errorf("Failed to update session data for %s: %v", uuid, err)
			}
		}
	} else {
		query = request.URL.Query()
	}

	// Check if we have stored parameters for this connection
	if uuid := query.Get("uuid"); uuid != "" {
		if storedParams, exists := tunnelStore.GetConnectionParams(uuid); exists {
			logrus.Debugf("Using stored parameters for UUID %s", uuid)
			// Use stored parameters instead of query parameters
			query = storedParams
		} else {
			logrus.Debugf("No stored parameters found for UUID %s", uuid)
		}
	}

	config.Protocol = query.Get("scheme")
	config.Parameters = map[string]string{}
	for k, v := range query {
		config.Parameters[k] = v[0]
	}

	var err error
	if query.Get("width") != "" {
		config.OptimalScreenHeight, err = strconv.Atoi(query.Get("width"))
		if err != nil || config.OptimalScreenHeight == 0 {
			logrus.Errorf("Invalid height value '%s': %v", query.Get("width"), err)
			config.OptimalScreenHeight = 600
		}
	}
	if query.Get("height") != "" {
		config.OptimalScreenWidth, err = strconv.Atoi(query.Get("height"))
		if err != nil || config.OptimalScreenWidth == 0 {

			// InitRedis initializes the Redis client
			logrus.Errorf("Invalid width value '%s': %v", query.Get("height"), err)
			config.OptimalScreenWidth = 800
		}
	}
	config.AudioMimetypes = []string{"audio/L16", "rate=44100", "channels=2"}

	logrus.Debugf("Attempting to connect to guacd at %s", guacdAddr)
	addr, err := net.ResolveTCPAddr("tcp", guacdAddr)
	if err != nil {
		logrus.Errorf("Failed to resolve guacd address %s: %v", guacdAddr, err)
		return nil, err
	}

	// Set connection timeout
	dialer := net.Dialer{
		Timeout: 60 * time.Second,
	}
	logrus.Debugf("Attempting to establish TCP connection to guacd at %s with timeout %v", addr.String(), dialer.Timeout)
	conn, err := dialer.Dial("tcp", addr.String())
	if err != nil {
		logrus.Errorf("Failed to connect to guacd at %s: %v", addr.String(), err)
		return nil, err
	}

	stream := guac2.NewStream(conn, guac2.SocketTimeout)
	logrus.Debugf("TCP connection established, created new stream with timeout %v", guac2.SocketTimeout)

	logrus.Debug("Successfully connected to guacd")
	if request.URL.Query().Get("uuid") != "" {
		config.ConnectionID = request.URL.Query().Get("uuid")
	}

	sanitisedCfg := config

	if session.Share {
		sanitisedCfg.Parameters["password"] = "********"
	} else {
		sanitisedCfg.ConnectionID = ""
	}

	logrus.Debugf("Starting handshake with config: %#v", sanitisedCfg)

	// err = stream.Handshake(config)
	// if err != nil {
	//     logrus.Errorf("Handshake failed: %v", err)
	//     return nil, err
	// }

	// Add context with timeout for handshake
	ctx, cancel := context.WithTimeout(context.Background(), 45*time.Second)
	defer cancel()

	// Create a channel to handle the handshake
	handshakeDone := make(chan error, 1)
	go func() {
		handshakeDone <- stream.Handshake(config)
	}()

	// Wait for handshake with timeout
	select {
	case err := <-handshakeDone:
		if err != nil {
			logrus.Errorf("Handshake failed: %v. Connection details - Local: %s, Remote: %s",
				err,
				conn.LocalAddr().String(),
				conn.RemoteAddr().String())
			return nil, err
		}
	case <-ctx.Done():
		logrus.Errorf("Handshake timed out after 40 seconds. Connection details - Local: %s, Remote: %s",
			conn.LocalAddr().String(),
			conn.RemoteAddr().String())
		return nil, fmt.Errorf("handshake timed out: %v", ctx.Err())
	}

	logrus.Debug("Handshake completed successfully")

	tunnel := guac2.NewSimpleTunnel(stream)

	// Register the tunnel with its ConnectionID after handshake
	if tunnel != nil && tunnel.ConnectionID() != "" {
		// The request object 'req' for Add method is 'nil' here.
		// If it's crucial, it needs to be passed down or handled differently.
		// For now, passing nil as it's not used by the current Add implementation.
		tunnelStore.Add(tunnel.ConnectionID(), tunnel, nil)
		logrus.Debugf("Tunnel %s successfully added to active store", tunnel.ConnectionID())

		// TODO: Register session with cleanup service if available
		// This would require passing the cleanup service to this function
		// or accessing it through a global variable
		cleanupService.RegisterSession(
			session.ConnectionID,
			session.PodName,
			tunnel.ConnectionID(), // Assuming PodName is the user ID
		)

	} else if tunnel != nil {
		logrus.Warnf("Tunnel created but ConnectionID is empty. Not adding to store. UUID: %s", tunnel.GetUUID())
	} else {
		logrus.Error("Failed to create tunnel - tunnel is nil")
	}

	return tunnel, nil
}
