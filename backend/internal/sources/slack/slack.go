package slack

import (
	"context"
	"lifehub/backend/internal/domain"
	"lifehub/backend/internal/sources"
)

func init() {
	sources.Register("slack", func() sources.Source {
		return &SlackSource{}
	})
}

type SlackSource struct{}

func (s *SlackSource) ID() string   { return "slack" }
func (s *SlackSource) Name() string { return "Slack" }
func (s *SlackSource) Description() string { return "Connect your Slack channels to see real-time messages and alerts." }
func (s *SlackSource) Icon() string { return "slack" }

func (s *SlackSource) SupportedOperations() []sources.Operation {
	return []sources.Operation{sources.OpRead}
}

func (s *SlackSource) FetchTypedData(ctx context.Context, cfg sources.SourceConfig, allowedOps []sources.Operation) (domain.Result, error) {
	// Mock type-safe message
	return domain.Result{
		Type:       domain.TypeCommunication,
		SourceID:   cfg.SourceID,
		SourceName: s.Name(),
		Items: []domain.Message{
			{ID: "1", Sender: "Alice", Preview: "Type-safe Slack message", Channel: "general"},
		},
	}, nil
}
