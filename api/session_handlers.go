package api

import (
	"fmt"
	"net/http"
	"time"

	redis2 "github.com/browsersec/KubeBrowse/internal/redis"
	"github.com/gin-gonic/gin"
	"github.com/go-redis/redis/v8"
	"github.com/sirupsen/logrus"
)

type ExtendSessionRequest struct {
	ExtensionMinutes int `json:"extension_minutes" binding:"required,min=1,max=10"`
}

type SessionTimeResponse struct {
	SessionID    string `json:"session_id"`
	TimeLeft     string `json:"time_left"`
	CanExtend    bool   `json:"can_extend"`
	TotalSeconds int64  `json:"total_seconds"`
}

type ExtendSessionResponse struct {
	SessionID       string `json:"session_id"`
	Extended        bool   `json:"extended"`
	NewTimeLeft     string `json:"new_time_left"`
	ExtensionAmount string `json:"extension_amount"`
	Message         string `json:"message"`
}

// HandlerExtendSession handles session timeout extension requests
func HandlerExtendSession(c *gin.Context, redisClient *redis.Client) {
	connectionID := c.Param("connectionID")
	if connectionID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Connection ID is required",
		})
		return
	}

	var req ExtendSessionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": fmt.Sprintf("Invalid request: %v", err),
		})
		return
	}

	// Check if session can be extended
	canExtend, timeLeft, err := redis2.CanExtendSession(redisClient, connectionID)
	if err != nil {
		logrus.Errorf("Error checking if session %s can be extended: %v", connectionID, err)
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Session not found",
		})
		return
	}

	if !canExtend {
		var message string
		if timeLeft <= 0 {
			message = "Session has already expired"
		} else {
			message = fmt.Sprintf("Session can only be extended within the last 2 minutes. Time remaining: %v", timeLeft)
		}

		c.JSON(http.StatusForbidden, ExtendSessionResponse{
			SessionID: connectionID,
			Extended:  false,
			Message:   message,
		})
		return
	}

	// Extend the session
	extensionDuration := time.Duration(req.ExtensionMinutes) * time.Minute
	err = redis2.ExtendSession(redisClient, connectionID, extensionDuration)
	if err != nil {
		logrus.Errorf("Error extending session %s: %v", connectionID, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": fmt.Sprintf("Failed to extend session: %v", err),
		})
		return
	}

	// Get new time left after extension
	newTimeLeft, err := redis2.GetSessionTimeLeft(redisClient, connectionID)
	if err != nil {
		logrus.Warnf("Error getting updated time left for session %s: %v", connectionID, err)
		newTimeLeft = timeLeft + extensionDuration // More accurate fallback
	}

	logrus.Infof("Successfully extended session %s by %d minutes", connectionID, req.ExtensionMinutes)

	c.JSON(http.StatusOK, ExtendSessionResponse{
		SessionID:       connectionID,
		Extended:        true,
		NewTimeLeft:     newTimeLeft.String(),
		ExtensionAmount: extensionDuration.String(),
		Message:         fmt.Sprintf("Session extended by %d minutes", req.ExtensionMinutes),
	})
}

// HandlerGetSessionTimeLeft returns the remaining time for a session
func HandlerGetSessionTimeLeft(c *gin.Context, redisClient *redis.Client) {
	connectionID := c.Param("connectionID")
	if connectionID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Connection ID is required",
		})
		return
	}

	timeLeft, err := redis2.GetSessionTimeLeft(redisClient, connectionID)
	if err != nil {
		logrus.Errorf("Error getting time left for session %s: %v", connectionID, err)
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Session not found or expired",
		})
		return
	}

	// Check if session can be extended
	canExtend, _, err := redis2.CanExtendSession(redisClient, connectionID)
	if err != nil {
		logrus.Warnf("Error checking if session %s can be extended: %v", connectionID, err)
		canExtend = false
	}

	c.JSON(http.StatusOK, SessionTimeResponse{
		SessionID:    connectionID,
		TimeLeft:     timeLeft.String(),
		CanExtend:    canExtend,
		TotalSeconds: int64(timeLeft.Seconds()),
	})
}
