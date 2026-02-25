package investments

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"time"
)

// ParseFondee parses a Fondee portfolio statement from extracted text.
// The text should be extracted via pdftotext -layout.
func ParseFondee(text string) (*PortfolioSnapshot, error) {
	snapshot := &PortfolioSnapshot{
		Provider: "fondee",
		Currency: "CZK",
	}

	lines := strings.Split(text, "\n")

	for _, line := range lines {
		trimmed := strings.TrimSpace(line)

		// Portfolio name
		if strings.HasPrefix(trimmed, "Název portfolia") {
			snapshot.PortfolioName = extractValue(trimmed, "Název portfolia")
		}

		// Period: "1. 1. 2026 – 31. 1. 2026"
		if strings.HasPrefix(trimmed, "Období") {
			periodStr := extractValue(trimmed, "Období")
			start, end, err := parseFondeePeriod(periodStr)
			if err == nil {
				snapshot.PeriodStart = start
				snapshot.PeriodEnd = end
				snapshot.ReportDate = end
			}
		}

		// Start value
		if strings.HasPrefix(trimmed, "Počáteční hodnota:") {
			snapshot.StartValue = parseCZKAmount(trimmed)
		}

		// End value
		if strings.HasPrefix(trimmed, "Koncová hodnota:") {
			snapshot.EndValue = parseCZKAmount(trimmed)
		}

		// Fee
		if strings.HasPrefix(trimmed, "Poplatek:") && !strings.Contains(trimmed, "dodatečný") && !strings.Contains(trimmed, "ETF") {
			snapshot.Fees = parseCZKAmount(trimmed)
		}

		// Gain/loss (Zhodnocení)
		if strings.HasPrefix(trimmed, "Zhodnocení:") {
			snapshot.GainLoss = parseCZKAmount(trimmed)
		}
	}

	// Calculate invested as end_value - gain_loss (approximate)
	if snapshot.EndValue > 0 && snapshot.GainLoss != 0 {
		snapshot.Invested = snapshot.EndValue - snapshot.GainLoss
	}

	if snapshot.PortfolioName == "" {
		return nil, fmt.Errorf("could not parse Fondee portfolio: portfolio name not found")
	}

	return snapshot, nil
}

// parseFondeePeriod parses "1. 1. 2026 – 31. 1. 2026" into two time.Time values
func parseFondeePeriod(s string) (time.Time, time.Time, error) {
	s = strings.TrimSpace(s)
	// Replace various dash types
	s = strings.ReplaceAll(s, "–", "-")
	s = strings.ReplaceAll(s, "—", "-")

	parts := strings.SplitN(s, "-", 2)
	if len(parts) != 2 {
		return time.Time{}, time.Time{}, fmt.Errorf("invalid period format: %s", s)
	}

	start, err := parseCzechDate(strings.TrimSpace(parts[0]))
	if err != nil {
		return time.Time{}, time.Time{}, fmt.Errorf("invalid start date: %w", err)
	}

	end, err := parseCzechDate(strings.TrimSpace(parts[1]))
	if err != nil {
		return time.Time{}, time.Time{}, fmt.Errorf("invalid end date: %w", err)
	}

	return start, end, nil
}

// parseCzechDate parses "1. 1. 2026" or "31. 12. 2025" into time.Time
func parseCzechDate(s string) (time.Time, error) {
	s = strings.TrimSpace(s)
	// Remove dots and extra spaces: "1. 1. 2026" -> "1 1 2026"
	s = strings.ReplaceAll(s, ".", "")
	parts := strings.Fields(s)
	if len(parts) != 3 {
		return time.Time{}, fmt.Errorf("expected 3 date parts, got %d in %q", len(parts), s)
	}

	day, err := strconv.Atoi(parts[0])
	if err != nil {
		return time.Time{}, err
	}
	month, err := strconv.Atoi(parts[1])
	if err != nil {
		return time.Time{}, err
	}
	year, err := strconv.Atoi(parts[2])
	if err != nil {
		return time.Time{}, err
	}

	return time.Date(year, time.Month(month), day, 0, 0, 0, 0, time.UTC), nil
}

// parseCZKAmount extracts a number from strings like "42 124 Kč" or "641 Kč"
func parseCZKAmount(line string) float64 {
	// Find the amount pattern: digits with spaces, optional comma for decimals, followed by Kč
	re := regexp.MustCompile(`([\d\s]+(?:,\d+)?)\s*Kč`)
	match := re.FindStringSubmatch(line)
	if len(match) < 2 {
		return 0
	}

	numStr := match[1]
	// Remove spaces
	numStr = strings.ReplaceAll(numStr, " ", "")
	// Replace comma with dot
	numStr = strings.ReplaceAll(numStr, ",", ".")
	numStr = strings.TrimSpace(numStr)

	val, err := strconv.ParseFloat(numStr, 64)
	if err != nil {
		return 0
	}
	return val
}

// extractValue extracts value after a label like "Název portfolia         Vyvážený"
func extractValue(line, prefix string) string {
	idx := strings.Index(line, prefix)
	if idx == -1 {
		return ""
	}
	return strings.TrimSpace(line[idx+len(prefix):])
}
