package api

import (
	"context"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"time"

	guac "github.com/browsersec/KubeBrowse"
	"github.com/browsersec/KubeBrowse/k8s"
	"github.com/gin-gonic/gin"
	"github.com/go-redis/redis/v8"
	"github.com/google/uuid"
	"github.com/sirupsen/logrus"
	"k8s.io/client-go/kubernetes"
)

// DeployOffice godoc
// @Summary New route for deploying and connecting to office pod with RDP credentials
// @Schemes
// @Description New route for deploying and connecting to office pod with RDP credentials
// @Tags test
func DeployOffice(c *gin.Context, k8sClient *kubernetes.Clientset, k8sNamespace string, redisClient *redis.Client, activeTunnels *guac.ActiveTunnelStore) {

	if k8sClient == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error": "Kubernetes client not initialized",
		})
		return
	}
	height := c.Query("height")
	width := c.Query("width")

	// Generate a unique pod name
	podName := "office-" + uuid.New().String()[0:8]

	// Create an office sandbox pod
	pod, err := k8s.CreateOfficeSandboxPod(k8sClient, k8sNamespace, podName)
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
	err = k8s.WaitForPodReadyAndRDP(k8sClient, k8sNamespace, pod.Name, fqdn, 60*time.Second)
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
	params.Set("width", width)
	params.Set("height", height)
	params.Set("ignore-cert", "true")
	params.Set("uuid", connectionID)

	// Store the parameters in the activeTunnels store
	activeTunnels.StoreConnectionParams(connectionID, params)

	// Define SessionData struct
	type SessionData struct {
		PodName          string            `json:"podName"`
		PodIP            string            `json:"podIP"`
		FQDN             string            `json:"fqdn"`
		ConnectionID     string            `json:"connection_id"`
		ConnectionParams map[string]string `json:"connection_params"`
	}

	// Store session in Redis
	session := SessionData{
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
			"height":      height,
			"width":       width,
			"uuid":        connectionID,
		},
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

func HandlerConnectionID(c *gin.Context, activeTunnels *guac.ActiveTunnelStore) {
	connectionID := c.Param("connectionID")
	if connectionID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Connection ID is required"})
		return
	}

	// Get stored parameters
	_, exists := activeTunnels.GetConnectionParams(connectionID)
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

func HandlerBrowserPod(c *gin.Context, activeTunnels *guac.ActiveTunnelStore, k8sClient *kubernetes.Clientset, k8sNamespace string) {
	if k8sClient == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error": "Kubernetes client not initialized",
		})
		return
	}

	// Generate a dummy user ID for testing
	userID := "test-" + uuid.New().String()[0:8]

	// Create a browser sandbox pod
	pod, err := k8s.CreateBrowserSandboxPod(k8sClient, k8sNamespace, userID+"-browser")
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

func HandlerOfficePod(c *gin.Context, activeTunnels *guac.ActiveTunnelStore, k8sClient *kubernetes.Clientset, k8sNamespace string) {
	if k8sClient == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error": "Kubernetes client not initialized",
		})
		return
	}

	// Generate a dummy user ID for testing
	userID := "test-" + uuid.New().String()[0:8]

	// Create an office sandbox pod
	pod, err := k8s.CreateOfficeSandboxPod(k8sClient, k8sNamespace, userID+"-office")
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
