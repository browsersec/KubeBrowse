package api

import (
	"bytes"
	"context"
	"io"
	"mime/multipart"

	guac "github.com/browsersec/KubeBrowse"

	"encoding/json"
	"net/http"

	"fmt"

	redis2 "github.com/browsersec/KubeBrowse/internal/redis"
	"github.com/browsersec/KubeBrowse/k8s"
	"github.com/gin-gonic/gin"
	"github.com/go-redis/redis/v8"
	"github.com/sirupsen/logrus"
	"k8s.io/client-go/kubernetes"
)

// Endpoint to stop a specific WebSocket session
func HandlerStopWSSession(c *gin.Context, redisClient *redis.Client, k8sClient *kubernetes.Clientset) {

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
	var session redis2.SessionData
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
}

// Session management handler
func HandlerSession(c *gin.Context, activeTunnels *guac.ActiveTunnelStore) {
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

}

func HandlerUploadFile(c *gin.Context, redisClient *redis.Client, k8sClient *kubernetes.Clientset) {

	url, err := getFQDNURL(c.Param("connectionID"), redisClient)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	// 0. Check if the connectionID is valid
	if url == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid connection ID"})
		return
	}
	// 1. Grab the uploaded file from the original request
	fileHeader, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "file is required"})
		return
	}
	srcFile, err := fileHeader.Open()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "cannot open uploaded file"})
		return
	}
	defer func() {
		if err := srcFile.Close(); err != nil {
			logrus.Errorf("Error closing uploaded file: %v", err)
		}
	}()

	// 2. Build a multipart/form-data body for the proxied request
	var buf bytes.Buffer
	writer := multipart.NewWriter(&buf)

	// attach the file
	part, err := writer.CreateFormFile("file", fileHeader.Filename)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "cannot create form file"})
		return
	}
	if _, err := io.Copy(part, srcFile); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "cannot copy file data"})
		return
	}

	// add openNow=true
	if err := writer.WriteField("openNow", "true"); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "cannot write openNow field"})
		return
	}

	if err := writer.Close(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to finalize multipart content"})
		return
	}

	// 3. Create the proxied HTTP request to your /upload endpoint
	proxiedReq, err := http.NewRequest(http.MethodPost, url, &buf)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to construct proxied request"})
		return
	}
	proxiedReq.Header.Set("Content-Type", writer.FormDataContentType())

	// 4. Send it
	client := &http.Client{}
	resp, err := client.Do(proxiedReq)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "error calling upload service"})
		return
	}
	defer func() {
		if err := resp.Body.Close(); err != nil {
			logrus.Errorf("Error closing response body: %v", err)
		}
	}()

	// 5. Stream the upload-service response back to the original caller
	c.Status(resp.StatusCode)
	for k, vals := range resp.Header {
		for _, v := range vals {
			c.Writer.Header().Add(k, v)
		}
	}
	if _, err := io.Copy(c.Writer, resp.Body); err != nil {
		logrus.Errorf("Error copying response body: %v", err)

	}
}

func getFQDNURL(connectionID string, redisClient *redis.Client) (string, error) {
	val, err := redisClient.Get(context.Background(), "session:"+connectionID).Result()
	if err != nil {
		return "", fmt.Errorf("session not found")
	}

	var session redis2.SessionData
	err = json.Unmarshal([]byte(val), &session)
	if err != nil {
		return "", fmt.Errorf("failed to unmarshal session data")
	}

	fqdn := session.FQDN
	url := fmt.Sprintf("https://%s:%d/%s", fqdn, 8080, "upload")
	logrus.Infof("File URL: %s", url)
	return url, nil
}
