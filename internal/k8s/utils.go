package k8s

import (
	"context"
	"fmt"
	"net"
	"time"

	corev1 "k8s.io/api/core/v1"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
)

// DeletePod deletes a pod by name in the given namespace.
func DeletePod(clientset *kubernetes.Clientset, podName string) error {
	return clientset.CoreV1().Pods("browser-sandbox").Delete(context.Background(), podName, metav1.DeleteOptions{})
}

func WaitForPodReadyAndRDP(k8sClient *kubernetes.Clientset, namespace, podName, fqdn string, timeout time.Duration) error {
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		// 1. Check pod phase
		pod, err := k8sClient.CoreV1().Pods(namespace).Get(context.TODO(), podName, metav1.GetOptions{})
		if err != nil {
			return err
		}
		ready := false
		for _, cond := range pod.Status.Conditions {
			if cond.Type == corev1.PodReady && cond.Status == corev1.ConditionTrue {
				ready = true
				break
			}
		}
		if !ready {
			time.Sleep(2 * time.Second)
			continue
		}
		// 2. Check RDP port
		conn, err := net.DialTimeout("tcp", fmt.Sprintf("%s:3389", fqdn), 2*time.Second)
		if err == nil {
			err = conn.Close()
			if err != nil {
				return err
			}
			return nil // Success!
		}
		time.Sleep(2 * time.Second)
	}
	return fmt.Errorf("pod not ready or RDP port not open after %v", timeout)
}
