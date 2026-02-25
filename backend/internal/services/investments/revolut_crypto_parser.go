package investments

import (
	"encoding/csv"
	"fmt"
	"strconv"
	"strings"
	"time"
)

// ParseRevolutCrypto parses a Revolut crypto trading account statement CSV.
// Format: Date acquired,Date sold,Symbol,Quantity,Cost basis,Gross proceeds,Gross PnL,Fees,Net PnL,Currency
func ParseRevolutCrypto(data []byte) (*PortfolioSnapshot, error) {
	content := string(data)
	reader := csv.NewReader(strings.NewReader(content))
	reader.LazyQuotes = true
	reader.FieldsPerRecord = -1

	records, err := reader.ReadAll()
	if err != nil {
		return nil, fmt.Errorf("failed to parse crypto CSV: %w", err)
	}

	if len(records) < 2 {
		return nil, fmt.Errorf("crypto CSV has no data rows")
	}

	snapshot := &PortfolioSnapshot{
		Provider:      "revolut-crypto",
		PortfolioName: "Revolut Crypto",
		Currency:      "USD",
	}

	type symbolAgg struct {
		quantity  float64
		costBasis float64
		proceeds  float64
		grossPnL  float64
		fees      float64
		netPnL    float64
		currency  string
	}
	symbols := make(map[string]*symbolAgg)
	var maxDate time.Time

	for i, row := range records {
		if i == 0 || len(row) < 10 {
			continue
		}
		if row[0] == "Date acquired" {
			continue
		}

		symbol := strings.TrimSpace(row[2])
		quantity, _ := strconv.ParseFloat(strings.TrimSpace(row[3]), 64)
		costBasis, _ := strconv.ParseFloat(strings.TrimSpace(row[4]), 64)
		proceeds, _ := strconv.ParseFloat(strings.TrimSpace(row[5]), 64)
		grossPnL, _ := strconv.ParseFloat(strings.TrimSpace(row[6]), 64)
		fees, _ := strconv.ParseFloat(strings.TrimSpace(row[7]), 64)
		netPnL, _ := strconv.ParseFloat(strings.TrimSpace(row[8]), 64)
		currency := strings.TrimSpace(row[9])

		dateSold := strings.TrimSpace(row[1])
		if t, err := time.Parse("2006-01-02", dateSold); err == nil {
			if t.After(maxDate) {
				maxDate = t
			}
		}

		agg, ok := symbols[symbol]
		if !ok {
			agg = &symbolAgg{currency: currency}
			symbols[symbol] = agg
		}
		agg.quantity += quantity
		agg.costBasis += costBasis
		agg.proceeds += proceeds
		agg.grossPnL += grossPnL
		agg.fees += fees
		agg.netPnL += netPnL
	}

	snapshot.ReportDate = maxDate

	var totalCostBasis, totalProceeds, totalFees, totalNetPnL float64
	for symbol, agg := range symbols {
		holding := Holding{
			Name:          symbol,
			Category:      "Crypto",
			Units:         agg.quantity,
			TotalValue:    agg.proceeds,
			ValueCurrency: agg.currency,
			PricePerUnit:  agg.costBasis,
			PriceCurrency: agg.currency,
		}
		snapshot.Holdings = append(snapshot.Holdings, holding)
		totalCostBasis += agg.costBasis
		totalProceeds += agg.proceeds
		totalFees += agg.fees
		totalNetPnL += agg.netPnL
	}

	snapshot.Invested = totalCostBasis
	snapshot.EndValue = totalProceeds
	snapshot.GainLoss = totalNetPnL
	snapshot.Fees = totalFees

	return snapshot, nil
}
