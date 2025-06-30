package cleanup

import (
	"context"
	"sync"
	"time"

	guac2 "github.com/browsersec/KubeBrowse/internal/guac"
	"github.com/browsersec/KubeBrowse/internal/k8s"
	redis2 "github.com/browsersec/KubeBrowse/internal/redis"
	"github.com/go-redis/redis/v8"
	"github.com/sirupsen/logrus"
	"k8s.io/client-go/kubernetes"
)

type SessionCleanupService struct {
	redisClient   *redis.Client
	k8sClient     *kubernetes.Clientset
	namespace     string
	sessions      map[string]*SessionMonitor
	tunnelStore   *guac2.ActiveTunnelStore
	mutex         sync.RWMutex
	stopChan      chan struct{}
	checkInterval time.Duration
}

type SessionMonitor struct {
	SessionID string
	PodName   string
	UserID    string
	StartTime time.Time
	cancel    context.CancelFunc
}

func NewSessionCleanupService(redisClient *redis.Client, k8sClient *kubernetes.Clientset, namespace string, tunnelStore *guac2.ActiveTunnelStore) *SessionCleanupService {
	return &SessionCleanupService{
		redisClient:   redisClient,
		k8sClient:     k8sClient,
		namespace:     namespace,
		tunnelStore:   tunnelStore,
		sessions:      make(map[string]*SessionMonitor),
		stopChan:      make(chan struct{}),
		checkInterval: 30 * time.Second, // Check every 30 seconds
	}
}

func (s *SessionCleanupService) Start() {
	logrus.Info("Starting session cleanup service")
	go s.cleanupLoop()
}

func (s *SessionCleanupService) Stop() {
	logrus.Info("Stopping session cleanup service")
	close(s.stopChan)

	s.mutex.Lock()
	defer s.mutex.Unlock()

	// Cancel all monitoring goroutines
	for _, monitor := range s.sessions {
		if monitor.cancel != nil {
			monitor.cancel()
		}
	}
}

func (s *SessionCleanupService) RegisterSession(sessionID, podName, userID string) {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	// Cancel existing monitor if exists
	if existing, exists := s.sessions[sessionID]; exists {
		if existing.cancel != nil {
			existing.cancel()
		}
	}

	ctx, cancel := context.WithCancel(context.Background())
	monitor := &SessionMonitor{
		SessionID: sessionID,
		PodName:   podName,
		UserID:    userID,
		StartTime: time.Now(),
		cancel:    cancel,
	}

	s.sessions[sessionID] = monitor

	// Start monitoring this session
	go s.monitorSession(ctx, monitor)

	logrus.Infof("Registered session %s for cleanup monitoring", sessionID)
}

func (s *SessionCleanupService) UnregisterSession(sessionID string) {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	if monitor, exists := s.sessions[sessionID]; exists {
		if monitor.cancel != nil {
			monitor.cancel()
		}
		delete(s.sessions, sessionID)
		logrus.Infof("Unregistered session %s from cleanup monitoring", sessionID)
	}
}

func (s *SessionCleanupService) monitorSession(ctx context.Context, monitor *SessionMonitor) {
	ticker := time.NewTicker(15 * time.Second) // Check every 15 seconds
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			// Check if session still exists in Redis
			timeLeft, err := redis2.GetSessionTimeLeft(s.redisClient, monitor.SessionID)
			if err != nil || timeLeft <= 0 {
				logrus.Infof("Session %s expired or not found, cleaning up pod %s", monitor.SessionID, monitor.PodName)
				s.cleanupPod(monitor)
				return
			}
		}
	}
}

func (s *SessionCleanupService) cleanupLoop() {
	ticker := time.NewTicker(s.checkInterval)
	defer ticker.Stop()

	for {
		select {
		case <-s.stopChan:
			return
		case <-ticker.C:
			s.performCleanup()
		}
	}
}

func (s *SessionCleanupService) performCleanup() {
	s.mutex.RLock()
	sessionsToCheck := make([]*SessionMonitor, 0, len(s.sessions))
	for _, monitor := range s.sessions {
		sessionsToCheck = append(sessionsToCheck, monitor)
	}
	s.mutex.RUnlock()

	for _, monitor := range sessionsToCheck {
		// Double-check session status
		timeLeft, err := redis2.GetSessionTimeLeft(s.redisClient, monitor.SessionID)
		if err != nil || timeLeft <= 0 {
			logrus.Infof("Found expired session %s during cleanup sweep, removing pod %s", monitor.SessionID, monitor.PodName)
			s.cleanupPod(monitor)
		}
	}
}

func (s *SessionCleanupService) cleanupPod(monitor *SessionMonitor) {
	// First, close the websocket connection if it exists
	if s.tunnelStore != nil {
		if tunnel, exists := s.tunnelStore.Get(monitor.SessionID); exists {
			logrus.Infof("Closing websocket connection for session %s", monitor.SessionID)
			err := tunnel.Close()
			if err != nil {
				logrus.Errorf("Failed to close tunnel for session %s: %v", monitor.SessionID, err)
			} else {
				logrus.Infof("Successfully closed tunnel for session %s", monitor.SessionID)
			}

			// Remove from tunnel store
			s.tunnelStore.Delete(monitor.UserID, nil, tunnel)
		}
	}

	// Then delete the pod with namespace
	err := k8s.DeletePod(s.k8sClient, monitor.PodName)
	if err != nil {
		logrus.Errorf("Failed to delete pod %s for expired session %s: %v", monitor.PodName, monitor.SessionID, err)
	} else {
		logrus.Infof("Successfully deleted pod %s for expired session %s", monitor.PodName, monitor.SessionID)
	}

	// Finally, clean up session data from Redis
	err = s.redisClient.Del(context.Background(), "session:"+monitor.SessionID).Err()
	if err != nil {
		logrus.Errorf("Failed to delete session data from Redis for %s: %v", monitor.SessionID, err)
	}

	// Unregister the session
	s.UnregisterSession(monitor.SessionID)
}

func (s *SessionCleanupService) GetActiveSessionsCount() int {
	s.mutex.RLock()
	defer s.mutex.RUnlock()
	return len(s.sessions)
}
