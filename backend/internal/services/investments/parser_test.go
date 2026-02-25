package investments

import (
	"os"
	"testing"
)

func loadTestData(t *testing.T, filename string) string {
	t.Helper()
	data, err := os.ReadFile("testdata/" + filename)
	if err != nil {
		t.Fatalf("Failed to load test data %s: %v", filename, err)
	}
	return string(data)
}

func loadTestDataBytes(t *testing.T, filename string) []byte {
	t.Helper()
	data, err := os.ReadFile("testdata/" + filename)
	if err != nil {
		t.Fatalf("Failed to load test data %s: %v", filename, err)
	}
	return data
}

func TestParseFondee_Vyvazeny(t *testing.T) {
	text := loadTestData(t, "fondee_sample.txt")

	snapshot, err := ParseFondee(text)
	if err != nil {
		t.Fatalf("ParseFondee failed: %v", err)
	}

	t.Logf("Portfolio: %s", snapshot.PortfolioName)
	t.Logf("Period: %s - %s", snapshot.PeriodStart.Format("2006-01-02"), snapshot.PeriodEnd.Format("2006-01-02"))
	t.Logf("Start Value: %.2f CZK", snapshot.StartValue)
	t.Logf("End Value: %.2f CZK", snapshot.EndValue)
	t.Logf("Gain/Loss: %.2f CZK", snapshot.GainLoss)
	t.Logf("Fees: %.2f CZK", snapshot.Fees)

	if snapshot.PortfolioName != "Vyvážený" {
		t.Errorf("Expected portfolio name 'Vyvážený', got %q", snapshot.PortfolioName)
	}
	if snapshot.StartValue != 150000 {
		t.Errorf("Expected start value 150000, got %.2f", snapshot.StartValue)
	}
	if snapshot.EndValue != 153200 {
		t.Errorf("Expected end value 153200, got %.2f", snapshot.EndValue)
	}
	if snapshot.GainLoss != 3200 {
		t.Errorf("Expected gain 3200, got %.2f", snapshot.GainLoss)
	}
	if snapshot.Fees != 45 {
		t.Errorf("Expected fees 45, got %.2f", snapshot.Fees)
	}
}

func TestParseFondee_RiskJeZisk(t *testing.T) {
	text := loadTestData(t, "fondee_sample2.txt")

	snapshot, err := ParseFondee(text)
	if err != nil {
		t.Fatalf("ParseFondee failed: %v", err)
	}

	t.Logf("Portfolio: %s", snapshot.PortfolioName)
	t.Logf("Period: %s - %s", snapshot.PeriodStart.Format("2006-01-02"), snapshot.PeriodEnd.Format("2006-01-02"))
	t.Logf("Start Value: %.2f CZK", snapshot.StartValue)
	t.Logf("End Value: %.2f CZK", snapshot.EndValue)
	t.Logf("Gain/Loss: %.2f CZK", snapshot.GainLoss)

	if snapshot.PortfolioName != "Risk je zisk" {
		t.Errorf("Expected portfolio name 'Risk je zisk', got %q", snapshot.PortfolioName)
	}
	if snapshot.StartValue != 75000 {
		t.Errorf("Expected start value 75000, got %.2f", snapshot.StartValue)
	}
	if snapshot.EndValue != 77500 {
		t.Errorf("Expected end value 77500, got %.2f", snapshot.EndValue)
	}
	if snapshot.GainLoss != 2500 {
		t.Errorf("Expected gain 2500, got %.2f", snapshot.GainLoss)
	}
}

// TestParseAmundi_Q4Format tests the Q4 report format where
// "CELKOVÁ HODNOTA MAJETKU" is on a single line and fund names
// wrap across two lines (name prefix + data line).
func TestParseAmundi_Q4Format(t *testing.T) {
	text := loadTestData(t, "amundi_sample.txt")

	snapshot, err := ParseAmundi(text)
	if err != nil {
		t.Fatalf("ParseAmundi failed: %v", err)
	}

	t.Logf("Portfolio: %s", snapshot.PortfolioName)
	t.Logf("Contract: %s", snapshot.ContractID)
	t.Logf("Report Date: %s", snapshot.ReportDate.Format("2006-01-02"))
	t.Logf("End Value: %.2f CZK", snapshot.EndValue)
	t.Logf("Invested: %.2f CZK", snapshot.Invested)
	t.Logf("Gain/Loss: %.2f CZK", snapshot.GainLoss)
	t.Logf("Holdings: %d", len(snapshot.Holdings))
	for _, h := range snapshot.Holdings {
		t.Logf("  - %s [%s] %.4f x %.2f %s = %.2f %s", h.Name, h.ISIN, h.Units, h.PricePerUnit, h.PriceCurrency, h.TotalValue, h.ValueCurrency)
	}

	if snapshot.ContractID != "1234567890" {
		t.Errorf("Expected contract ID '1234567890', got %q", snapshot.ContractID)
	}
	if snapshot.EndValue < 120000 || snapshot.EndValue > 121000 {
		t.Errorf("Expected end value ~120500, got %.2f", snapshot.EndValue)
	}
	if snapshot.Invested < 104000 || snapshot.Invested > 106000 {
		t.Errorf("Expected invested ~105000, got %.2f", snapshot.Invested)
	}
	if snapshot.GainLoss < 15000 || snapshot.GainLoss > 16000 {
		t.Errorf("Expected gain ~15500, got %.2f", snapshot.GainLoss)
	}
	if len(snapshot.Holdings) < 3 {
		t.Errorf("Expected at least 3 holdings, got %d", len(snapshot.Holdings))
	}
}

// TestParseAmundi_Q2Format tests the Q2 quarterly report format where
// "CELKOVÁ HODNOTA" and "MAJETKU" are split across lines, and fund names
// span 3 lines: prefix line, data line with partial name, suffix line.
func TestParseAmundi_Q2Format(t *testing.T) {
	text := loadTestData(t, "amundi_sample2.txt")

	snapshot, err := ParseAmundi(text)
	if err != nil {
		t.Fatalf("ParseAmundi failed: %v", err)
	}

	t.Logf("Contract: %s", snapshot.ContractID)
	t.Logf("Report Date: %s", snapshot.ReportDate.Format("2006-01-02"))
	t.Logf("End Value: %.2f", snapshot.EndValue)
	t.Logf("Invested: %.2f", snapshot.Invested)
	t.Logf("Gain/Loss: %.2f", snapshot.GainLoss)
	t.Logf("Holdings: %d", len(snapshot.Holdings))
	for _, h := range snapshot.Holdings {
		t.Logf("  - %s [%s] %.4f x %.2f %s = %.2f %s (%s)", h.Name, h.ISIN, h.Units, h.PricePerUnit, h.PriceCurrency, h.TotalValue, h.ValueCurrency, h.Category)
	}

	if snapshot.ContractID != "9988776655" {
		t.Errorf("Expected contract ID '9988776655', got %q", snapshot.ContractID)
	}
	if snapshot.EndValue < 42000 || snapshot.EndValue > 43000 {
		t.Errorf("Expected end value ~42830, got %.2f", snapshot.EndValue)
	}
	if snapshot.Invested < 38000 || snapshot.Invested > 39000 {
		t.Errorf("Expected invested ~38500, got %.2f", snapshot.Invested)
	}
	if snapshot.GainLoss < 4000 || snapshot.GainLoss > 5000 {
		t.Errorf("Expected gain ~4330, got %.2f", snapshot.GainLoss)
	}
	if len(snapshot.Holdings) != 5 {
		t.Errorf("Expected 5 holdings, got %d", len(snapshot.Holdings))
	}
	// Verify fund names are properly assembled from multi-line format
	if len(snapshot.Holdings) >= 3 {
		// First holding: name before + name after data line
		if snapshot.Holdings[0].Name != "Templeton Growth European Fund - A CZK (C)" {
			t.Errorf("Expected first holding name 'Templeton Growth European Fund - A CZK (C)', got %q", snapshot.Holdings[0].Name)
		}
		// Second holding: name before (2 lines) + partial on data line + name after
		if snapshot.Holdings[1].Name != "Aberdeen Standard Asia Pacific Equity CZK Hedged (C)" {
			t.Errorf("Expected second holding name 'Aberdeen Standard Asia Pacific Equity CZK Hedged (C)', got %q", snapshot.Holdings[1].Name)
		}
	}
}

func TestParseRevolutStocks(t *testing.T) {
	data := loadTestDataBytes(t, "revolut_trading_pnl_sample.csv")

	snapshot, err := ParseRevolutStocks(data)
	if err != nil {
		t.Fatalf("ParseRevolutStocks failed: %v", err)
	}

	t.Logf("Provider: %s", snapshot.Provider)
	t.Logf("Portfolio: %s", snapshot.PortfolioName)
	t.Logf("Report Date: %s", snapshot.ReportDate.Format("2006-01-02"))
	t.Logf("End Value: %.2f", snapshot.EndValue)
	t.Logf("Invested: %.2f", snapshot.Invested)
	t.Logf("Gain/Loss: %.2f", snapshot.GainLoss)
	t.Logf("Holdings: %d", len(snapshot.Holdings))
	for _, h := range snapshot.Holdings {
		t.Logf("  - %s [%s] %.4f = %.2f %s (%s)", h.Name, h.ISIN, h.Units, h.TotalValue, h.ValueCurrency, h.Category)
	}

	if snapshot.Provider != "revolut-stocks" {
		t.Errorf("Expected provider 'revolut-stocks', got %q", snapshot.Provider)
	}
	if snapshot.ReportDate.Format("2006-01-02") != "2025-04-02" {
		t.Errorf("Expected report date 2025-04-02, got %s", snapshot.ReportDate.Format("2006-01-02"))
	}
	// Should have stock holdings + dividend holdings
	if len(snapshot.Holdings) < 5 {
		t.Errorf("Expected at least 5 holdings (stocks + dividends), got %d", len(snapshot.Holdings))
	}
	// Invested should be sum of cost bases: 3.80+10.00+48.68+40.00+100.00 = 202.48
	if snapshot.Invested < 202 || snapshot.Invested > 203 {
		t.Errorf("Expected invested ~202.48, got %.2f", snapshot.Invested)
	}
}

func TestParseRevolutCrypto(t *testing.T) {
	data := loadTestDataBytes(t, "revolut_crypto_sample.csv")

	snapshot, err := ParseRevolutCrypto(data)
	if err != nil {
		t.Fatalf("ParseRevolutCrypto failed: %v", err)
	}

	t.Logf("Provider: %s", snapshot.Provider)
	t.Logf("Portfolio: %s", snapshot.PortfolioName)
	t.Logf("Report Date: %s", snapshot.ReportDate.Format("2006-01-02"))
	t.Logf("End Value: %.2f", snapshot.EndValue)
	t.Logf("Invested: %.2f", snapshot.Invested)
	t.Logf("Gain/Loss: %.2f", snapshot.GainLoss)
	t.Logf("Fees: %.2f", snapshot.Fees)
	t.Logf("Holdings: %d", len(snapshot.Holdings))
	for _, h := range snapshot.Holdings {
		t.Logf("  - %s %.6f = %.2f %s (%s)", h.Name, h.Units, h.TotalValue, h.ValueCurrency, h.Category)
	}

	if snapshot.Provider != "revolut-crypto" {
		t.Errorf("Expected provider 'revolut-crypto', got %q", snapshot.Provider)
	}
	if snapshot.ReportDate.Format("2006-01-02") != "2024-02-28" {
		t.Errorf("Expected report date 2024-02-28, got %s", snapshot.ReportDate.Format("2006-01-02"))
	}
	// Should have 3 symbols: BCH, XRP, BTC
	if len(snapshot.Holdings) != 3 {
		t.Errorf("Expected 3 holdings, got %d", len(snapshot.Holdings))
	}
	// Total fees: 0+0+1.19+0.50+0.02+0.02 = 1.73
	if snapshot.Fees < 1.7 || snapshot.Fees > 1.8 {
		t.Errorf("Expected fees ~1.73, got %.2f", snapshot.Fees)
	}
}

// TestParseAmundi_Q3Format tests another quarterly report with the split-label format.
func TestParseAmundi_Q3Format(t *testing.T) {
	text := loadTestData(t, "amundi_sample3.txt")

	snapshot, err := ParseAmundi(text)
	if err != nil {
		t.Fatalf("ParseAmundi failed: %v", err)
	}

	t.Logf("Contract: %s", snapshot.ContractID)
	t.Logf("Report Date: %s", snapshot.ReportDate.Format("2006-01-02"))
	t.Logf("End Value: %.2f", snapshot.EndValue)
	t.Logf("Invested: %.2f", snapshot.Invested)
	t.Logf("Gain/Loss: %.2f", snapshot.GainLoss)
	t.Logf("Holdings: %d", len(snapshot.Holdings))
	for _, h := range snapshot.Holdings {
		t.Logf("  - %s [%s] %.4f x %.2f %s = %.2f %s (%s)", h.Name, h.ISIN, h.Units, h.PricePerUnit, h.PriceCurrency, h.TotalValue, h.ValueCurrency, h.Category)
	}

	if snapshot.ContractID != "5544332211" {
		t.Errorf("Expected contract ID '5544332211', got %q", snapshot.ContractID)
	}
	if snapshot.EndValue < 67000 || snapshot.EndValue > 68000 {
		t.Errorf("Expected end value ~67450, got %.2f", snapshot.EndValue)
	}
	if snapshot.Invested < 61000 || snapshot.Invested > 62000 {
		t.Errorf("Expected invested ~61200, got %.2f", snapshot.Invested)
	}
	if snapshot.GainLoss < 6000 || snapshot.GainLoss > 7000 {
		t.Errorf("Expected gain ~6250, got %.2f", snapshot.GainLoss)
	}
	if len(snapshot.Holdings) != 5 {
		t.Errorf("Expected 5 holdings, got %d", len(snapshot.Holdings))
	}
}
