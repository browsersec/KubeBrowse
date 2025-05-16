package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"time"

	guac "github.com/browsersec/KubeBrowse"
	"github.com/browsersec/KubeBrowse/k8s"
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/go-redis/redis/v8"
	"github.com/google/uuid"
	"github.com/sirupsen/logrus"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
)

var (
	certPath     string
	certKeyPath  string
	guacdAddr    = "0.0.0.0:4822"
	k8sClient    *kubernetes.Clientset
	k8sNamespace = "browser-sandbox"
)

var activeTunnels *guac.ActiveTunnelStore
var redisClient *redis.Client

// GinHandlerAdapter adapts http.Handler to gin.HandlerFunc
func GinHandlerAdapter(h http.Handler) gin.HandlerFunc {
	return func(c *gin.Context) {
		h.ServeHTTP(c.Writer, c.Request)
	}
}

func initRedis() {
	redisClient = redis.NewClient(&redis.Options{
		Addr: "redis:6379",
	})
	// check if redis is connected
	_, err := redisClient.Ping(context.Background()).Result()
	if err != nil {
		logrus.Printf("Failed to connect to Redis: %v", err)
	}
}

// SessionData struct for Redis
type SessionData struct {
	PodName          string            `json:"podName"`
	FQDN             string            `json:"fqdn"`
	ConnectionID     string            `json:"connection_id"`
	ConnectionParams map[string]string `json:"connection_params"`
}

func main() {
	initRedis()
	// Parse command line flags
	helpFlag := flag.Bool("h", false, "Display help information")
	flag.Parse()

	// Check if help flag was provided
	if *helpFlag {
		displayHelp()
		return
	}

	logrus.SetLevel(logrus.DebugLevel)

	// Get environment variables
	if os.Getenv("CERT_PATH") != "" {
		certPath = os.Getenv("CERT_PATH")
		// Check if certificate file exists
		if _, err := os.Stat(certPath); os.IsNotExist(err) {
			logrus.Warnf("Certificate file %s does not exist", certPath)
		}
	}

	if os.Getenv("CERT_KEY_PATH") != "" {
		certKeyPath = os.Getenv("CERT_KEY_PATH")
		// Check if key file exists
		if _, err := os.Stat(certKeyPath); os.IsNotExist(err) {
			logrus.Warnf("Certificate key file %s does not exist", certKeyPath)
		}
	}

	if certPath != "" && certKeyPath == "" {
		logrus.Fatal("You must set the CERT_KEY_PATH environment variable to specify the full path to the certificate keyfile")
	}

	if certPath == "" && certKeyPath != "" {
		logrus.Fatal("You must set the CERT_PATH environment variable to specify the full path to the certificate file")
	}

	if os.Getenv("GUACD_ADDRESS") != "" {
		guacdAddr = os.Getenv("GUACD_ADDRESS")
	}

	if os.Getenv("KUBERNETES_NAMESPACE") != "" {
		k8sNamespace = os.Getenv("KUBERNETES_NAMESPACE")
	}

	activeTunnels = guac.NewActiveTunnelStore()

	// Initialize Kubernetes client with fallback for local development
	config, err := rest.InClusterConfig()
	if err != nil {
		logrus.Warnf("Failed to create in-cluster config: %v", err)
		logrus.Info("Attempting to use local kubeconfig file")

		// Try to use the kubeconfig file instead
		kubeconfigPath := os.Getenv("KUBECONFIG")
		if kubeconfigPath == "" {
			// Default kubeconfig location if not specified
			homeDir, err := os.UserHomeDir()
			if err == nil {
				kubeconfigPath = filepath.Join(homeDir, ".kube", "config")
			}
		}

		if kubeconfigPath != "" {
			// Import clientcmd at the top of the file
			config, err = clientcmd.BuildConfigFromFlags("", kubeconfigPath)
			if err != nil {
				logrus.Errorf("Failed to create kubernetes client config from kubeconfig: %v", err)
				logrus.Warn("Continuing without Kubernetes client - pod creation functions will not work")
			} else {
				logrus.Infof("Using kubeconfig from: %s", kubeconfigPath)
			}
		} else {
			logrus.Warn("No kubeconfig file found. Continuing without Kubernetes client")
		}
	}

	if config != nil {
		k8sClient, err = kubernetes.NewForConfig(config)
		if err != nil {
			logrus.Errorf("Failed to create Kubernetes client: %v", err)
			logrus.Warn("Continuing without Kubernetes client - pod creation functions will not work")
		} else {
			logrus.Info("Successfully connected to Kubernetes")
		}
	}

	// Initialize Gin
	gin.SetMode(gin.ReleaseMode)
	router := gin.New()
	router.Use(cors.Default())
	router.Use(gin.Recovery())
	router.Use(gin.Logger())

	// Initialize Guacamole handlers
	// servlet := guac.NewServer(DemoDoConnect) // We'll adjust this if DemoDoConnect's signature changes, or use a wrapper
	// wsServer := guac.NewWebsocketServer(DemoDoConnect) // Same here

	// Pass activeTunnels to DemoDoConnect by wrapping it
	doConnectWrapper := func(request *http.Request) (guac.Tunnel, error) {
		return DemoDoConnect(request, activeTunnels)
	}

	servlet := guac.NewServer(doConnectWrapper)
	wsServer := guac.NewWebsocketServer(doConnectWrapper)

	// sessions := guac.NewMemorySessionStore() // Old store
	// wsServer.OnConnect = sessions.Add // Old OnConnect
	// wsServer.OnDisconnect = sessions.Delete // Old OnDisconnect

	// OnConnect is implicitly handled by DemoDoConnect now adding to activeTunnels.
	// We still need OnDisconnect to remove from the store when a tunnel closes for any reason.
	wsServer.OnDisconnect = func(connectionID string, req *http.Request, tunnel guac.Tunnel) {
		logrus.Debugf("Websocket disconnected, removing tunnel: %s", connectionID)
		activeTunnels.Delete(connectionID, req, tunnel)
	}

	// Setup routes using Gin
	router.Any("/tunnel", GinHandlerAdapter(servlet))
	router.Any("/tunnel/*path", GinHandlerAdapter(servlet))
	router.Any("/websocket-tunnel", GinHandlerAdapter(wsServer))

	// Session management handler
	router.GET("/sessions/", func(c *gin.Context) {
		c.Header("Content-Type", "application/json")

		// sessions.RLock() // Old store lock
		// defer sessions.RUnlock() // Old store unlock

		type ConnInfo struct {
			Uuid string `json:"uuid"`
			// Num  int    `json:"num"` // We don't have a 'Num' equivalent directly, can show count if needed
		}

		// connIds := make([]*ConnIds, len(sessions.ConnIds)) // Old way
		allIDs := activeTunnels.GetAllIDs()
		connInfos := make([]*ConnInfo, len(allIDs))

		// i := 0 // Old way
		// for id, num := range sessions.ConnIds { // Old way
		// 	connIds[i] = &ConnIds{ // Old way
		// 		Uuid: id, // Old way
		// 		Num:  num, // Old way
		// 	}
		// 	i++ // Old way
		// }
		for i, id := range allIDs {
			connInfos[i] = &ConnInfo{Uuid: id}
		}

		// c.JSON(http.StatusOK, connIds) // Old way
		c.JSON(http.StatusOK, gin.H{
			"active_sessions": len(connInfos),
			"connection_ids":  connInfos,
		})
	})

	// Add test routes for pod creation
	testRoutes := router.Group("/test")
	{
		// New route for deploying and connecting to office pod with RDP credentials
		testRoutes.POST("/deploy-office", func(c *gin.Context) {
			if k8sClient == nil {
				c.JSON(http.StatusServiceUnavailable, gin.H{
					"error": "Kubernetes client not initialized",
				})
				return
			}

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

			// Store connection parameters in memory (in a real implementation, use a secure storage)
			params := url.Values{}
			params.Set("scheme", "rdp")
			params.Set("hostname", fqdn)
			params.Set("username", "rdpuser")
			params.Set("password", "money4band")
			params.Set("width", "1920")
			params.Set("height", "1080")
			params.Set("ignore-cert", "true")
			params.Set("uuid", connectionID)

			// Store the parameters in the activeTunnels store
			activeTunnels.StoreConnectionParams(connectionID, params)

			// Wait for pod readiness and RDP port
			err = k8s.WaitForPodReadyAndRDP(k8sClient, k8sNamespace, pod.Name, fqdn, 60*time.Second)
			if err != nil {
				logrus.Errorf("Pod not ready: %v", err)
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Pod not ready for RDP connection"})
				return
			}

			// Store session in Redis
			session := SessionData{
				PodName:      pod.Name,
				FQDN:         fqdn,
				ConnectionID: connectionID,
				ConnectionParams: map[string]string{
					"scheme":      "rdp",
					"hostname":    fqdn,
					"username":    "rdpuser",
					"password":    "money4band",
					"width":       "1920",
					"height":      "1080",
					"ignore-cert": "true",
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
		})

		// New endpoint to handle websocket connections using stored parameters
		testRoutes.GET("/connect/:connectionID", func(c *gin.Context) {
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
		})

		// Test route to create a browser sandbox pod
		testRoutes.POST("/browser-pod", func(c *gin.Context) {
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
				"message":       "Browser sandbox pod created successfully",
			})
		})

		// Test route to create an office sandbox pod
		testRoutes.POST("/office-pod", func(c *gin.Context) {
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
				"message":       "Office sandbox pod created successfully",
			})
		})
	}

	// Endpoint to stop a specific WebSocket session
	router.DELETE("/sessions/:connectionID/stop", func(c *gin.Context) {
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
		var session SessionData
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
	})

	// Start server with appropriate TLS configuration
	addr := "0.0.0.0:4567"
	if certPath != "" {
		logrus.Println("Serving on https://", addr)
		err := router.RunTLS(addr, certPath, certKeyPath)
		if err != nil {
			logrus.Fatal(err)
		}
	} else {
		logrus.Println("Serving on http://", addr)
		err := router.Run(addr)
		if err != nil {
			logrus.Fatal(err)
		}
	}
}

// DemoDoConnect creates the tunnel to the remote machine (via guacd)
// Now accepts ActiveTunnelStore to register the tunnel
func DemoDoConnect(request *http.Request, tunnelStore *guac.ActiveTunnelStore) (guac.Tunnel, error) {
	config := guac.NewGuacamoleConfiguration()
	var query url.Values
	uuid := request.URL.Query().Get("uuid")
	if uuid != "" {
		val, err := redisClient.Get(context.Background(), "session:"+uuid).Result()
		if err != nil {
			logrus.Error("Session not found in Redis")
			return nil, fmt.Errorf("session not found")
		}
		var session SessionData
		err = json.Unmarshal([]byte(val), &session)
		if err != nil {
			logrus.Errorf("Failed to unmarshal session data: %v", err)
			return nil, fmt.Errorf("failed to unmarshal session data")
		}
		query = url.Values{}
		for k, v := range session.ConnectionParams {
			query.Set(k, v)
		}
	} else {
		query = request.URL.Query()
	}

	// Check if we have stored parameters for this connection
	if uuid := query.Get("uuid"); uuid != "" {
		if storedParams, exists := tunnelStore.GetConnectionParams(uuid); exists {
			// Use stored parameters instead of query parameters
			query = storedParams
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
			logrus.Error("Invalid height")
			config.OptimalScreenHeight = 600
		}
	}
	if query.Get("height") != "" {
		config.OptimalScreenWidth, err = strconv.Atoi(query.Get("height"))
		if err != nil || config.OptimalScreenWidth == 0 {
			logrus.Error("Invalid width")
			config.OptimalScreenWidth = 800
		}
	}
	config.AudioMimetypes = []string{"audio/L16", "rate=44100", "channels=2"}

	logrus.Debug("Connecting to guacd")
	addr, err := net.ResolveTCPAddr("tcp", guacdAddr)
	if err != nil {
		logrus.Errorln("error resolving guacd address", err)
		return nil, err
	}

	// Set connection timeout
	dialer := net.Dialer{
		Timeout: 30 * time.Second,
	}
	conn, err := dialer.Dial("tcp", addr.String())
	if err != nil {
		logrus.Errorln("error while connecting to guacd", err)
		return nil, err
	}

	stream := guac.NewStream(conn, guac.SocketTimeout)

	logrus.Debug("Connected to guacd")
	if request.URL.Query().Get("uuid") != "" {
		config.ConnectionID = request.URL.Query().Get("uuid")
	}

	sanitisedCfg := config
	sanitisedCfg.Parameters["password"] = "********"
	logrus.Debugf("Starting handshake with %#v", sanitisedCfg)
	err = stream.Handshake(config)
	if err != nil {
		return nil, err
	}
	logrus.Debug("Socket configured")

	tunnel := guac.NewSimpleTunnel(stream)

	// Register the tunnel with its ConnectionID after handshake
	if tunnel != nil && tunnel.ConnectionID() != "" {
		// The request object 'req' for Add method is 'nil' here.
		// If it's crucial, it needs to be passed down or handled differently.
		// For now, passing nil as it's not used by the current Add implementation.
		tunnelStore.Add(tunnel.ConnectionID(), tunnel, nil)
		logrus.Debugf("Tunnel %s added to active store", tunnel.ConnectionID())
	} else if tunnel != nil {
		logrus.Warnf("Tunnel created but ConnectionID is empty. Not adding to store. UUID: %s", tunnel.GetUUID())
	}

	return tunnel, nil
}

// Add a help command to display CLI usage information
func displayHelp() {
	fmt.Println("Usage: guac [command] [options]")
	fmt.Println("Commands:")
	fmt.Println("  run             Start the GUAC server")
	fmt.Println("  generate        Generate self-signed certificates")
	fmt.Println("  generate_prod   Generate Let's Encrypt certificates")
	fmt.Println("  test            Run tests")
	fmt.Println("  build           Build the project")
	fmt.Println("  help            Display this help message")
}

func GuacdTest(address string) error {
	conn, err := net.Dial("tcp", address)
	if err != nil {
		fmt.Fprintf(os.Stderr, "❌ Failed to connect to guacd at %s: %v\n", address, err)
		return err
	}
	defer func() {
		if cerr := conn.Close(); cerr != nil {
			fmt.Fprintf(os.Stderr, "Failed to close connection: %v\n", cerr)
		}
	}()

	fmt.Printf("✅ Successfully connected to guacd at %s\n", address)
	return nil
}
