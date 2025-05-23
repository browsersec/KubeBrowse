package api

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"sync"
	"time"

	redis2 "github.com/browsersec/KubeBrowse/internal/redis"
	"github.com/gin-gonic/gin"
	"github.com/go-redis/redis/v8"
	"github.com/minio/minio-go/v7"
	"github.com/sirupsen/logrus"
	"k8s.io/client-go/kubernetes"
)

// UploadResult represents the result of each upload operation
type UploadResult struct {
	Service string      `json:"service"`
	Success bool        `json:"success"`
	Error   string      `json:"error,omitempty"`
	Data    interface{} `json:"data,omitempty"`
}

// MultiUploadResponse represents the aggregated response
type MultiUploadResponse struct {
	Success bool           `json:"success"`
	Results []UploadResult `json:"results"`
	Message string         `json:"message"`
}

// FileBuffer holds file data for concurrent uploads
type FileBuffer struct {
	Data     []byte
	Filename string
	Size     int64
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
	url := fmt.Sprintf("http://%s:%d/%s", fqdn, 8080, "upload")
	logrus.Infof("File URL: %s", url)
	return url, nil
}

// HandlerUploadFile handles file uploads to multiple destinations concurrently
func HandlerUploadFile(c *gin.Context, redisClient *redis.Client, k8sClient *kubernetes.Clientset, minioClient *minio.Client, minioBucket string, clamavurl string, timeout time.Duration) {
	start := time.Now()

	// Get connection URL
	url, err := getFQDNURL(c.Param("connectionID"), redisClient)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if url == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid connection ID"})
		return
	}

	// Get uploaded file
	fileHeader, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "file is required"})
		return
	}

	// Read file once into memory buffer
	fileBuffer, err := readFileToBuffer(fileHeader)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to read file: " + err.Error()})
		return
	}

	// Create context with timeout for all operations
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Perform concurrent uploads
	results := performConcurrentUploads(ctx, fileBuffer, url, minioClient, minioBucket, clamavurl, timeout)

	// Determine overall success
	overallSuccess := true
	for _, result := range results {
		if !result.Success {
			overallSuccess = false
			break
		}
	}

	statusCode := http.StatusOK
	if !overallSuccess {
		statusCode = http.StatusMultiStatus // 207
	}

	response := MultiUploadResponse{
		Success: overallSuccess,
		Results: results,
		Message: fmt.Sprintf("Upload completed in %v", time.Since(start)),
	}

	c.JSON(statusCode, response)
}

// readFileToBuffer reads the uploaded file into a buffer for concurrent use
func readFileToBuffer(fileHeader *multipart.FileHeader) (*FileBuffer, error) {
	srcFile, err := fileHeader.Open()
	if err != nil {
		return nil, fmt.Errorf("cannot open uploaded file: %w", err)
	}
	defer func() {
		if err := srcFile.Close(); err != nil {
			logrus.Errorf("Failed to close source file: %v", err)
		}
	}()

	// Read entire file into memory
	data, err := io.ReadAll(srcFile)
	if err != nil {
		return nil, fmt.Errorf("cannot read file data: %w", err)
	}

	return &FileBuffer{
		Data:     data,
		Filename: fileHeader.Filename,
		Size:     fileHeader.Size,
	}, nil
}

// performConcurrentUploads executes all uploads concurrently
func performConcurrentUploads(ctx context.Context, fileBuffer *FileBuffer, officePodUrl string, minioClient *minio.Client, minioBucket string, clamavAddr string, timeout time.Duration) []UploadResult {
	var wg sync.WaitGroup
	results := make([]UploadResult, 3)

	// Upload to Docker container
	wg.Add(1)
	go func() {
		defer wg.Done()
		results[0] = uploadOfficeContainer(ctx, fileBuffer, officePodUrl)
	}()

	// Upload to ClamAV
	wg.Add(1)
	go func() {
		defer wg.Done()
		results[1] = uploadToClamAV(ctx, fileBuffer, clamavAddr, timeout)
	}()

	// Upload to MinIO
	wg.Add(1)
	go func() {
		defer wg.Done()
		results[2] = uploadToMinIO(ctx, fileBuffer, minioClient, minioBucket)
	}()

	wg.Wait()
	return results
}

// uploadOfficeContainer uploads file to a office container
func uploadOfficeContainer(ctx context.Context, fileBuffer *FileBuffer, url string) UploadResult {
	// Create multipart form data
	var buf bytes.Buffer
	writer := multipart.NewWriter(&buf)

	// Add file
	part, err := writer.CreateFormFile("file", fileBuffer.Filename)
	if err != nil {
		return UploadResult{Service: "file_upload", Success: false, Error: "failed to create form file: " + err.Error()}
	}

	if _, err := part.Write(fileBuffer.Data); err != nil {
		return UploadResult{Service: "file_upload", Success: false, Error: "failed to write file data: " + err.Error()}
	}

	// Add openNow field
	if err := writer.WriteField("openNow", "true"); err != nil {
		return UploadResult{Service: "file_upload", Success: false, Error: "failed to write openNow field: " + err.Error()}
	}

	if err := writer.Close(); err != nil {
		return UploadResult{Service: "file_upload", Success: false, Error: "failed to close writer: " + err.Error()}
	}

	// Create request
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, &buf)
	if err != nil {
		return UploadResult{Service: "file_upload", Success: false, Error: "failed to create request: " + err.Error()}
	}
	req.Header.Set("Content-Type", writer.FormDataContentType())

	// Send request
	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return UploadResult{Service: "file_upload", Success: false, Error: "request failed: " + err.Error()}
	}
	defer func() {
		if err := resp.Body.Close(); err != nil {
			logrus.Errorf("Failed to close response body: %v", err)
		}
	}()

	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		return UploadResult{Service: "file_upload", Success: true, Data: map[string]interface{}{"status_code": resp.StatusCode}}
	}

	return UploadResult{Service: "file_upload", Success: false, Error: fmt.Sprintf("HTTP %d", resp.StatusCode)}
}

// uploadToClamAV uploads file to ClamAV for virus scanning using async/redis endpoint
func uploadToClamAV(ctx context.Context, fileBuffer *FileBuffer, clamavurl string, timeout time.Duration) UploadResult {
	var buf bytes.Buffer
	writer := multipart.NewWriter(&buf)

	// Add file for scanning - use "FILES" as the form field name (matching your API)
	part, err := writer.CreateFormFile("FILES", fileBuffer.Filename)
	if err != nil {
		return UploadResult{Service: "clamav", Success: false, Error: "failed to create form file: " + err.Error()}
	}

	if _, err := part.Write(fileBuffer.Data); err != nil {
		return UploadResult{Service: "clamav", Success: false, Error: "failed to write file data: " + err.Error()}
	}

	if err := writer.Close(); err != nil {
		return UploadResult{Service: "clamav", Success: false, Error: "failed to close writer: " + err.Error()}
	}

	// Create request to the async/redis endpoint
	scanURL := clamavurl + "/api/v1/scan/async/redis"
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, scanURL, &buf)
	if err != nil {
		return UploadResult{Service: "clamav", Success: false, Error: "failed to create request: " + err.Error()}
	}

	// Set proper headers
	req.Header.Set("Content-Type", writer.FormDataContentType())

	// Send request with timeout
	client := &http.Client{Timeout: timeout}
	resp, err := client.Do(req)
	if err != nil {
		return UploadResult{Service: "clamav", Success: false, Error: "scan request failed: " + err.Error()}
	}
	defer func() {
		if err := resp.Body.Close(); err != nil {
			logrus.Errorf("Failed to close ClamAV response body: %v", err)
		}
	}()

	// Read response body
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return UploadResult{Service: "clamav", Success: false, Error: "failed to read response: " + err.Error()}
	}

	// Try to parse as JSON, but also handle plain text responses
	var scanResult map[string]interface{}
	responseStr := string(body)

	if err := json.Unmarshal(body, &scanResult); err != nil {
		// If JSON parsing fails, treat as plain text response
		scanResult = map[string]interface{}{
			"response": responseStr,
			"raw_body": responseStr,
		}
	}

	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		return UploadResult{
			Service: "clamav",
			Success: true,
			Data: map[string]interface{}{
				"status_code": resp.StatusCode,
				"response":    scanResult,
				"endpoint":    scanURL,
			},
		}
	}

	return UploadResult{
		Service: "clamav",
		Success: false,
		Error:   fmt.Sprintf("scan failed with HTTP %d", resp.StatusCode),
		Data: map[string]interface{}{
			"status_code": resp.StatusCode,
			"response":    scanResult,
			"endpoint":    scanURL,
		},
	}
}

// uploadToMinIO uploads file to MinIO S3 bucket
func uploadToMinIO(ctx context.Context, fileBuffer *FileBuffer, minioClient *minio.Client, bucket string) UploadResult {
	// Generate object name with timestamp to avoid conflicts
	objectName := fmt.Sprintf("%d_%s", time.Now().Unix(), fileBuffer.Filename)

	// Upload to MinIO
	info, err := minioClient.PutObject(
		ctx,
		bucket,
		objectName,
		bytes.NewReader(fileBuffer.Data),
		fileBuffer.Size,
		minio.PutObjectOptions{
			ContentType: "application/octet-stream",
		},
	)

	if err != nil {
		return UploadResult{Service: "minio", Success: false, Error: "upload failed: " + err.Error()}
	}

	return UploadResult{
		Service: "minio",
		Success: true,
		Data: map[string]interface{}{
			"bucket":      bucket,
			"object_name": objectName,
			"size":        info.Size,
			"etag":        info.ETag,
		},
	}
}
