package middleware

import (
	"time"

	"github.com/browsersec/KubeBrowse/internal/logging"
	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
	"go.opentelemetry.io/otel/trace"
)

func GinLogger() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		path := c.Request.URL.Path
		method := c.Request.Method

		c.Next() // process request

		latency := time.Since(start)
		status := c.Writer.Status()
		span := trace.SpanContextFromContext(c.Request.Context())

		logging.Log.WithFields(logrus.Fields{
			"method":  method,
			"path":    path,
			"status":  status,
			"latency": latency.String(),
			"client":  c.ClientIP(),
			"trace":   span.SpanID().String(),
		}).Info("handled request")
	}
}
