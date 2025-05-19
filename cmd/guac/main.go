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
	coors := cors.DefaultConfig()
	coors.AllowAllOrigins = true
	router.Use(cors.New(coors))
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
		api.HandlerSession(c, activeTunnels)

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

	sessionRoutes := router.Group("/sessions")
	{

		// Endpoint to stop a specific WebSocket session
		sessionRoutes.DELETE("/:connectionID/stop", func(c *gin.Context) {
			api.HandlerStopWSSession(c, redisClient, k8sClient)
		})

		// Tunnel a Pod Rest API to Upload a file to a pod
		sessionRoutes.POST("/:connectionID/upload", func(c *gin.Context) {
			api.HandlerUploadFile(c, redisClient, k8sClient)
		})
	}

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
