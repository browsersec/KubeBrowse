package cleanup

// import (
// 	"context"
// 	// "log"
// 	"time"

// 	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
// 	"k8s.io/client-go/kubernetes"
// )

// type HeartbeatTracker struct {
// 	clientset         *kubernetes.Clientset
// 	podName           string
// 	namespace         string
// 	heartbeatInterval time.Duration
// }

// func (h *HeartbeatTracker) Start(ctx context.Context) {
// 	ticker := time.NewTicker(h.heartbeatInterval)
// 	defer ticker.Stop()

// 	for {
// 		select {
// 		case <-ctx.Done():
// 			return
// 		case <-ticker.C:
// 			h.updateHeartbeat()
// 		}
// 	}
// }

// func (h *HeartbeatTracker) updateHeartbeat() {
// 	currentTime := time.Now().Format("20060102-150405")

// 	if h.isWebSocketConnectionActive() {
// 		h.updatePodAnnotation(h.podName, "last-heartbeat", currentTime)
// 		h.updatePodAnnotation(h.podName, "connection-status", "active")
// 	} else {
// 		h.updatePodAnnotation(h.podName, "connection-status", "idle")
// 	}
// }

// func (h *HeartbeatTracker) updatePodAnnotation(podName, key, value string) error {
// 	pod, err := h.clientset.CoreV1().Pods(h.namespace).Get(
// 		context.TODO(), podName, metav1.GetOptions{})
// 	if err != nil {
// 		return err
// 	}

// 	if pod.Annotations == nil {
// 		pod.Annotations = make(map[string]string)
// 	}
// 	pod.Annotations[key] = value

// 	_, err = h.clientset.CoreV1().Pods(h.namespace).Update(
// 		context.TODO(), pod, metav1.UpdateOptions{})
// 	return err
// }
