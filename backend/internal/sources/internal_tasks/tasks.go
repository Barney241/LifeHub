package internal_tasks

import (
	"context"
	"log"
	"lifehub/backend/internal/domain"
	"lifehub/backend/internal/sources"
	"github.com/pocketbase/pocketbase"
)

var App *pocketbase.PocketBase

func init() {
	sources.Register("internal_tasks", func() sources.Source {
		return &InternalTasksSource{}
	})
}

type InternalTasksSource struct{}

func (s *InternalTasksSource) ID() string   { return "internal_tasks" }
func (s *InternalTasksSource) Name() string { return "Tasks" }
func (s *InternalTasksSource) Description() string { return "Native task management with priorities and due dates." }
func (s *InternalTasksSource) Icon() string { return "check-circle" }

func (s *InternalTasksSource) SupportedOperations() []sources.Operation {
	return []sources.Operation{sources.OpRead, sources.OpWrite}
}

func (s *InternalTasksSource) FetchTypedData(ctx context.Context, cfg sources.SourceConfig, allowedOps []sources.Operation) (domain.Result, error) {
	log.Printf("InternalTasksSource: Fetching data for workspace %s", cfg.WorkspaceID)
	
	// 1. Check if OpRead is allowed for this device/request
	canRead := false
	for _, op := range allowedOps {
		if op == sources.OpRead {
			canRead = true
			break
		}
	}
	if !canRead {
		log.Printf("InternalTasksSource: OpRead not allowed")
		return domain.Result{Type: domain.TypeTask, Items: []domain.Task{}}, nil
	}

	// 2. Fetch records
	filter := "source = '" + cfg.SourceID + "' && completed = false"
	log.Printf("InternalTasksSource: Using filter: %s", filter)
	records, err := App.FindRecordsByFilter("tasks", filter, "-priority", 10, 0)
	if err != nil {
		log.Printf("InternalTasksSource: Error fetching records: %v", err)
		return domain.Result{}, err
	}

	log.Printf("InternalTasksSource: Found %d records", len(records))

	// 3. Map to Type-Safe Struct
	tasks := make([]domain.Task, 0, len(records))
	for _, r := range records {
		due := r.GetDateTime("due_date").Time()
		tasks = append(tasks, domain.Task{
			ID:       r.Id,
			Content:  r.GetString("content"),
			Priority: r.GetString("priority"),
			Due:      &due,
		})
	}

	return domain.Result{
		Type:       domain.TypeTask,
		SourceID:   cfg.SourceID,
		SourceName: s.Name(), // Default name, can be overridden in main.go
		Items:      tasks,
	}, nil
}
