package sources

import (
	"context"
	"lifehub/backend/internal/domain"
)

// Operation defines allowed actions on a source
type Operation string

const (
	OpRead   Operation = "read"
	OpWrite  Operation = "write"
	OpDelete Operation = "delete"
	OpMask   Operation = "mask" // Special op for E-Ink to hide sensitive data
)

// SourceConfig holds the typed configuration for a source
type SourceConfig struct {
	SourceID    string
	WorkspaceID string
	RawConfig   map[string]interface{}
}

// Source now uses the Domain models for type safety
type Source interface {
	ID() string
	Name() string
	Description() string
	Icon() string
	SupportedOperations() []Operation
	
	// FetchTypedData returns a specific Result type instead of generic maps
	FetchTypedData(ctx context.Context, cfg SourceConfig, allowedOps []Operation) (domain.Result, error)
}

var Registry = make(map[string]func() Source)

func Register(sourceType string, factory func() Source) {
	Registry[sourceType] = factory
}