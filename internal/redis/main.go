package redis

import (
	"context"
	"fmt"
	"os"

	"github.com/go-redis/redis/v8"
	"github.com/sirupsen/logrus"
)

type SessionData struct {
	PodName          string            `json:"podName"`
	PodIP            string            `json:"podIP"`
	FQDN             string            `json:"fqdn"`
	ConnectionID     string            `json:"connection_id"`
	ConnectionParams map[string]string `json:"connection_params"`
	Share            bool              `json:"share"`
}

// InitRedis initializes and returns a new Redis client
func InitRedis() *redis.Client {
	// Retrieve Redis connection details from environment variables or use defaults
	redisHost := "localhost"
	redisPort := "6379"
	if os.Getenv("REDIS_HOST") != "" {
		redisHost = os.Getenv("REDIS_HOST")
	}
	if os.Getenv("REDIS_PORT") != "" {
		redisPort = os.Getenv("REDIS_PORT")
	}
	redisAddr := fmt.Sprintf("%s:%s", redisHost, redisPort)

	// Create a new Redis client
	client := redis.NewClient(&redis.Options{
		Addr:     redisAddr,
		Password: "", // no password set
		DB:       0,  // use default DB
	})

	// Ping the Redis server to check the connection
	_, err := client.Ping(context.Background()).Result()
	if err != nil {
		logrus.Errorf("Could not connect to Redis: %v", err)
		// Depending on your application's requirements, you might want to panic here
		// panic(err)
	}

	logrus.Infof("Connected to Redis at %s", redisAddr)

	return client
}
