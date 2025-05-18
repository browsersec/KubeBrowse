package main

import (
	"flag"
	"fmt"
	"net"
	"net/http"
	"os"
	"path/filepath"

	guac "github.com/browsersec/KubeBrowse"
	"github.com/browsersec/KubeBrowse/api"
	"github.com/browsersec/KubeBrowse/docs"
	redis2 "github.com/browsersec/KubeBrowse/internal/redis"
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/go-redis/redis/v8"
	"github.com/sirupsen/logrus"
	swaggerfiles "github.com/swaggo/files"
	"github.com/swaggo/gin-swagger"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
)

// @BasePath /test

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

func main() {
	redisClient = redis2.InitRedis()
	// Parse command line flags
	helpFlag := flag.Bool("h", false, "Display help information")
	flag.Parse()

	// Check if help flag was provided
	if *helpFlag {
		displayHelp()
		return
	}

	logrus.SetLevel(logrus.TraceLevel)

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

	// Configure Swagger
	docs.SwaggerInfo.BasePath = "/"
	docs.SwaggerInfo.Title = "KubeBrowse API"
	docs.SwaggerInfo.Description = "KubeBrowse API for managing browser and office sandbox pods"
	docs.SwaggerInfo.Version = "1.0"
	docs.SwaggerInfo.Host = "localhost:4567"
	docs.SwaggerInfo.Schemes = []string{"http", "https"}
	router.Use(cors.Default())
	router.Use(gin.Recovery())
	router.Use(gin.Logger())

	// Initialize Guacamole handlers
	// servlet := guac.NewServer(DemoDoConnect) // We'll adjust this if DemoDoConnect's signature changes, or use a wrapper
	// wsServer := guac.NewWebsocketServer(DemoDoConnect) // Same here

	// Pass activeTunnels to DemoDoConnect by wrapping it
	doConnectWrapper := func(request *http.Request) (guac.Tunnel, error) {
		return api.DemoDoConnect(request, activeTunnels, redisClient, guacdAddr)
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
			api.DeployOffice(c, k8sClient, k8sNamespace, redisClient, activeTunnels)
		})

		// New endpoint to handle websocket connections using stored parameters
		testRoutes.GET("/connect/:connectionID", func(c *gin.Context) {
			api.HandlerConnectionID(c, activeTunnels)
		})

		// Test route to create a browser sandbox pod
		testRoutes.POST("/browser-pod", func(c *gin.Context) {
			api.HandlerBrowserPod(c, activeTunnels, k8sClient, k8sNamespace)
		})

		// Test route to create an office sandbox pod
		testRoutes.POST("/office-pod", func(c *gin.Context) {
			api.HandlerOfficePod(c, activeTunnels, k8sClient, k8sNamespace)
		})
	}

	// Endpoint to stop a specific WebSocket session
	router.DELETE("/sessions/:connectionID/stop", func(c *gin.Context) {

	})

	// Add Swagger documentation route
	router.GET("/swagger/*any", ginSwagger.WrapHandler(
		swaggerfiles.Handler))

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
//func DemoDoConnect(request *http.Request, tunnelStore *guac.ActiveTunnelStore) (guac.Tunnel, error) {
//	config := guac.NewGuacamoleConfiguration()
//	var query url.Values
//	uuid := request.URL.Query().Get("uuid")
//
//	if uuid != "" {
//		val, err := redisClient.Get(context.Background(), "session:"+uuid).Result()
//		if err != nil {
//			logrus.Errorf("Failed to get session from Redis for UUID %s: %v", uuid, err)
//			return nil, fmt.Errorf("session not found")
//		}
//		var session redis2.SessionData
//		err = json.Unmarshal([]byte(val), &session)
//		logrus.Debugf("Retrieved session data for UUID %s: %+v", uuid, session)
//		if err != nil {
//			logrus.Errorf("Failed to unmarshal session data for UUID %s: %v", uuid, err)
//			return nil, fmt.Errorf("failed to unmarshal session data")
//		}
//		query = url.Values{}
//		for k, v := range session.ConnectionParams {
//			query.Set(k, v)
//		}
//	} else {
//		query = request.URL.Query()
//	}
//
//	// Check if we have stored parameters for this connection
//	if uuid := query.Get("uuid"); uuid != "" {
//		if storedParams, exists := tunnelStore.GetConnectionParams(uuid); exists {
//			logrus.Debugf("Using stored parameters for UUID %s", uuid)
//			// Use stored parameters instead of query parameters
//			query = storedParams
//		} else {
//			logrus.Debugf("No stored parameters found for UUID %s", uuid)
//		}
//	}
//
//	config.Protocol = query.Get("scheme")
//	config.Parameters = map[string]string{}
//	for k, v := range query {
//		config.Parameters[k] = v[0]
//	}
//
//	var err error
//	if query.Get("width") != "" {
//		config.OptimalScreenHeight, err = strconv.Atoi(query.Get("width"))
//		if err != nil || config.OptimalScreenHeight == 0 {
//			logrus.Errorf("Invalid height value '%s': %v", query.Get("width"), err)
//			config.OptimalScreenHeight = 600
//		}
//	}
//	if query.Get("height") != "" {
//		config.OptimalScreenWidth, err = strconv.Atoi(query.Get("height"))
//		if err != nil || config.OptimalScreenWidth == 0 {
//			logrus.Errorf("Invalid width value '%s': %v", query.Get("height"), err)
//			config.OptimalScreenWidth = 800
//		}
//	}
//	config.AudioMimetypes = []string{"audio/L16", "rate=44100", "channels=2"}
//
//	logrus.Debugf("Attempting to connect to guacd at %s", guacdAddr)
//	addr, err := net.ResolveTCPAddr("tcp", guacdAddr)
//	if err != nil {
//		logrus.Errorf("Failed to resolve guacd address %s: %v", guacdAddr, err)
//		return nil, err
//	}
//
//	// Set connection timeout
//	dialer := net.Dialer{
//		Timeout: 60 * time.Second,
//	}
//	logrus.Debugf("Attempting to establish TCP connection to guacd at %s with timeout %v", addr.String(), dialer.Timeout)
//	conn, err := dialer.Dial("tcp", addr.String())
//	if err != nil {
//		logrus.Errorf("Failed to connect to guacd at %s: %v", addr.String(), err)
//		return nil, err
//	}
//
//	stream := guac.NewStream(conn, guac.SocketTimeout)
//	logrus.Debugf("TCP connection established, created new stream with timeout %v", guac.SocketTimeout)
//
//	logrus.Debug("Successfully connected to guacd")
//	if request.URL.Query().Get("uuid") != "" {
//		config.ConnectionID = request.URL.Query().Get("uuid")
//	}
//
//	sanitisedCfg := config
//	config.ConnectionID = ""
//	sanitisedCfg.Parameters["password"] = "********"
//	logrus.Debugf("Starting handshake with config: %#v", sanitisedCfg)
//
//	// err = stream.Handshake(config)
//	// if err != nil {
//	//     logrus.Errorf("Handshake failed: %v", err)
//	//     return nil, err
//	// }
//
//	// Add context with timeout for handshake
//	ctx, cancel := context.WithTimeout(context.Background(), 45*time.Second)
//	defer cancel()
//
//	// Create a channel to handle the handshake
//	handshakeDone := make(chan error, 1)
//	go func() {
//		handshakeDone <- stream.Handshake(config)
//	}()
//
//	// Wait for handshake with timeout
//	select {
//	case err := <-handshakeDone:
//		if err != nil {
//			logrus.Errorf("Handshake failed: %v. Connection details - Local: %s, Remote: %s",
//				err,
//				conn.LocalAddr().String(),
//				conn.RemoteAddr().String())
//			return nil, err
//		}
//	case <-ctx.Done():
//		logrus.Errorf("Handshake timed out after 45 seconds. Connection details - Local: %s, Remote: %s",
//			conn.LocalAddr().String(),
//			conn.RemoteAddr().String())
//		return nil, fmt.Errorf("handshake timed out: %v", ctx.Err())
//	}
//
//	logrus.Debug("Handshake completed successfully")
//
//	tunnel := guac.NewSimpleTunnel(stream)
//
//	// Register the tunnel with its ConnectionID after handshake
//	if tunnel != nil && tunnel.ConnectionID() != "" {
//		// The request object 'req' for Add method is 'nil' here.
//		// If it's crucial, it needs to be passed down or handled differently.
//		// For now, passing nil as it's not used by the current Add implementation.
//		tunnelStore.Add(tunnel.ConnectionID(), tunnel, nil)
//		logrus.Debugf("Tunnel %s successfully added to active store", tunnel.ConnectionID())
//	} else if tunnel != nil {
//		logrus.Warnf("Tunnel created but ConnectionID is empty. Not adding to store. UUID: %s", tunnel.GetUUID())
//	} else {
//		logrus.Error("Failed to create tunnel - tunnel is nil")
//	}
//
//	return tunnel, nil
//}

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
