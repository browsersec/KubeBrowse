package main

import (
	"os"
	"path/filepath"
	"time"

	"github.com/robfig/cron/v3"
	"github.com/sirupsen/logrus"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
	"k8s.io/client-go/util/homedir"

	"github.com/browsersec/KubeBrowse/internal/cleanup"
	redisClient "github.com/browsersec/KubeBrowse/internal/redis"
)

func main() {
	logrus.SetLevel(logrus.InfoLevel)
	logrus.Info("Starting Browser Sandbox Cleanup Service")

	// Initialize Kubernetes client
	k8sClient, err := initKubernetesClient()
	if err != nil {
		logrus.Fatalf("Error initializing Kubernetes client: %v", err)
	}

	// Initialize Redis client
	redisConn := redisClient.InitRedis()

	// Get configuration from environment variables
	namespace := getEnvOrDefault("CLEANUP_NAMESPACE", "browser-sandbox")
	gracePeriodStr := getEnvOrDefault("CLEANUP_GRACE_PERIOD", "5m")
	cronSchedule := getEnvOrDefault("CLEANUP_CRON_SCHEDULE", "*/5 * * * *") // Every 5 minutes

	gracePeriod, err := time.ParseDuration(gracePeriodStr)
	if err != nil {
		logrus.Fatalf("Invalid grace period format: %v", err)
	}

	// Create cleanup service
	cleanupService := cleanup.NewCleanupService(k8sClient, redisConn, namespace, gracePeriod)

	// Setup cron job
	c := cron.New()
	_, err = c.AddFunc(cronSchedule, func() {
		err := cleanupService.CleanupOrphanedPods()
		if err != nil {
			logrus.Errorf("Cleanup job failed: %v", err)
		}
	})
	if err != nil {
		logrus.Fatalf("Error setting up cron job: %v", err)
	}

	logrus.Infof("Cleanup service configured:")
	logrus.Infof("  Namespace: %s", namespace)
	logrus.Infof("  Grace Period: %s", gracePeriod)
	logrus.Infof("  Cron Schedule: %s", cronSchedule)

	// Start the cron scheduler
	c.Start()
	logrus.Info("Cleanup service started")

	// Run an initial cleanup
	logrus.Info("Running initial cleanup")
	err = cleanupService.CleanupOrphanedPods()
	if err != nil {
		logrus.Errorf("Initial cleanup failed: %v", err)
	}

	// Keep the service running
	select {}
}

func initKubernetesClient() (*kubernetes.Clientset, error) {
	var config *rest.Config
	var err error

	// Try in-cluster config first (for when running in a pod)
	config, err = rest.InClusterConfig()
	if err != nil {
		logrus.Info("In-cluster config not available, trying kubeconfig")

		// Try kubeconfig file
		kubeconfigPath := getEnvOrDefault("KUBECONFIG", filepath.Join(homedir.HomeDir(), ".kube", "config"))
		config, err = clientcmd.BuildConfigFromFlags("", kubeconfigPath)
		if err != nil {
			return nil, err
		}
	}

	clientset, err := kubernetes.NewForConfig(config)
	if err != nil {
		return nil, err
	}

	return clientset, nil
}

func getEnvOrDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
