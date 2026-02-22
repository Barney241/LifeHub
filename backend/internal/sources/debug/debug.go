package debug

import (
	"context"
	"log"
	"lifehub/backend/internal/domain"
	"lifehub/backend/internal/sources"
	"github.com/pocketbase/pocketbase"
)

var App *pocketbase.PocketBase

func init() {
	sources.Register("debug_source", func() sources.Source {
		return &DebugSource{}
	})
}

type DebugSource struct{}

func (s *DebugSource) ID() string   { return "debug_source" }
func (s *DebugSource) Name() string { return "Debug" }
func (s *DebugSource) Description() string { return "Internal diagnostic source." }
func (s *DebugSource) Icon() string { return "settings" }

func (s *DebugSource) SupportedOperations() []sources.Operation {
	return []sources.Operation{sources.OpRead}
}

func (s *DebugSource) FetchTypedData(ctx context.Context, cfg sources.SourceConfig, allowedOps []sources.Operation) (domain.Result, error) {
	log.Printf("DEBUG SOURCE: Target Workspace ID from config: %s", cfg.WorkspaceID)
	
	workspaces, _ := App.FindRecordsByFilter("workspaces", "", "name", 0, 0)
	for _, w := range workspaces {
		log.Printf("DEBUG SOURCE: Existing Workspace: %s (ID: %s)", w.GetString("name"), w.Id)
	}

	tasks, _ := App.FindRecordsByFilter("tasks", "", "", 0, 0)
	for _, t := range tasks {
		log.Printf("DEBUG SOURCE: Existing Task: %s (Workspace ID in task: %s)", t.GetString("content"), t.GetString("workspace"))
	}

	return domain.Result{
		Type:       domain.TypeCommunication,
		SourceID:   cfg.SourceID,
		SourceName: s.Name(),
		Items: []domain.Message{
			{ID: "debug", Sender: "System", Preview: "Check backend logs for ID comparison"},
		},
	}, nil
}
