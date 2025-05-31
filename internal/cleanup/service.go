package cleanup

import (
	"time"

	"github.com/go-redis/redis/v8"
	"github.com/sirupsen/logrus"
	"k8s.io/client-go/kubernetes"

	k8sClient "github.com/browsersec/KubeBrowse/internal/k8s"
	redisClient "github.com/browsersec/KubeBrowse/internal/redis"
)

// CleanupService handles the cleanup of orphaned pods
type CleanupService struct {
	K8sClient   *kubernetes.Clientset
	RedisClient *redis.Client
	Namespace   string
	GracePeriod time.Duration
}

// NewCleanupService creates a new cleanup service
func NewCleanupService(k8sClient *kubernetes.Clientset, redisClient *redis.Client, namespace string, gracePeriod time.Duration) *CleanupService {
	return &CleanupService{
		K8sClient:   k8sClient,
		RedisClient: redisClient,
		Namespace:   namespace,
		GracePeriod: gracePeriod,
	}
}

// CleanupOrphanedPods performs the cleanup of pods without active sessions
func (cs *CleanupService) CleanupOrphanedPods() error {
	logrus.Info("Starting cleanup of orphaned browser sandbox pods")

	// Get all browser sandbox pods
	pods, err := k8sClient.GetBrowserSandboxPods(cs.K8sClient, cs.Namespace)
	if err != nil {
		logrus.Errorf("Error getting browser sandbox pods: %v", err)
		return err
	}

	logrus.Infof("Found %d browser sandbox pods", len(pods))

	// Filter pods that are old enough to be considered for cleanup
	var candidatePods []k8sClient.PodInfo
	for _, pod := range pods {
		if k8sClient.IsOrphanedPod(pod, cs.GracePeriod) {
			candidatePods = append(candidatePods, pod)
		}
	}

	logrus.Infof("Found %d candidate pods for cleanup (older than %v)", len(candidatePods), cs.GracePeriod)

	// Get all active sessions from Redis
	activeSessions, err := redisClient.GetAllActiveSessions(cs.RedisClient)
	if err != nil {
		logrus.Errorf("Error getting active sessions: %v", err)
		return err
	}

	logrus.Infof("Found %d active sessions in Redis", len(activeSessions))

	// Create a map for quick lookup of active sessions
	activeSessionMap := make(map[string]bool)
	for _, sessionPod := range activeSessions {
		activeSessionMap[sessionPod] = true
	}

	// Delete pods that don't have active sessions
	var deletedCount int
	for _, pod := range candidatePods {
		if !activeSessionMap[pod.Name] {
			logrus.Infof("Pod %s has no active session, marking for deletion", pod.Name)
			err := k8sClient.DeletePodGrace(cs.K8sClient, pod.Namespace, pod.Name)
			if err != nil {
				logrus.Errorf("Error deleting pod %s: %v", pod.Name, err)
				continue
			}
			deletedCount++
		} else {
			logrus.Debugf("Pod %s has active session, keeping alive", pod.Name)
		}
	}

	logrus.Infof("Cleanup completed. Deleted %d orphaned pods", deletedCount)
	return nil
}
