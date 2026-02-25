package investments

import "time"

// PortfolioSnapshot represents the overall state of a portfolio at a point in time
type PortfolioSnapshot struct {
	Provider      string    `json:"provider"`       // "fondee", "amundi"
	PortfolioName string    `json:"portfolio_name"`  // e.g. "Vyvážený", "Risk je zisk", "Fondy"
	ContractID    string    `json:"contract_id"`     // contract/account number
	Currency      string    `json:"currency"`        // reference currency (CZK)
	ReportDate    time.Time `json:"report_date"`     // date of the snapshot
	PeriodStart   time.Time `json:"period_start"`
	PeriodEnd     time.Time `json:"period_end"`
	StartValue    float64   `json:"start_value"`     // value at period start
	EndValue      float64   `json:"end_value"`       // value at period end
	Invested      float64   `json:"invested"`        // total invested amount
	GainLoss      float64   `json:"gain_loss"`       // unrealized gain/loss
	Fees          float64   `json:"fees"`            // fees for the period
	Holdings      []Holding `json:"holdings"`        // individual fund holdings (used for Amundi)
}

// Holding represents a single fund/ETF position
type Holding struct {
	Name       string  `json:"name"`
	ISIN       string  `json:"isin"`
	Category   string  `json:"category"`    // e.g. "Akciový fond", "Smíšený fond"
	Units      float64 `json:"units"`
	PricePerUnit float64 `json:"price_per_unit"`
	PriceCurrency string `json:"price_currency"` // currency of the price
	TotalValue float64 `json:"total_value"`
	ValueCurrency string `json:"value_currency"` // currency of total value
	PriceDate  string  `json:"price_date"`
}
