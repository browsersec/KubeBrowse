package k8s

// Core Go packages for Kubernetes API interaction
import (
	"context"
	"fmt"
	"time"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	// "k8s.io/client-go/rest"
	"k8s.io/apimachinery/pkg/api/resource"
	"k8s.io/utils/ptr"
)

// CreateSandboxPod creates a new pod with the VNC container
func CreateBrowserSandboxPod(clientset *kubernetes.Clientset, namespace, userID string) (*corev1.Pod, error) {
	pod := &corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{
			Name: fmt.Sprintf("browser-sandbox-%s-%s", userID, time.Now().Format("20060102150405")),
			Labels: map[string]string{
				"app":  "browser-sandbox",
				"user": userID,
			},
		},
		Spec: corev1.PodSpec{
			Containers: []corev1.Container{
				{
					Name:  "vnc-container",
					Image: "your-registry/vnc-lightweight:latest",
					Ports: []corev1.ContainerPort{
						{
							Name:          "vnc",
							ContainerPort: 5900,
						},
					},
					Resources: corev1.ResourceRequirements{
						Limits: corev1.ResourceList{
							corev1.ResourceCPU:    resource.MustParse("500m"),
							corev1.ResourceMemory: resource.MustParse("512Mi"),
						},
						Requests: corev1.ResourceList{
							corev1.ResourceCPU:    resource.MustParse("250m"),
							corev1.ResourceMemory: resource.MustParse("256Mi"),
						},
					},
					SecurityContext: &corev1.SecurityContext{
						RunAsNonRoot: ptr.To(true),
						RunAsUser:    ptr.To(int64(1000)),
						Capabilities: &corev1.Capabilities{
							Drop: []corev1.Capability{"ALL"},
						},
					},
				},
			},
			TerminationGracePeriodSeconds: ptr.To(int64(30)),
		},
	}

	return clientset.CoreV1().Pods(namespace).Create(context.Background(), pod, metav1.CreateOptions{})
}
