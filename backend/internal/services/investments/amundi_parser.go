package investments

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"time"
)

// ParseAmundi parses an Amundi quarterly report from extracted text.
// The text should be extracted via pdftotext -layout from a decrypted PDF.
func ParseAmundi(text string) (*PortfolioSnapshot, error) {
	snapshot := &PortfolioSnapshot{
		Provider:      "amundi",
		PortfolioName: "Fondy",
		Currency:      "CZK",
	}

	lines := strings.Split(text, "\n")

	// Parse contract number
	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, "Číslo účtu/smlouvy:") || strings.HasPrefix(trimmed, "Číslo smlouvy:") {
			snapshot.ContractID = extractValue(trimmed, ":")
			// Remove the colon prefix extraction - just get everything after the last colon
			parts := strings.SplitN(trimmed, ":", 2)
			if len(parts) == 2 {
				snapshot.ContractID = strings.TrimSpace(parts[1])
			}
			break
		}
	}

	// Parse report date from "k datu 31.12.2025"
	reDateRe := regexp.MustCompile(`k datu\s+(\d{2}\.\d{2}\.\d{4})`)
	if match := reDateRe.FindStringSubmatch(text); len(match) >= 2 {
		if t, err := time.Parse("02.01.2006", match[1]); err == nil {
			snapshot.ReportDate = t
			snapshot.PeriodEnd = t
		}
	}

	// Parse period from "Období výpisu: 01.10.2025 – 31.12.2025"
	periodRe := regexp.MustCompile(`Období výpisu:\s*(\d{2}\.\d{2}\.\d{4})\s*[–-]\s*(\d{2}\.\d{2}\.\d{4})`)
	if match := periodRe.FindStringSubmatch(text); len(match) >= 3 {
		if t, err := time.Parse("02.01.2006", match[1]); err == nil {
			snapshot.PeriodStart = t
		}
		if t, err := time.Parse("02.01.2006", match[2]); err == nil {
			snapshot.PeriodEnd = t
		}
	}

	// Parse totals from the summary section
	// "CELKOVÁ HODNOTA MAJETKU" followed by amount
	// In some reports the label is split across two lines, so fall back to just "CELKOVÁ HODNOTA"
	snapshot.EndValue = parseAmundiTotal(text, "CELKOVÁ HODNOTA MAJETKU")
	if snapshot.EndValue == 0 {
		snapshot.EndValue = parseAmundiTotal(text, "CELKOVÁ HODNOTA PORTFOLIA")
	}
	if snapshot.EndValue == 0 {
		snapshot.EndValue = parseAmundiTotal(text, "CELKOVÁ HODNOTA")
	}

	snapshot.Invested = parseAmundiTotal(text, "Celková investovaná částka")
	if snapshot.Invested == 0 {
		snapshot.Invested = parseAmundiTotal(text, "Investovaná částka")
	}

	snapshot.GainLoss = parseAmundiTotal(text, "Zisk / ztráta")
	// Fallback: compute gain/loss from end value and invested
	if snapshot.GainLoss == 0 && snapshot.EndValue > 0 && snapshot.Invested > 0 {
		snapshot.GainLoss = snapshot.EndValue - snapshot.Invested
	}

	// Parse ISIN mapping
	isinMap := parseISINMap(text)

	// Parse holdings from STAVOVÝ VÝPIS section
	snapshot.Holdings = parseAmundiHoldings(lines, isinMap)

	if snapshot.EndValue == 0 && len(snapshot.Holdings) == 0 {
		return nil, fmt.Errorf("could not parse Amundi report: no values found")
	}

	return snapshot, nil
}

// parseAmundiTotal finds a labeled total value in the text.
// It searches line by line after finding the label to avoid matching numbers
// from unrelated fields (like birth dates) that appear between the label and value.
func parseAmundiTotal(text, label string) float64 {
	idx := strings.Index(text, label)
	if idx == -1 {
		return 0
	}

	// Search line by line starting from the label
	after := text[idx:]
	lines := strings.Split(after, "\n")
	re := regexp.MustCompile(`([\d\s]+(?:,\d+)?)\s*Kč`)

	// Check lines containing and after the label (up to 10 lines)
	for i, line := range lines {
		if i > 10 {
			break
		}
		match := re.FindStringSubmatch(line)
		if len(match) >= 2 {
			numStr := strings.ReplaceAll(match[1], " ", "")
			numStr = strings.ReplaceAll(numStr, ",", ".")
			numStr = strings.TrimSpace(numStr)
			val, err := strconv.ParseFloat(numStr, 64)
			if err != nil {
				continue
			}
			return val
		}
	}
	return 0
}

// parseISINMap extracts ISIN -> Fund name mapping from the footer section
func parseISINMap(text string) map[string]string {
	result := make(map[string]string)

	// Pattern: ISIN followed by fund name, e.g.:
	// "LU1095742109 First Eagle Amundi International Fund CZK AHK (C)"
	isinRe := regexp.MustCompile(`([A-Z]{2}\d{10})\s+(.+?)(?:\s{2,}|$)`)

	// Find the ISIN section
	idx := strings.Index(text, "Seznam ISIN")
	if idx == -1 {
		return result
	}

	section := text[idx:]
	// Limit search area
	if len(section) > 1000 {
		section = section[:1000]
	}

	matches := isinRe.FindAllStringSubmatch(section, -1)
	for _, match := range matches {
		if len(match) >= 3 {
			result[strings.TrimSpace(match[2])] = match[1]
		}
	}

	return result
}

// parseAmundiHoldings parses the STAVOVÝ VÝPIS (holdings) section
func parseAmundiHoldings(lines []string, isinMap map[string]string) []Holding {
	var holdings []Holding

	inHoldings := false
	var currentCurrency string

	for i := 0; i < len(lines); i++ {
		trimmed := strings.TrimSpace(lines[i])

		// Detect start of holdings section
		if strings.Contains(trimmed, "STAVOVÝ VÝPIS") {
			inHoldings = true
			continue
		}

		// Detect end of holdings section
		if inHoldings && strings.Contains(trimmed, "ZMĚNOVÝ VÝPIS") {
			break
		}

		if !inHoldings {
			continue
		}

		// Detect currency header row
		if strings.Contains(trimmed, "Měna") && strings.Contains(trimmed, "Název fondu") {
			continue
		}

		// Detect CELKEM (total) row to get currency
		if strings.Contains(trimmed, "CELKEM") {
			currRe := regexp.MustCompile(`(CZK|EUR|USD)\s*$`)
			if match := currRe.FindStringSubmatch(trimmed); len(match) >= 2 {
				currentCurrency = match[1]
			}
			continue
		}

		// Try to parse a holding line
		// Pattern: Fund name, Category, Units, Price, Date, Value, Currency
		// The fund name may span multiple lines
		holding := tryParseHoldingLine(trimmed, lines, i)
		if holding != nil {
			if holding.ValueCurrency == "" {
				holding.ValueCurrency = currentCurrency
			}
			if holding.PriceCurrency == "" {
				holding.PriceCurrency = holding.ValueCurrency
			}
			// Try to find ISIN from the map
			for name, isin := range isinMap {
				if strings.Contains(holding.Name, name) || strings.Contains(name, holding.Name) {
					holding.ISIN = isin
					break
				}
			}
			holdings = append(holdings, *holding)
		}
	}

	// Second pass: match ISINs by partial name matching
	for i := range holdings {
		if holdings[i].ISIN != "" {
			continue
		}
		for name, isin := range isinMap {
			// Check if significant words match
			nameWords := significantWords(holdings[i].Name)
			for _, w := range nameWords {
				if strings.Contains(name, w) {
					holdings[i].ISIN = isin
					break
				}
			}
			if holdings[i].ISIN != "" {
				break
			}
			_ = name
		}
	}

	return holdings
}

// isHoldingSkipLine returns true if the line is a header/total/section line that should not be
// treated as part of a fund name.
func isHoldingSkipLine(s string) bool {
	return s == "" ||
		strings.Contains(s, "Název fondu") ||
		strings.Contains(s, "CELKEM") ||
		strings.Contains(s, "Měna") ||
		strings.Contains(s, "Klient:") ||
		strings.Contains(s, "Kategorie") ||
		strings.Contains(s, "Stavový výpis") ||
		strings.Contains(s, "STAVOVÝ VÝPIS") ||
		strings.Contains(s, "ZMĚNOVÝ VÝPIS")
}

// tryParseHoldingLine attempts to parse a holding from a line with format:
// "Fund Name                   Category            Units        Price       Date         Value     Currency"
// Fund names may span multiple lines - parts appear on lines before AND after the data line.
func tryParseHoldingLine(line string, allLines []string, lineIdx int) *Holding {
	// Look for a line containing a fund category and numeric data
	holdingRe := regexp.MustCompile(`(Akciový fond|Smíšený fond|Dluhopisový fond|Fond fondů|Peněžní fond)\s+([\d,]+)\s+([\d\s,]+)\s+(\d{2}\.\d{2}\.\d{4})\s+([\d\s,]+)\s+(CZK|EUR|USD)`)

	match := holdingRe.FindStringSubmatch(line)
	if len(match) < 7 {
		return nil
	}

	units := parseAmundiNumber(match[2])
	price := parseAmundiNumber(match[3])
	totalValue := parseAmundiNumber(match[5])
	currency := match[6]
	category := match[1]

	// Get fund name from before the category on this line
	nameEnd := strings.Index(line, category)
	nameParts := []string{}
	lineNamePart := strings.TrimSpace(line[:nameEnd])

	// Collect name parts from previous lines (up to 2 lines back)
	for back := 1; back <= 2 && lineIdx-back >= 0; back++ {
		prevLine := strings.TrimSpace(allLines[lineIdx-back])
		if isHoldingSkipLine(prevLine) {
			break
		}
		// Previous line should be a pure text line (no numbers/categories typical of data rows)
		if holdingRe.MatchString(prevLine) {
			break
		}
		// If the line before this one is a data line, then this line is the
		// name suffix of the previous holding, not a prefix of the current one
		if lineIdx-back-1 >= 0 && holdingRe.MatchString(strings.TrimSpace(allLines[lineIdx-back-1])) {
			break
		}
		nameParts = append([]string{prevLine}, nameParts...)
	}

	if lineNamePart != "" {
		nameParts = append(nameParts, lineNamePart)
	}

	// Check the line AFTER the data line for name continuation
	// e.g. "Equity - A CZK Hgd (C)" or "AHK (C )" appearing after the data row
	if lineIdx+1 < len(allLines) {
		nextLine := strings.TrimSpace(allLines[lineIdx+1])
		if !isHoldingSkipLine(nextLine) && !holdingRe.MatchString(nextLine) {
			// Make sure it's not another fund's first name line by checking if the line
			// after that is a data line (which would mean nextLine is the start of a new holding)
			isNextHoldingStart := false
			if lineIdx+2 < len(allLines) {
				lineAfterNext := strings.TrimSpace(allLines[lineIdx+2])
				if holdingRe.MatchString(lineAfterNext) {
					isNextHoldingStart = true
				}
			}
			if !isNextHoldingStart {
				nameParts = append(nameParts, nextLine)
			}
		}
	}

	name := strings.TrimSpace(strings.Join(nameParts, " "))
	if name == "" {
		return nil
	}

	return &Holding{
		Name:          name,
		Category:      category,
		Units:         units,
		PricePerUnit:  price,
		PriceCurrency: currency,
		TotalValue:    totalValue,
		ValueCurrency: currency,
		PriceDate:     match[4],
	}
}

// parseAmundiNumber parses "2 454,4500" or "7,2420" to float64
func parseAmundiNumber(s string) float64 {
	s = strings.TrimSpace(s)
	s = strings.ReplaceAll(s, " ", "")
	s = strings.ReplaceAll(s, ",", ".")
	val, err := strconv.ParseFloat(s, 64)
	if err != nil {
		return 0
	}
	return val
}

func significantWords(s string) []string {
	words := strings.Fields(s)
	var result []string
	for _, w := range words {
		w = strings.Trim(w, "()-.,")
		if len(w) > 3 && w != "Fund" && w != "Invest" && w != "UCITS" {
			result = append(result, w)
		}
	}
	return result
}

