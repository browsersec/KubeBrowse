package api

import (
	"context"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"time"

	"github.com/browsersec/KubeBrowse/internal/guac"
	k8s2 "github.com/browsersec/KubeBrowse/internal/k8s"

	redis2 "github.com/browsersec/KubeBrowse/internal/redis"
	"github.com/gin-gonic/gin"
	"github.com/go-redis/redis/v8"
	"github.com/google/uuid"
	"github.com/sirupsen/logrus"
	"k8s.io/client-go/kubernetes"
)

// Struct for request body
type DeploySessionRequest struct {
	Height string `json:"height"`
	Width  string `json:"width"`
	Share  bool   `json:"share,omitempty"` // Added optional share field
}

// DeployOffice godoc
// @Summary New route for deploying and connecting to office pod with RDP credentials
// @Schemes
// @Description New route for deploying and connecting to office pod with RDP credentials
// @Tags test
// @Accept  json
// @Produce  json
// @Param request body DeploySessionRequest true "Session Deployment Request"
// @Success 201 {object} gin.H{"podName":string,"fqdn":string,"connection_id":string,"status":string,"message":string}
// @Failure 503 {object} gin.H{"error":string}
// @Failure 500 {object} gin.H{"error":string}
// @Router /test/deploy-office [post]
func DeployOffice(c *gin.Context, k8sClient *kubernetes.Clientset, k8sNamespace string, redisClient *redis.Client, tunnelStore *guac.ActiveTunnelStore) {

	if k8sClient == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error": "Kubernetes client not initialized",
		})
		return
	}

	var reqBody DeploySessionRequest
	if err := c.ShouldBindJSON(&reqBody); err != nil {
		logrus.Errorf("Failed to bind request body: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Generate a unique pod name
	podName := "office-" + uuid.New().String()[0:8]

	// Create an office sandbox pod
	pod, err := k8s2.CreateOfficeSandboxPod(k8sClient, k8sNamespace, podName)
	if err != nil {
		logrus.Errorf("Failed to create office pod: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": fmt.Sprintf("Failed to create office pod: %v", err),
		})
		return
	}

	// Construct the FQDN
	fqdn := fmt.Sprintf("%s.sandbox-instances.browser-sandbox.svc.cluster.local", pod.Name)

	// Generate a unique connection ID
	connectionID := uuid.New().String()

	// Wait for pod readiness and RDP port
	err = k8s2.WaitForPodReadyAndRDP(k8sClient, k8sNamespace, pod.Name, fqdn, 120*time.Second)
	if err != nil {
		logrus.Errorf("Pod not ready: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Pod not ready for RDP connection"})

		return
	}
	podIP := pod.Status.PodIP
	if podIP == "" {
		logrus.Errorf("Pod IP is empty for connectionID: %s", connectionID)
		podIP = fqdn
	}
	// nsLookup fqdn
	ips, err := net.LookupIP(fqdn)
	if err == nil && len(ips) > 0 {
		podIP = ips[0].String()
	}
	logrus.Infof("Pod IP of connectionID: %s is %s", connectionID, podIP)

	// Store connection parameters in memory (in a real implementation, use a secure storage)
	params := url.Values{}
	params.Set("scheme", "rdp")
	params.Set("hostname", fqdn)
	params.Set("username", "rdpuser")
	params.Set("password", "money4band")
	params.Set("port", "3389")
	params.Set("security", "")
	params.Set("width", reqBody.Width)
	params.Set("height", reqBody.Height)
	params.Set("ignore-cert", "true")
	params.Set("uuid", connectionID)

	// Store the parameters in the tunnelStore store
	tunnelStore.StoreConnectionParams(connectionID, params)

	// Store session in Redis using the struct from internal/redis
	session := redis2.SessionData{
		PodName:      pod.Name,
		PodIP:        podIP,
		FQDN:         fqdn,
		ConnectionID: connectionID,
		ConnectionParams: map[string]string{
			"hostname":    fqdn,
			"ignore-cert": "true",
			"password":    "money4band",
			"port":        "3389",
			"scheme":      "rdp",
			"security":    "",
			"username":    "rdpuser",
			"height":      reqBody.Height,
			"width":       reqBody.Width,
			"uuid":        connectionID,
		},
		Share: reqBody.Share, // Include the share value
	}
	data, _ := json.Marshal(session)
	redisClient.Set(context.Background(), "session:"+connectionID, data, 0)

	// Return only the connection ID to the client
	c.JSON(http.StatusCreated, gin.H{
		"podName":       pod.Name,
		"fqdn":          fqdn,
		"connection_id": connectionID,
		"status":        "creating",
		"message":       "Office pod deployed and connection parameters generated",
	})
}

// DeployBrowser godoc
// @Summary New route for deploying and connecting to browser pod with RDP credentials
// @Schemes
// @Description New route for deploying and connecting to browser pod with RDP credentials
// @Tags test
// @Accept  json
// @Produce  json
// @Param request body DeploySessionRequest true "Session Deployment Request"
// @Success 201 {object} gin.H{"podName":string,"fqdn":string,"connection_id":string,"status":string,"message":string}
// @Failure 503 {object} gin.H{"error":string}
// @Failure 500 {object} gin.H{"error":string}
// @Router /test/deploy-browser [post]
func DeployBrowser(c *gin.Context, k8sClient *kubernetes.Clientset, k8sNamespace string, redisClient *redis.Client, tunnelStore *guac.ActiveTunnelStore) {

	if k8sClient == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error": "Kubernetes client not initialized",
		})
		return
	}

	var reqBody DeploySessionRequest
	if err := c.ShouldBindJSON(&reqBody); err != nil {
		logrus.Errorf("Failed to bind request body: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Generate a unique pod name
	podName := "browser-" + uuid.New().String()[0:8]

	// Create an office sandbox pod
	pod, err := k8s2.CreateBrowserSandboxPod(k8sClient, k8sNamespace, podName)
	if err != nil {
		logrus.Errorf("Failed to create office pod: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": fmt.Sprintf("Failed to create browser pod: %v", err),
		})
		return
	}

	// Construct the FQDN
	fqdn := fmt.Sprintf("%s.sandbox-instances.browser-sandbox.svc.cluster.local", pod.Name)

	// Generate a unique connection ID
	connectionID := uuid.New().String()

	// Wait for pod readiness and RDP port
	err = k8s2.WaitForPodReadyAndRDP(k8sClient, k8sNamespace, pod.Name, fqdn, 120*time.Second)
	if err != nil {
		logrus.Errorf("Pod not ready: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Pod not ready for RDP connection"})
		return
	}
	podIP := pod.Status.PodIP
	if podIP == "" {
		logrus.Errorf("Pod IP is empty for connectionID: %s", connectionID)
		podIP = fqdn
	}
	// nsLookup fqdn
	ips, err := net.LookupIP(fqdn)
	if err == nil && len(ips) > 0 {
		podIP = ips[0].String()
	}
	logrus.Infof("Pod IP of connectionID: %s is %s", connectionID, podIP)

	// Store connection parameters in memory (in a real implementation, use a secure storage)
	params := url.Values{}
	params.Set("scheme", "rdp")
	params.Set("hostname", fqdn)
	params.Set("username", "rdpuser")
	params.Set("password", "money4band")
	params.Set("port", "3389")
	params.Set("security", "")
	params.Set("width", reqBody.Width)
	params.Set("height", reqBody.Height)
	params.Set("ignore-cert", "true")
	params.Set("uuid", connectionID)

	// Store the parameters in the tunnelStore store
	tunnelStore.StoreConnectionParams(connectionID, params)

	// Store session in Redis using the struct from internal/redis
	session := redis2.SessionData{
		PodName:      pod.Name,
		PodIP:        podIP,
		FQDN:         fqdn,
		ConnectionID: connectionID,
		ConnectionParams: map[string]string{
			"hostname":    fqdn,
			"ignore-cert": "true",
			"password":    "money4band",
			"port":        "3389",
			"scheme":      "rdp",
			"security":    "",
			"username":    "rdpuser",
			"height":      reqBody.Height,
			"width":       reqBody.Width,
			"uuid":        connectionID,
		},
		Share: reqBody.Share, // Include the share value
	}
	data, _ := json.Marshal(session)
	redisClient.Set(context.Background(), "session:"+connectionID, data, 0)

	// Return only the connection ID to the client
	c.JSON(http.StatusCreated, gin.H{
		"podName":       pod.Name,
		"fqdn":          fqdn,
		"connection_id": connectionID,
		"status":        "creating",
		"message":       "Browser pod deployed and connection parameters generated",
	})
}

func HandlerConnectionID(c *gin.Context, tunnelStore *guac.ActiveTunnelStore, redisClient *redis.Client) {

	connectionID := c.Param("connectionID")

	if connectionID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Connection ID is required"})
		return
	}

	// Check if the connectionID is valid in redis
	_, err := redisClient.Get(context.Background(), "session:"+connectionID).Result()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get session data"})
		return
	}

	// Get stored parameters
	_, exists := tunnelStore.GetConnectionParams(connectionID)
	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "Connection parameters not found"})
		return
	}

	// Construct the websocket URL with only the connection ID
	wsURL := fmt.Sprintf("/websocket-tunnel?uuid=%s", connectionID)

	c.JSON(http.StatusOK, gin.H{
		"websocket_url": wsURL,
		"status":        "ready",
		"message":       "Connection parameters retrieved successfully",
	})
}

func HandlerShareSession(c *gin.Context, tunnelStore *guac.ActiveTunnelStore, redisClient *redis.Client) {
	connectionID := c.Param("connectionID")
	if connectionID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Connection ID is required"})
		return
	}

	ctx := context.Background()
	sessionKey := fmt.Sprintf("session:%s", connectionID)

	// Get current session data and TTL
	sessionJSON, err := redisClient.Get(ctx, sessionKey).Result()
	if err != nil {
		logrus.Errorf("Failed to get session data for %s: %v", connectionID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get session data"})
		return
	}

	// Get current TTL before modifying the session
	currentTTL, err := redisClient.TTL(ctx, sessionKey).Result()
	if err != nil {
		logrus.Errorf("Failed to get TTL for session %s: %v", connectionID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get session TTL"})
		return
	}

	// If TTL is -1 (no expiration) or -2 (key doesn't exist), handle appropriately
	if currentTTL == -2*time.Second {
		logrus.Errorf("Session %s does not exist", connectionID)
		c.JSON(http.StatusNotFound, gin.H{"error": "Session not found"})
		return
	}
	if currentTTL == -1*time.Second {
		// Session has no expiration, set a default timeout
		currentTTL = 10 * time.Minute
		logrus.Warnf("Session %s has no TTL, setting default 10 minutes", connectionID)
	}

	// Parse session data
	var sessionData redis2.SessionData
	err = json.Unmarshal([]byte(sessionJSON), &sessionData)
	if err != nil {
		logrus.Errorf("Failed to unmarshal session data for %s: %v", connectionID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to unmarshal session data"})
		return
	}

	// Update the share flag
	sessionData.Share = true
	logrus.Infof("Enabling sharing for session %s (TTL: %v)", connectionID, currentTTL.Round(time.Second))

	// Marshal updated session data
	updatedData, err := json.Marshal(sessionData)
	if err != nil {
		logrus.Errorf("Failed to marshal updated session data for %s: %v", connectionID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to marshal session data"})
		return
	}

	// Update Redis with preserved TTL
	err = redisClient.Set(ctx, sessionKey, updatedData, currentTTL).Err()
	if err != nil {
		logrus.Errorf("Failed to update session data for %s: %v", connectionID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update session data"})
		return
	}

	logrus.Infof("Successfully enabled sharing for session %s with preserved TTL %v", connectionID, currentTTL.Round(time.Second))

	// Check if connection parameters exist
	_, exists := tunnelStore.GetConnectionParams(connectionID)
	if !exists {
		logrus.Errorf("Connection parameters not found for %s", connectionID)
		c.JSON(http.StatusNotFound, gin.H{"error": "Connection parameters not found"})
		return
	}

	// Construct the websocket URL with only the connection ID
	wsURL := fmt.Sprintf("/websocket-tunnel/share?uuid=%s", connectionID)

	c.JSON(http.StatusOK, gin.H{
		"websocket_url": wsURL,
		"status":        "ready",
		"message":       "Session sharing enabled successfully",
	})
}

func HandlerBrowserPod(c *gin.Context, tunnelStore *guac.ActiveTunnelStore, k8sClient *kubernetes.Clientset, k8sNamespace string) {
	if k8sClient == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error": "Kubernetes client not initialized",
		})
		return
	}

	// Generate a dummy user ID for testing
	userID := "test-" + uuid.New().String()[0:8]

	// Create a browser sandbox pod
	pod, err := k8s2.CreateBrowserSandboxPod(k8sClient, k8sNamespace, userID+"-browser")
	if err != nil {
		logrus.Errorf("Failed to create browser pod: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": fmt.Sprintf("Failed to create browser pod: %v", err),
		})
		return
	}

	// Connection URI for the pod (simplified version)
	connectionURI := fmt.Sprintf("/guac/?id=%s&type=browser", pod.Name)

	c.JSON(http.StatusCreated, gin.H{
		"podName":       pod.Name,
		"namespace":     pod.Namespace,
		"status":        "creating",
		"connectionURI": connectionURI,
		"podIP":         pod.Status.PodIP,
		"message":       "Browser sandbox pod created successfully",
	})
}

func HandlerOfficePod(c *gin.Context, tunnelStore *guac.ActiveTunnelStore, k8sClient *kubernetes.Clientset, k8sNamespace string) {
	if k8sClient == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error": "Kubernetes client not initialized",
		})
		return
	}

	// Generate a dummy user ID for testing
	userID := "test-" + uuid.New().String()[0:8]

	// Create an office sandbox pod
	pod, err := k8s2.CreateOfficeSandboxPod(k8sClient, k8sNamespace, userID+"-office")
	if err != nil {
		logrus.Errorf("Failed to create office pod: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": fmt.Sprintf("Failed to create office pod: %v", err),
		})
		return
	}

	// Connection URI for the pod (simplified version)
	connectionURI := fmt.Sprintf("/guac/?id=%s&type=office", pod.Name)

	c.JSON(http.StatusCreated, gin.H{
		"podName":       pod.Name,
		"namespace":     pod.Namespace,
		"status":        "creating",
		"connectionURI": connectionURI,
		"podIP":         pod.Status.PodIP,
		"message":       "Office sandbox pod created successfully",
	})

}
