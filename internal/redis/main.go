package redis

import (
	"context"
	"github.com/go-redis/redis/v8"
	"github.com/sirupsen/logrus"
)

type SessionData struct {
	PodName          string            `json:"podName"`
	PodIP            string            `json:"podIP"`
	FQDN             string            `json:"fqdn"`
	ConnectionID     string            `json:"connection_id"`
	ConnectionParams map[string]string `json:"connection_params"`
}

func InitRedis() *redis.Client {
	redisClient := redis.NewClient(&redis.Options{
		Addr: "redis:6379",
	})
	// check if redis is connected
	_, err := redisClient.Ping(context.Background()).Result()
	if err != nil {
		logrus.Printf("Failed to connect to Redis: %v", err)
	}
	return redisClient
}
