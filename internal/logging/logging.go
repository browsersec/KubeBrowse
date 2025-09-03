package logging

import (
	"github.com/sirupsen/logrus"
	"os"
)

var Log *logrus.Logger

func Init(level logrus.Level) {
	Log = logrus.New()
	Log.Out = os.Stdout
	Log.SetLevel(level)
	Log.SetFormatter(&logrus.JSONFormatter{
		TimestampFormat: "2006-01-02T15:04:05Z07:00",
	})
}
