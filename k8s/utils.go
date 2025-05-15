package k8s

import (
	"context"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
)

// DeletePod deletes a pod by name in the given namespace.
func DeletePod(clientset *kubernetes.Clientset, podName string) error {
	return clientset.CoreV1().Pods("browser-sandbox").Delete(context.Background(), podName, metav1.DeleteOptions{})
}
