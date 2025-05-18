package api

import (
	"context"

	"encoding/json"
	"net/http"

	"fmt"
	redis2 "github.com/browsersec/KubeBrowse/internal/redis"
	"github.com/browsersec/KubeBrowse/k8s"
	"github.com/gin-gonic/gin"
	"github.com/go-redis/redis/v8"
	"github.com/sirupsen/logrus"
	"k8s.io/client-go/kubernetes"
)

// Endpoint to stop a specific WebSocket session
func HandlerStopWSSession(c *gin.Context, redisClient *redis.Client, k8sClient *kubernetes.Clientset) {
	connectionID := c.Param("connectionID")
	if connectionID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Connection ID is required"})
		return
	}
	val, err := redisClient.Get(context.Background(), "session:"+connectionID).Result()
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Session not found"})
		return
	}
	var session redis2.SessionData
	err = json.Unmarshal([]byte(val), &session)
	if err != nil {
		logrus.Errorf("Failed to unmarshal session data: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to unmarshal session data"})
		return
	}
	err = k8s.DeletePod(k8sClient, session.PodName)
	if err != nil {
		logrus.Errorf("Failed to delete pod: %v", err)
	}
	redisClient.Del(context.Background(), "session:"+connectionID)
	c.JSON(http.StatusOK, gin.H{"message": fmt.Sprintf("Session %s stopped and pod deleted.", connectionID)})
}
