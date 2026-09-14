package logger

import (
	"os"
	"time"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

func Init(serviceName string) {
	zerolog.TimeFieldFormat = time.RFC3339
	output := zerolog.ConsoleWriter{Out: os.Stdout, TimeFormat: time.RFC3339}
	log.Logger = zerolog.New(output).With().
		Timestamp().
		Str("service", serviceName).
		Logger()
}

func Info() *zerolog.Event {
	return log.Info()
}

func Error() *zerolog.Event {
	return log.Error()
}

func Debug() *zerolog.Event {
	return log.Debug()
}

func Warn() *zerolog.Event {
	return log.Warn()
}

func Fatal() *zerolog.Event {
	return log.Fatal()
}
