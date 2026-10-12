package storage

import (
	"context"
	"io"
	"os"
	"path/filepath"
	"strings"
)

// ObjectStore — abstraction disque local ou MinIO (S3-compatible)
type ObjectStore interface {
	Put(ctx context.Context, key string, r io.Reader, size int64, contentType string) (publicURL string, err error)
	Get(ctx context.Context, key string) (io.ReadCloser, string, error)
	Delete(ctx context.Context, key string) error
}

type Config struct {
	// "local" | "minio"
	Driver        string
	LocalDir      string
	PublicBaseURL string // ex: http://localhost:8085/api/v1/tickets/files
	MinioEndpoint string // localhost:9000
	MinioAccess   string
	MinioSecret   string
	MinioBucket   string
	MinioUseSSL   bool
	MinioPublicURL string // http://localhost:9000/lami-uploads
}

func NewFromEnv() (ObjectStore, error) {
	driver := strings.ToLower(os.Getenv("STORAGE_DRIVER"))
	if driver == "" {
		if os.Getenv("MINIO_ENDPOINT") != "" {
			driver = "minio"
		} else {
			driver = "local"
		}
	}
	cfg := Config{
		Driver:         driver,
		LocalDir:       getenv("UPLOAD_DIR", "./uploads"),
		PublicBaseURL:  getenv("UPLOAD_PUBLIC_BASE", "/api/v1/tickets/files"),
		MinioEndpoint:  os.Getenv("MINIO_ENDPOINT"),
		MinioAccess:    getenv("MINIO_ACCESS_KEY", "lami"),
		MinioSecret:    getenv("MINIO_SECRET_KEY", "lami_secret_minio"),
		MinioBucket:    getenv("MINIO_BUCKET", "lami-uploads"),
		MinioUseSSL:    os.Getenv("MINIO_USE_SSL") == "true",
		MinioPublicURL: os.Getenv("MINIO_PUBLIC_URL"),
	}
	if cfg.Driver == "minio" {
		return NewMinioStore(cfg)
	}
	return NewLocalStore(cfg)
}

func getenv(k, d string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return d
}

// --- Local ---

type LocalStore struct {
	dir        string
	publicBase string
}

func NewLocalStore(cfg Config) (*LocalStore, error) {
	if err := os.MkdirAll(cfg.LocalDir, 0o755); err != nil {
		return nil, err
	}
	return &LocalStore{dir: cfg.LocalDir, publicBase: strings.TrimRight(cfg.PublicBaseURL, "/")}, nil
}

func (s *LocalStore) Put(ctx context.Context, key string, r io.Reader, size int64, contentType string) (string, error) {
	_ = ctx
	_ = size
	_ = contentType
	key = filepath.Base(key)
	path := filepath.Join(s.dir, key)
	f, err := os.Create(path)
	if err != nil {
		return "", err
	}
	defer f.Close()
	if _, err := io.Copy(f, r); err != nil {
		return "", err
	}
	return s.publicBase + "/" + key, nil
}

func (s *LocalStore) Get(ctx context.Context, key string) (io.ReadCloser, string, error) {
	_ = ctx
	key = filepath.Base(key)
	path := filepath.Join(s.dir, key)
	f, err := os.Open(path)
	if err != nil {
		return nil, "", err
	}
	return f, "application/octet-stream", nil
}

func (s *LocalStore) Delete(ctx context.Context, key string) error {
	_ = ctx
	return os.Remove(filepath.Join(s.dir, filepath.Base(key)))
}

// --- MinIO via raw S3 PutObject (SDK leger custom HTTP) ---
// Implementation dans minio_store.go
