package investments

import (
	"encoding/csv"
	"fmt"
	"strconv"
	"strings"
	"time"
)

// ParseRevolutStocks parses a Revolut stock trading P&L CSV export.
// The file has two sections separated by a blank line:
// 1. "Income from Sells" - closed position P&L data
// 2. "Other income & fees" - dividend payments
func ParseRevolutStocks(data []byte) (*PortfolioSnapshot, error) {
	content := string(data)
	sections := splitSections(content)

	if len(sections) < 1 {
		return nil, fmt.Errorf("could not find sells section in Revolut stocks CSV")
	}

	snapshot := &PortfolioSnapshot{
		Provider:      "revolut-stocks",
		PortfolioName: "Revolut Stocks",
		Currency:      "USD",
	}

	// Parse sells section
	type symbolAgg struct {
		name       string
		isin       string
		costBasis  float64
		proceeds   float64
		pnl        float64
		quantity   float64
		currency   string
		maxDateStr string
	}
	symbols := make(map[string]*symbolAgg)
	var maxDate time.Time

	sellsCSV := sections[0]
	reader := csv.NewReader(strings.NewReader(sellsCSV))
	reader.LazyQuotes = true
	reader.FieldsPerRecord = -1
	records, err := reader.ReadAll()
	if err != nil {
		return nil, fmt.Errorf("failed to parse sells section: %w", err)
	}

	for i, row := range records {
		// Skip header lines
		if i == 0 || len(row) < 11 {
			continue
		}
		if row[0] == "Date acquired" {
			continue
		}

		symbol := strings.TrimSpace(row[2])
		name := strings.TrimSpace(row[3])
		isin := strings.TrimSpace(row[4])
		quantity, _ := strconv.ParseFloat(strings.TrimSpace(row[6]), 64)
		costBasis, _ := strconv.ParseFloat(strings.TrimSpace(row[7]), 64)
		proceeds, _ := strconv.ParseFloat(strings.TrimSpace(row[8]), 64)
		pnl, _ := strconv.ParseFloat(strings.TrimSpace(row[9]), 64)
		currency := strings.TrimSpace(row[10])

		dateSold := strings.TrimSpace(row[1])
		if t, err := time.Parse("2006-01-02", dateSold); err == nil {
			if t.After(maxDate) {
				maxDate = t
			}
		}

		agg, ok := symbols[symbol]
		if !ok {
			agg = &symbolAgg{name: name, isin: isin, currency: currency}
			symbols[symbol] = agg
		}
		agg.costBasis += costBasis
		agg.proceeds += proceeds
		agg.pnl += pnl
		agg.quantity += quantity
	}

	// Parse dividends section if present
	type dividendAgg struct {
		grossAmount    float64
		withholdingTax float64
		netAmount      float64
	}
	dividends := make(map[string]*dividendAgg)

	if len(sections) >= 2 {
		divCSV := sections[1]
		reader := csv.NewReader(strings.NewReader(divCSV))
		reader.LazyQuotes = true
		reader.FieldsPerRecord = -1
		divRecords, err := reader.ReadAll()
		if err == nil {
			for i, row := range divRecords {
				if i == 0 || len(row) < 9 {
					continue
				}
				if row[0] == "Date" {
					continue
				}

				symbol := strings.TrimSpace(row[1])
				grossStr := strings.TrimSpace(row[5])
				gross, _ := strconv.ParseFloat(grossStr, 64)

				netStr := strings.TrimSpace(row[7])
				// Net amount may have " CZK" suffix
				netStr = strings.TrimSuffix(netStr, " CZK")
				netStr = strings.TrimSuffix(netStr, " USD")
				netStr = strings.TrimSuffix(netStr, " EUR")
				net, _ := strconv.ParseFloat(netStr, 64)

				taxStr := strings.TrimSpace(row[6])
				taxStr = strings.TrimPrefix(taxStr, "$")
				taxStr = strings.TrimSuffix(taxStr, " CZK")
				taxStr = strings.TrimSuffix(taxStr, " USD")
				taxStr = strings.TrimSuffix(taxStr, " EUR")
				tax, _ := strconv.ParseFloat(taxStr, 64)

				// Track latest dividend date
				if t, err := time.Parse("2006-01-02", strings.TrimSpace(row[0])); err == nil {
					if t.After(maxDate) {
						maxDate = t
					}
				}

				div, ok := dividends[symbol]
				if !ok {
					div = &dividendAgg{}
					dividends[symbol] = div
				}
				div.grossAmount += gross
				div.withholdingTax += tax
				div.netAmount += net
			}
		}
	}

	snapshot.ReportDate = maxDate

	// Build holdings from sells
	var totalCostBasis, totalProceeds, totalPnL float64
	for symbol, agg := range symbols {
		holding := Holding{
			Name:          fmt.Sprintf("%s (%s)", agg.name, symbol),
			ISIN:          agg.isin,
			Category:      "Stock",
			Units:         agg.quantity,
			TotalValue:    agg.proceeds,
			ValueCurrency: agg.currency,
			PricePerUnit:  agg.costBasis, // Using cost basis as reference price
			PriceCurrency: agg.currency,
		}
		snapshot.Holdings = append(snapshot.Holdings, holding)
		totalCostBasis += agg.costBasis
		totalProceeds += agg.proceeds
		totalPnL += agg.pnl
	}

	// Add dividend holdings
	var totalDividends float64
	for symbol, div := range dividends {
		holding := Holding{
			Name:          fmt.Sprintf("%s Dividends", symbol),
			Category:      "Dividend",
			TotalValue:    div.netAmount,
			ValueCurrency: "CZK", // Revolut dividends are reported in CZK for net amount
		}
		snapshot.Holdings = append(snapshot.Holdings, holding)
		totalDividends += div.netAmount
	}

	snapshot.Invested = totalCostBasis
	snapshot.EndValue = totalProceeds + totalDividends
	snapshot.GainLoss = totalPnL + totalDividends

	return snapshot, nil
}

// splitSections splits the CSV content into sections separated by blank lines.
// It skips the first line of each section (section header like "Income from Sells").
func splitSections(content string) []string {
	lines := strings.Split(content, "\n")

	var sections []string
	var current []string
	inSection := false

	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if trimmed == "" {
			if inSection && len(current) > 0 {
				sections = append(sections, strings.Join(current, "\n"))
				current = nil
				inSection = false
			}
			continue
		}

		if !inSection {
			// Check if this is a section header (non-CSV line)
			if !strings.Contains(trimmed, ",") {
				// This is a section header like "Income from Sells" or "Other income & fees"
				inSection = true
				continue
			}
			// If it contains commas, it's data - start section without skipping
			inSection = true
		}

		current = append(current, line)
	}

	// Don't forget the last section
	if len(current) > 0 {
		sections = append(sections, strings.Join(current, "\n"))
	}

	return sections
}
