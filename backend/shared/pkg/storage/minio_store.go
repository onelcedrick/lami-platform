package storage

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
)

type MinioStore struct {
	client     *minio.Client
	bucket     string
	publicBase string
}

func NewMinioStore(cfg Config) (*MinioStore, error) {
	endpoint := cfg.MinioEndpoint
	endpoint = strings.TrimPrefix(endpoint, "http://")
	endpoint = strings.TrimPrefix(endpoint, "https://")

	client, err := minio.New(endpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(cfg.MinioAccess, cfg.MinioSecret, ""),
		Secure: cfg.MinioUseSSL,
	})
	if err != nil {
		return nil, fmt.Errorf("minio client: %w", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	exists, err := client.BucketExists(ctx, cfg.MinioBucket)
	if err != nil {
		return nil, fmt.Errorf("minio bucket check: %w", err)
	}
	if !exists {
		if err := client.MakeBucket(ctx, cfg.MinioBucket, minio.MakeBucketOptions{}); err != nil {
			return nil, fmt.Errorf("minio make bucket: %w", err)
		}
		// Policy lecture publique sur le bucket (fichiers tickets partages)
		policy := fmt.Sprintf(`{
		  "Version":"2012-10-17",
		  "Statement":[{"Effect":"Allow","Principal":{"AWS":["*"]},
		    "Action":["s3:GetObject"],"Resource":["arn:aws:s3:::%s/*"]}]
		}`, cfg.MinioBucket)
		_ = client.SetBucketPolicy(ctx, cfg.MinioBucket, policy)
	}

	public := cfg.MinioPublicURL
	if public == "" {
		scheme := "http"
		if cfg.MinioUseSSL {
			scheme = "https"
		}
		public = fmt.Sprintf("%s://%s/%s", scheme, endpoint, cfg.MinioBucket)
	}
	return &MinioStore{client: client, bucket: cfg.MinioBucket, publicBase: strings.TrimRight(public, "/")}, nil
}

func (s *MinioStore) Put(ctx context.Context, key string, r io.Reader, size int64, contentType string) (string, error) {
	key = strings.TrimPrefix(key, "/")
	if contentType == "" {
		contentType = "application/octet-stream"
	}
	// Buffer si size inconnu
	if size < 0 {
		buf, err := io.ReadAll(r)
		if err != nil {
			return "", err
		}
		size = int64(len(buf))
		r = bytes.NewReader(buf)
	}
	_, err := s.client.PutObject(ctx, s.bucket, key, r, size, minio.PutObjectOptions{
		ContentType: contentType,
	})
	if err != nil {
		return "", err
	}
	return s.publicBase + "/" + key, nil
}

func (s *MinioStore) Get(ctx context.Context, key string) (io.ReadCloser, string, error) {
	key = strings.TrimPrefix(key, "/")
	obj, err := s.client.GetObject(ctx, s.bucket, key, minio.GetObjectOptions{})
	if err != nil {
		return nil, "", err
	}
	st, err := obj.Stat()
	if err != nil {
		_ = obj.Close()
		return nil, "", err
	}
	ct := st.ContentType
	if ct == "" {
		ct = "application/octet-stream"
	}
	return obj, ct, nil
}

func (s *MinioStore) Delete(ctx context.Context, key string) error {
	key = strings.TrimPrefix(key, "/")
	return s.client.RemoveObject(ctx, s.bucket, key, minio.RemoveObjectOptions{})
}

// Health check helper
func PingMinio(endpoint, access, secret string, useSSL bool) error {
	endpoint = strings.TrimPrefix(strings.TrimPrefix(endpoint, "http://"), "https://")
	client, err := minio.New(endpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(access, secret, ""),
		Secure: useSSL,
	})
	if err != nil {
		return err
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_, err = client.ListBuckets(ctx)
	return err
}

// Ensure http import used when needed
var _ = http.StatusOK
