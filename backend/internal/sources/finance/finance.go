package finance

import (
	"context"
	"log"
	"lifehub/backend/internal/domain"
	"lifehub/backend/internal/sources"
	"github.com/pocketbase/pocketbase"
)

var App *pocketbase.PocketBase

func init() {
	sources.Register("finance", func() sources.Source {
		return &FinanceSource{}
	})
}

type FinanceSource struct{}

func (s *FinanceSource) ID() string   { return "finance" }
func (s *FinanceSource) Name() string { return "Finance" }
func (s *FinanceSource) Description() string { return "Track transactions, expenses and income directly in your workspace." }
func (s *FinanceSource) Icon() string { return "wallet" }

func (s *FinanceSource) SupportedOperations() []sources.Operation {
	return []sources.Operation{sources.OpRead, sources.OpMask}
}

func (s *FinanceSource) FetchTypedData(ctx context.Context, cfg sources.SourceConfig, allowedOps []sources.Operation) (domain.Result, error) {
	log.Printf("FinanceSource: Fetching data for workspace %s", cfg.WorkspaceID)
	
	maskData := true
	for _, op := range allowedOps {
		if op == sources.OpMask {
			maskData = false // If OpMask is provided, it means we have PERMISSION to see unmasked data
		}
	}

	filter := "source = '" + cfg.SourceID + "'"
	log.Printf("FinanceSource: Using filter: %s", filter)
	records, err := App.FindRecordsByFilter("finance_transactions", filter, "-date", 5, 0)
	if err != nil {
		log.Printf("FinanceSource: Error fetching records: %v", err)
		return domain.Result{}, err
	}

	log.Printf("FinanceSource: Found %d records", len(records))

	results := make([]domain.FinancialRecord, 0, len(records))
	for _, r := range records {
		amount := r.GetFloat("amount")
		if maskData {
			amount = 0 // Or some logic to indicate masked
		}

		results = append(results, domain.FinancialRecord{
			ID:          r.Id,
			Description: r.GetString("description"),
			Amount:      amount,
			IsExpense:   r.GetString("type") == "expense",
			Date:        r.GetDateTime("date").Time(),
		})
	}

		return domain.Result{

			Type:       domain.TypeFinance,

			SourceID:   cfg.SourceID,

			SourceName: s.Name(),

			Items:      results,

		}, nil

	}

	