package main

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"time"

	"lifehub/backend/internal/domain"
	"lifehub/backend/internal/services/budget"
	"lifehub/backend/internal/services/categorization"
	"lifehub/backend/internal/services/csvimport"
	"lifehub/backend/internal/services/investments"
	"lifehub/backend/internal/services/recurring"
	"lifehub/backend/internal/sources"
	"lifehub/backend/internal/sources/debug"
	"lifehub/backend/internal/sources/finance"
	"lifehub/backend/internal/sources/google_calendar"
	"lifehub/backend/internal/sources/internal_tasks"
	_ "lifehub/backend/internal/sources/slack"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/plugins/jsvm"
	"github.com/pocketbase/pocketbase/plugins/migratecmd"
	"golang.org/x/oauth2"
)

func main() {
	app := pocketbase.New()

	// Register JSVM plugin
	jsvm.MustRegister(app, jsvm.Config{})

	// Register migratecmd plugin
	migratecmd.MustRegister(app, app.RootCmd, migratecmd.Config{
		Automigrate: true,
	})

	internal_tasks.App = app
	finance.App = app
	debug.App = app
	google_calendar.App = app
	csvimport.App = app
	categorization.App = app
	recurring.App = app
	budget.App = app

	app.OnServe().BindFunc(func(e *core.ServeEvent) error {
		// ============================================
		// Marketplace: List available source types
		// ============================================
		oauthSources := map[string]string{
			"google_calendar": "/api/oauth/google/initiate",
		}

		e.Router.GET("/api/sources/available", func(e *core.RequestEvent) error {
			available := []map[string]string{}
			for _, factory := range sources.Registry {
				s := factory()
				entry := map[string]string{
					"id":          s.ID(),
					"name":        s.Name(),
					"description": s.Description(),
					"icon":        s.Icon(),
				}
				if authURL, ok := oauthSources[s.ID()]; ok {
					entry["auth_type"] = "oauth2"
					entry["auth_url"] = authURL
				}
				available = append(available, entry)
			}
			return e.JSON(http.StatusOK, available)
		})

		// ============================================
		// OAuth2: Google Calendar
		// ============================================
		e.Router.GET("/api/oauth/google/initiate", func(e *core.RequestEvent) error {
			if e.Auth == nil {
				return e.JSON(http.StatusUnauthorized, map[string]string{"error": "Authentication required"})
			}

			workspaceID := e.Request.URL.Query().Get("workspace")
			if workspaceID == "" {
				return e.JSON(http.StatusBadRequest, map[string]string{"error": "workspace required"})
			}

			state := map[string]string{
				"workspace": workspaceID,
				"user_id":   e.Auth.Id,
			}
			stateJSON, _ := json.Marshal(state)
			stateStr := base64.URLEncoding.EncodeToString(stateJSON)

			oauthCfg := google_calendar.GetOAuthConfig()
			url := oauthCfg.AuthCodeURL(stateStr, oauth2.AccessTypeOffline, oauth2.ApprovalForce)

			return e.JSON(http.StatusOK, map[string]string{"url": url})
		})

		e.Router.GET("/api/oauth/google/callback", func(e *core.RequestEvent) error {
			code := e.Request.URL.Query().Get("code")
			stateStr := e.Request.URL.Query().Get("state")

			if code == "" || stateStr == "" {
				return e.JSON(http.StatusBadRequest, map[string]string{"error": "missing code or state"})
			}

			stateJSON, err := base64.URLEncoding.DecodeString(stateStr)
			if err != nil {
				return e.JSON(http.StatusBadRequest, map[string]string{"error": "invalid state"})
			}

			var state map[string]string
			if err := json.Unmarshal(stateJSON, &state); err != nil {
				return e.JSON(http.StatusBadRequest, map[string]string{"error": "invalid state JSON"})
			}

			workspaceID := state["workspace"]
			if workspaceID == "" {
				return e.JSON(http.StatusBadRequest, map[string]string{"error": "missing workspace in state"})
			}

			oauthCfg := google_calendar.GetOAuthConfig()
			tok, err := oauthCfg.Exchange(context.Background(), code)
			if err != nil {
				log.Printf("OAuth exchange error: %v", err)
				return e.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to exchange token"})
			}

			// Fetch user info to get email for the source name
			client := oauthCfg.Client(context.Background(), tok)
			resp, err := client.Get("https://www.googleapis.com/oauth2/v2/userinfo")
			sourceName := "Google Calendar"
			if err == nil {
				defer resp.Body.Close()
				var userInfo struct {
					Email string `json:"email"`
				}
				if json.NewDecoder(resp.Body).Decode(&userInfo) == nil && userInfo.Email != "" {
					sourceName = "Calendar (" + userInfo.Email + ")"
				}
			}

			// Create source record
			collection, err := app.FindCollectionByNameOrId("sources")
			if err != nil {
				return e.JSON(http.StatusInternalServerError, map[string]string{"error": "sources collection not found"})
			}

			record := core.NewRecord(collection)
			record.Set("name", sourceName)
			record.Set("type", "google_calendar")
			record.Set("workspace", workspaceID)
			record.Set("active", true)
			record.Set("config", map[string]any{
				"access_token":  tok.AccessToken,
				"refresh_token": tok.RefreshToken,
				"token_expiry":  tok.Expiry.Format("2006-01-02T15:04:05Z07:00"),
				"token_type":    tok.TokenType,
			})

			if err := app.Save(record); err != nil {
				log.Printf("Failed to save Google Calendar source: %v", err)
				return e.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to save source"})
			}

			frontendURL := os.Getenv("FRONTEND_URL")
			if frontendURL == "" {
				frontendURL = "http://localhost:3000"
			}

			return e.Redirect(http.StatusTemporaryRedirect, frontendURL)
		})

		// ============================================
		// Finance: Accounts
		// ============================================
		e.Router.GET("/api/finance/accounts", func(e *core.RequestEvent) error {
			workspaceID := e.Request.URL.Query().Get("workspace")
			if workspaceID == "" {
				return e.JSON(http.StatusBadRequest, map[string]string{"error": "workspace required"})
			}

			filter := "workspace = '" + workspaceID + "'"
			records, err := app.FindRecordsByFilter("finance_accounts", filter, "name", 100, 0)
			if err != nil {
				return e.JSON(http.StatusOK, []map[string]any{})
			}

			accounts := []map[string]any{}
			for _, r := range records {
				// Calculate current balance
				balance := r.GetFloat("initial_balance")
				txFilter := "account = '" + r.Id + "'"
				txs, _ := app.FindRecordsByFilter("finance_transactions", txFilter, "", 0, 0)
				for _, tx := range txs {
					if tx.GetString("type") == "expense" {
						balance -= tx.GetFloat("amount")
					} else {
						balance += tx.GetFloat("amount")
					}
				}

				accounts = append(accounts, map[string]any{
					"id":              r.Id,
					"name":            r.GetString("name"),
					"bank_name":       r.GetString("bank_name"),
					"account_number":  r.GetString("account_number"),
					"currency":        r.GetString("currency"),
					"account_type":    r.GetString("account_type"),
					"icon":            r.GetString("icon"),
					"color":           r.GetString("color"),
					"initial_balance": r.GetFloat("initial_balance"),
					"current_balance": balance,
					"is_active":       r.GetBool("is_active"),
				})
			}

			return e.JSON(http.StatusOK, accounts)
		})

		e.Router.POST("/api/finance/accounts", func(e *core.RequestEvent) error {
			var body map[string]any
			if err := json.NewDecoder(e.Request.Body).Decode(&body); err != nil {
				return e.JSON(http.StatusBadRequest, map[string]string{"error": "invalid JSON"})
			}

			collection, err := app.FindCollectionByNameOrId("finance_accounts")
			if err != nil {
				return e.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
			}

			record := core.NewRecord(collection)
			for k, v := range body {
				record.Set(k, v)
			}

			if err := app.Save(record); err != nil {
				return e.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
			}

			return e.JSON(http.StatusOK, map[string]string{"id": record.Id})
		})

		// ============================================
		// Finance: Categories
		// ============================================
		e.Router.GET("/api/finance/categories", func(e *core.RequestEvent) error {
			workspaceID := e.Request.URL.Query().Get("workspace")
			if workspaceID == "" {
				return e.JSON(http.StatusBadRequest, map[string]string{"error": "workspace required"})
			}

			filter := "workspace = '" + workspaceID + "'"
			records, err := app.FindRecordsByFilter("finance_categories", filter, "name", 100, 0)
			if err != nil {
				return e.JSON(http.StatusOK, []map[string]any{})
			}

			categories := []map[string]any{}
			for _, r := range records {
				categories = append(categories, map[string]any{
					"id":        r.Id,
					"name":      r.GetString("name"),
					"icon":      r.GetString("icon"),
					"color":     r.GetString("color"),
					"parent_id": r.GetString("parent"),
					"is_system": r.GetBool("is_system"),
				})
			}

			return e.JSON(http.StatusOK, categories)
		})

		e.Router.POST("/api/finance/categories", func(e *core.RequestEvent) error {
			var body map[string]any
			if err := json.NewDecoder(e.Request.Body).Decode(&body); err != nil {
				return e.JSON(http.StatusBadRequest, map[string]string{"error": "invalid JSON"})
			}

			collection, err := app.FindCollectionByNameOrId("finance_categories")
			if err != nil {
				return e.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
			}

			record := core.NewRecord(collection)
			for k, v := range body {
				record.Set(k, v)
			}

			if err := app.Save(record); err != nil {
				return e.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
			}

			return e.JSON(http.StatusOK, map[string]string{"id": record.Id})
		})

		// ============================================
		// Finance: Merchants
		// ============================================
		e.Router.GET("/api/finance/merchants", func(e *core.RequestEvent) error {
			workspaceID := e.Request.URL.Query().Get("workspace")
			if workspaceID == "" {
				return e.JSON(http.StatusBadRequest, map[string]string{"error": "workspace required"})
			}

			filter := "workspace = '" + workspaceID + "'"
			records, err := app.FindRecordsByFilter("finance_merchants", filter, "name", 200, 0)
			if err != nil {
				return e.JSON(http.StatusOK, []map[string]any{})
			}

			merchants := []map[string]any{}
			for _, r := range records {
				merchants = append(merchants, map[string]any{
					"id":              r.Id,
					"name":            r.GetString("name"),
					"display_name":    r.GetString("display_name"),
					"patterns":        r.Get("patterns"),
					"category_id":     r.GetString("category"),
					"is_subscription": r.GetBool("is_subscription"),
				})
			}

			return e.JSON(http.StatusOK, merchants)
		})

		// ============================================
		// Finance: Bank Templates
		// ============================================
		e.Router.GET("/api/finance/templates", func(e *core.RequestEvent) error {
			templates := csvimport.GetTemplates()
			result := []map[string]any{}
			for code, t := range templates {
				result = append(result, map[string]any{
					"code": code,
					"name": t.Name,
				})
			}
			return e.JSON(http.StatusOK, result)
		})

		// ============================================
		// Finance: Import Preview
		// ============================================
		e.Router.POST("/api/finance/import/preview", func(e *core.RequestEvent) error {
			file, _, err := e.Request.FormFile("file")
			if err != nil {
				return e.JSON(http.StatusBadRequest, map[string]string{"error": "file required"})
			}
			defer file.Close()

			data, err := io.ReadAll(file)
			if err != nil {
				return e.JSON(http.StatusBadRequest, map[string]string{"error": "failed to read file"})
			}

			// Detect or get template
			templateCode := e.Request.FormValue("template")
			if templateCode == "" {
				templateCode = csvimport.DetectTemplate(data)
			}

			templates := csvimport.GetTemplates()
			template, ok := templates[templateCode]
			if !ok {
				template = templates["generic"]
			}

			result, err := csvimport.ParseCSV(data, template)
			if err != nil {
				return e.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
			}

			result.DetectedTemplate = templateCode
			return e.JSON(http.StatusOK, result)
		})

		// ============================================
		// Finance: Import Execute
		// ============================================
		e.Router.POST("/api/finance/import", func(e *core.RequestEvent) error {
			file, _, err := e.Request.FormFile("file")
			if err != nil {
				return e.JSON(http.StatusBadRequest, map[string]string{"error": "file required"})
			}
			defer file.Close()

			accountID := e.Request.FormValue("account")
			workspaceID := e.Request.FormValue("workspace")
			sourceID := e.Request.FormValue("source")
			templateCode := e.Request.FormValue("template")

			if accountID == "" || workspaceID == "" {
				return e.JSON(http.StatusBadRequest, map[string]string{"error": "account and workspace required"})
			}

			data, err := io.ReadAll(file)
			if err != nil {
				return e.JSON(http.StatusBadRequest, map[string]string{"error": "failed to read file"})
			}

			if templateCode == "" {
				templateCode = csvimport.DetectTemplate(data)
			}

			templates := csvimport.GetTemplates()
			template, ok := templates[templateCode]
			if !ok {
				template = templates["generic"]
			}

			// Parse CSV
			parseResult, err := csvimport.ParseCSV(data, template)
			if err != nil {
				return e.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
			}

			// Category resolver using template mapping
			categoryResolver := func(bankCategory string) string {
				return categorization.MapBankCategory(workspaceID, bankCategory, template.CategoryMapping)
			}

			// Import transactions
			result, err := csvimport.ImportTransactions(
				parseResult.Transactions,
				accountID,
				workspaceID,
				sourceID,
				categoryResolver,
			)
			if err != nil {
				return e.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
			}

			return e.JSON(http.StatusOK, result)
		})

		// ============================================
		// Finance: Categorization Suggestions
		// ============================================
		e.Router.GET("/api/finance/categorize/suggestions", func(e *core.RequestEvent) error {
			workspaceID := e.Request.URL.Query().Get("workspace")
			accountID := e.Request.URL.Query().Get("account")

			if workspaceID == "" {
				return e.JSON(http.StatusBadRequest, map[string]string{"error": "workspace required"})
			}

			suggestions, err := categorization.GetSuggestions(workspaceID, accountID)
			if err != nil {
				return e.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
			}

			return e.JSON(http.StatusOK, suggestions)
		})

		e.Router.POST("/api/finance/categorize/bulk", func(e *core.RequestEvent) error {
			var body struct {
				TransactionIDs []string `json:"transaction_ids"`
				CategoryID     string   `json:"category_id"`
				MerchantID     string   `json:"merchant_id"`
				CreateRule     bool     `json:"create_rule"`
				Pattern        string   `json:"pattern"`
				WorkspaceID    string   `json:"workspace_id"`
			}

			if err := json.NewDecoder(e.Request.Body).Decode(&body); err != nil {
				return e.JSON(http.StatusBadRequest, map[string]string{"error": "invalid JSON"})
			}

			err := categorization.ApplyBulkCategorization(body.TransactionIDs, body.CategoryID, body.MerchantID)
			if err != nil {
				return e.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
			}

			// Optionally create rule
			if body.CreateRule && body.Pattern != "" && body.WorkspaceID != "" {
				_ = categorization.CreateRuleFromCorrection(body.WorkspaceID, body.Pattern, body.CategoryID, body.MerchantID)
			}

			return e.JSON(http.StatusOK, map[string]string{"status": "ok", "updated": string(rune(len(body.TransactionIDs)))})
		})

		// ============================================
		// Finance: Re-categorize All (based on bank category)
		// ============================================
		e.Router.POST("/api/finance/categorize/recategorize-all", func(e *core.RequestEvent) error {
			workspaceID := e.Request.URL.Query().Get("workspace")
			if workspaceID == "" {
				return e.JSON(http.StatusBadRequest, map[string]string{"error": "workspace required"})
			}

			// Get CSOB template for category mapping
			template := csvimport.CSOBTemplate()

			// Get all transactions with bank category but no internal category
			filter := "workspace = '" + workspaceID + "' && category != '' && category_rel = ''"
			records, err := app.FindRecordsByFilter("finance_transactions", filter, "", 0, 0)
			if err != nil {
				return e.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
			}

			updated := 0
			for _, r := range records {
				bankCat := r.GetString("category")
				catID := categorization.MapBankCategory(workspaceID, bankCat, template.CategoryMapping)
				if catID != "" {
					r.Set("category_rel", catID)
					if err := app.Save(r); err == nil {
						updated++
					}
				}
			}

			return e.JSON(http.StatusOK, map[string]any{
				"status":  "ok",
				"checked": len(records),
				"updated": updated,
			})
		})

		// ============================================
		// Finance: Apply Rules to Transactions
		// ============================================
		e.Router.POST("/api/finance/categorize/apply-rules", func(e *core.RequestEvent) error {
			workspaceID := e.Request.URL.Query().Get("workspace")
			if workspaceID == "" {
				return e.JSON(http.StatusBadRequest, map[string]string{"error": "workspace required"})
			}

			// Check for override parameter
			overrideExisting := e.Request.URL.Query().Get("override") == "true"

			checked, updated, err := categorization.ApplyRulesToTransactions(workspaceID, overrideExisting)
			if err != nil {
				return e.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
			}

			return e.JSON(http.StatusOK, map[string]any{
				"status":  "ok",
				"checked": checked,
				"updated": updated,
			})
		})

		// ============================================
		// Finance: Recurring Payments
		// ============================================
		e.Router.GET("/api/finance/recurring", func(e *core.RequestEvent) error {
			workspaceID := e.Request.URL.Query().Get("workspace")
			if workspaceID == "" {
				return e.JSON(http.StatusBadRequest, map[string]string{"error": "workspace required"})
			}

			filter := "workspace = '" + workspaceID + "'"
			records, err := app.FindRecordsByFilter("finance_recurring", filter, "next_due", 100, 0)
			if err != nil {
				return e.JSON(http.StatusOK, []map[string]any{})
			}

			items := []map[string]any{}
			for _, r := range records {
				// Get merchant name
				merchantName := ""
				if merchantID := r.GetString("merchant"); merchantID != "" {
					if merchant, err := app.FindRecordById("finance_merchants", merchantID); err == nil {
						merchantName = merchant.GetString("display_name")
						if merchantName == "" {
							merchantName = merchant.GetString("name")
						}
					}
				}

				items = append(items, map[string]any{
					"id":              r.Id,
					"merchant_id":     r.GetString("merchant"),
					"merchant_name":   merchantName,
					"expected_amount": r.GetFloat("expected_amount"),
					"frequency":       r.GetString("frequency"),
					"next_due":        r.GetDateTime("next_due").Time(),
					"last_paid":       r.GetDateTime("last_paid").Time(),
					"status":          r.GetString("status"),
				})
			}

			return e.JSON(http.StatusOK, items)
		})

		e.Router.POST("/api/finance/recurring/detect", func(e *core.RequestEvent) error {
			workspaceID := e.Request.URL.Query().Get("workspace")
			accountID := e.Request.URL.Query().Get("account")

			if workspaceID == "" {
				return e.JSON(http.StatusBadRequest, map[string]string{"error": "workspace required"})
			}

			results, err := recurring.DetectRecurring(workspaceID, accountID, 3)
			if err != nil {
				return e.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
			}

			return e.JSON(http.StatusOK, results)
		})

		e.Router.GET("/api/finance/recurring/upcoming", func(e *core.RequestEvent) error {
			workspaceID := e.Request.URL.Query().Get("workspace")
			if workspaceID == "" {
				return e.JSON(http.StatusBadRequest, map[string]string{"error": "workspace required"})
			}

			upcoming, err := recurring.GetUpcomingPayments(workspaceID, 14) // Next 2 weeks
			if err != nil {
				return e.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
			}

			return e.JSON(http.StatusOK, upcoming)
		})

		// ============================================
		// Finance: Statistics
		// ============================================
		e.Router.GET("/api/finance/stats", func(e *core.RequestEvent) error {
			workspaceID := e.Request.URL.Query().Get("workspace")
			accountID := e.Request.URL.Query().Get("account")
			categoryID := e.Request.URL.Query().Get("category")
			startDate := e.Request.URL.Query().Get("start_date")
			endDate := e.Request.URL.Query().Get("end_date")

			if workspaceID == "" {
				return e.JSON(http.StatusBadRequest, map[string]string{"error": "workspace required"})
			}

			filter := "workspace = '" + workspaceID + "'"
			if accountID != "" {
				filter += " && account = '" + accountID + "'"
			}
			if categoryID == "__uncategorized" {
				// Find the "Uncategorized" category ID to include both empty and explicit
				uncatID := ""
				cats, _ := app.FindRecordsByFilter("finance_categories", "workspace = '"+workspaceID+"' && name = 'Uncategorized'", "", 1, 0)
				if len(cats) > 0 {
					uncatID = cats[0].Id
				}
				if uncatID != "" {
					filter += " && (category_rel = '' || category_rel = '" + uncatID + "')"
				} else {
					filter += " && category_rel = ''"
				}
			} else if categoryID != "" {
				filter += " && category_rel = '" + categoryID + "'"
			}

			// Add date filter
			if startDate != "" && endDate != "" {
				filter += " && date >= '" + startDate + "' && date <= '" + endDate + "'"
			} else if startDate != "" {
				filter += " && date >= '" + startDate + "'"
			} else if endDate != "" {
				filter += " && date <= '" + endDate + "'"
			}

			records, err := app.FindRecordsByFilter("finance_transactions", filter, "-date", 0, 0)
			if err != nil {
				records = []*core.Record{}
			}

			var totalIncome, totalExpenses float64
			byCategory := make(map[string]float64)

			// Cache category names
			categoryNames := make(map[string]string)
			catRecords, _ := app.FindRecordsByFilter("finance_categories", "workspace = '"+workspaceID+"'", "", 0, 0)
			for _, c := range catRecords {
				categoryNames[c.Id] = c.GetString("name")
			}

			for _, r := range records {
				amount := r.GetFloat("amount")
				if r.GetString("type") == "expense" {
					totalExpenses += amount
				} else {
					totalIncome += amount
				}

				// Category aggregation using category_rel (internal category)
				catID := r.GetString("category_rel")
				catName := "Uncategorized"
				if catID != "" {
					if name, ok := categoryNames[catID]; ok {
						catName = name
					}
				}
				if r.GetString("type") == "expense" {
					byCategory[catName] += amount
				}
			}

			// Get account balances
			var accountBalances []map[string]any
			accountRecords, _ := app.FindRecordsByFilter("finance_accounts", "workspace = '"+workspaceID+"'", "name", 0, 0)
			for _, acc := range accountRecords {
				balance := acc.GetFloat("initial_balance")
				txFilter := "account = '" + acc.Id + "'"
				txs, _ := app.FindRecordsByFilter("finance_transactions", txFilter, "", 0, 0)
				for _, tx := range txs {
					if tx.GetString("type") == "expense" {
						balance -= tx.GetFloat("amount")
					} else {
						balance += tx.GetFloat("amount")
					}
				}
				accountBalances = append(accountBalances, map[string]any{
					"account_id":   acc.Id,
					"account_name": acc.GetString("name"),
					"balance":      balance,
					"currency":     acc.GetString("currency"),
				})
			}

			// Count recurring
			recurringFilter := "workspace = '" + workspaceID + "' && status = 'active'"
			recurringRecords, _ := app.FindRecordsByFilter("finance_recurring", recurringFilter, "", 0, 0)
			var recurringTotal float64
			for _, r := range recurringRecords {
				recurringTotal += r.GetFloat("expected_amount")
			}

			stats := map[string]any{
				"total_income":     totalIncome,
				"total_expenses":   totalExpenses,
				"net_balance":      totalIncome - totalExpenses,
				"by_category":      byCategory,
				"recurring_total":  recurringTotal,
				"recurring_count":  len(recurringRecords),
				"account_balances": accountBalances,
			}

			return e.JSON(http.StatusOK, stats)
		})

		// ============================================
		// Finance: Income Sources
		// ============================================
		e.Router.GET("/api/finance/income-sources", func(e *core.RequestEvent) error {
			workspaceID := e.Request.URL.Query().Get("workspace")
			if workspaceID == "" {
				return e.JSON(http.StatusBadRequest, map[string]string{"error": "workspace required"})
			}

			filter := "workspace = '" + workspaceID + "'"
			records, err := app.FindRecordsByFilter("finance_income_sources", filter, "name", 100, 0)
			if err != nil {
				return e.JSON(http.StatusOK, []map[string]any{})
			}

			items := []map[string]any{}
			for _, r := range records {
				items = append(items, map[string]any{
					"id":            r.Id,
					"name":          r.GetString("name"),
					"income_type":   r.GetString("income_type"),
					"amount":        r.GetFloat("amount"),
					"currency":      r.GetString("currency"),
					"default_hours": r.GetFloat("default_hours"),
					"is_active":     r.GetBool("is_active"),
					"notes":         r.GetString("notes"),
				})
			}
			return e.JSON(http.StatusOK, items)
		})

		e.Router.POST("/api/finance/income-sources", func(e *core.RequestEvent) error {
			var body map[string]any
			if err := json.NewDecoder(e.Request.Body).Decode(&body); err != nil {
				return e.JSON(http.StatusBadRequest, map[string]string{"error": "invalid JSON"})
			}
			collection, err := app.FindCollectionByNameOrId("finance_income_sources")
			if err != nil {
				return e.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
			}
			record := core.NewRecord(collection)
			for k, v := range body {
				record.Set(k, v)
			}
			if err := app.Save(record); err != nil {
				return e.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
			}
			return e.JSON(http.StatusOK, map[string]string{"id": record.Id})
		})

		e.Router.PUT("/api/finance/income-sources/{id}", func(e *core.RequestEvent) error {
			id := e.Request.PathValue("id")
			record, err := app.FindRecordById("finance_income_sources", id)
			if err != nil {
				return e.JSON(http.StatusNotFound, map[string]string{"error": "not found"})
			}
			var body map[string]any
			if err := json.NewDecoder(e.Request.Body).Decode(&body); err != nil {
				return e.JSON(http.StatusBadRequest, map[string]string{"error": "invalid JSON"})
			}
			for k, v := range body {
				record.Set(k, v)
			}
			if err := app.Save(record); err != nil {
				return e.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
			}
			return e.JSON(http.StatusOK, map[string]string{"status": "ok"})
		})

		e.Router.DELETE("/api/finance/income-sources/{id}", func(e *core.RequestEvent) error {
			id := e.Request.PathValue("id")
			record, err := app.FindRecordById("finance_income_sources", id)
			if err != nil {
				return e.JSON(http.StatusNotFound, map[string]string{"error": "not found"})
			}
			if err := app.Delete(record); err != nil {
				return e.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
			}
			return e.JSON(http.StatusOK, map[string]string{"status": "ok"})
		})

		// ============================================
		// Finance: Income Hours
		// ============================================
		e.Router.GET("/api/finance/income-hours", func(e *core.RequestEvent) error {
			workspaceID := e.Request.URL.Query().Get("workspace")
			year := e.Request.URL.Query().Get("year")
			month := e.Request.URL.Query().Get("month")

			if workspaceID == "" {
				return e.JSON(http.StatusBadRequest, map[string]string{"error": "workspace required"})
			}

			filter := "workspace = '" + workspaceID + "'"
			if year != "" {
				filter += " && year = " + year
			}
			if month != "" {
				filter += " && month = " + month
			}

			records, err := app.FindRecordsByFilter("finance_income_hours", filter, "", 100, 0)
			if err != nil {
				return e.JSON(http.StatusOK, []map[string]any{})
			}

			items := []map[string]any{}
			for _, r := range records {
				items = append(items, map[string]any{
					"id":            r.Id,
					"income_source": r.GetString("income_source"),
					"year":          int(r.GetFloat("year")),
					"month":         int(r.GetFloat("month")),
					"hours":         r.GetFloat("hours"),
				})
			}
			return e.JSON(http.StatusOK, items)
		})

		e.Router.PUT("/api/finance/income-hours", func(e *core.RequestEvent) error {
			var body struct {
				IncomeSource string  `json:"income_source"`
				Year         int     `json:"year"`
				Month        int     `json:"month"`
				Hours        float64 `json:"hours"`
				Workspace    string  `json:"workspace"`
			}
			if err := json.NewDecoder(e.Request.Body).Decode(&body); err != nil {
				return e.JSON(http.StatusBadRequest, map[string]string{"error": "invalid JSON"})
			}

			// Upsert: find existing or create new
			filter := fmt.Sprintf("workspace = '%s' && income_source = '%s' && year = %d && month = %d",
				body.Workspace, body.IncomeSource, body.Year, body.Month)
			existing, _ := app.FindRecordsByFilter("finance_income_hours", filter, "", 1, 0)

			if len(existing) > 0 {
				existing[0].Set("hours", body.Hours)
				if err := app.Save(existing[0]); err != nil {
					return e.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
				}
				return e.JSON(http.StatusOK, map[string]string{"id": existing[0].Id, "status": "updated"})
			}

			collection, err := app.FindCollectionByNameOrId("finance_income_hours")
			if err != nil {
				return e.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
			}
			record := core.NewRecord(collection)
			record.Set("income_source", body.IncomeSource)
			record.Set("year", body.Year)
			record.Set("month", body.Month)
			record.Set("hours", body.Hours)
			record.Set("workspace", body.Workspace)
			if err := app.Save(record); err != nil {
				return e.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
			}
			return e.JSON(http.StatusOK, map[string]string{"id": record.Id, "status": "created"})
		})

		// ============================================
		// Finance: Budgets
		// ============================================
		e.Router.GET("/api/finance/budgets", func(e *core.RequestEvent) error {
			workspaceID := e.Request.URL.Query().Get("workspace")
			if workspaceID == "" {
				return e.JSON(http.StatusBadRequest, map[string]string{"error": "workspace required"})
			}

			filter := "workspace = '" + workspaceID + "'"
			records, err := app.FindRecordsByFilter("finance_budgets", filter, "sort_order", 100, 0)
			if err != nil {
				return e.JSON(http.StatusOK, []map[string]any{})
			}

			budgets := []map[string]any{}
			for _, r := range records {
				b := map[string]any{
					"id":         r.Id,
					"name":       r.GetString("name"),
					"icon":       r.GetString("icon"),
					"color":      r.GetString("color"),
					"sort_order": int(r.GetFloat("sort_order")),
					"is_active":  r.GetBool("is_active"),
				}

				// Load items
				itemFilter := "budget = '" + r.Id + "' && workspace = '" + workspaceID + "'"
				itemRecords, err := app.FindRecordsByFilter("finance_budget_items", itemFilter, "sort_order", 100, 0)
				if err == nil {
					items := []map[string]any{}
					for _, ir := range itemRecords {
						items = append(items, map[string]any{
							"id":                 ir.Id,
							"budget_id":           ir.GetString("budget"),
							"name":               ir.GetString("name"),
							"budgeted_amount":    ir.GetFloat("budgeted_amount"),
							"currency":           ir.GetString("currency"),
							"frequency":          ir.GetString("frequency"),
							"match_pattern":      ir.GetString("match_pattern"),
							"match_pattern_type": ir.GetString("match_pattern_type"),
							"match_field":        ir.GetString("match_field"),
							"match_category_id":  ir.GetString("match_category"),
							"match_merchant_id":  ir.GetString("match_merchant"),
							"match_account_id":   ir.GetString("match_account"),
							"is_expense":         ir.GetBool("is_expense"),
							"sort_order":         int(ir.GetFloat("sort_order")),
							"is_active":          ir.GetBool("is_active"),
							"notes":              ir.GetString("notes"),
						})
					}
					b["items"] = items
				}

				budgets = append(budgets, b)
			}
			return e.JSON(http.StatusOK, budgets)
		})

		e.Router.POST("/api/finance/budgets", func(e *core.RequestEvent) error {
			var body map[string]any
			if err := json.NewDecoder(e.Request.Body).Decode(&body); err != nil {
				return e.JSON(http.StatusBadRequest, map[string]string{"error": "invalid JSON"})
			}
			collection, err := app.FindCollectionByNameOrId("finance_budgets")
			if err != nil {
				return e.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
			}
			record := core.NewRecord(collection)
			for k, v := range body {
				record.Set(k, v)
			}
			if err := app.Save(record); err != nil {
				return e.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
			}
			return e.JSON(http.StatusOK, map[string]string{"id": record.Id})
		})

		e.Router.PUT("/api/finance/budgets/{id}", func(e *core.RequestEvent) error {
			id := e.Request.PathValue("id")
			record, err := app.FindRecordById("finance_budgets", id)
			if err != nil {
				return e.JSON(http.StatusNotFound, map[string]string{"error": "not found"})
			}
			var body map[string]any
			if err := json.NewDecoder(e.Request.Body).Decode(&body); err != nil {
				return e.JSON(http.StatusBadRequest, map[string]string{"error": "invalid JSON"})
			}
			for k, v := range body {
				record.Set(k, v)
			}
			if err := app.Save(record); err != nil {
				return e.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
			}
			return e.JSON(http.StatusOK, map[string]string{"status": "ok"})
		})

		e.Router.DELETE("/api/finance/budgets/{id}", func(e *core.RequestEvent) error {
			id := e.Request.PathValue("id")

			// Cascade delete items
			itemFilter := "budget = '" + id + "'"
			items, _ := app.FindRecordsByFilter("finance_budget_items", itemFilter, "", 0, 0)
			for _, item := range items {
				app.Delete(item)
			}

			record, err := app.FindRecordById("finance_budgets", id)
			if err != nil {
				return e.JSON(http.StatusNotFound, map[string]string{"error": "not found"})
			}
			if err := app.Delete(record); err != nil {
				return e.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
			}
			return e.JSON(http.StatusOK, map[string]string{"status": "ok"})
		})

		// ============================================
		// Finance: Budget Items
		// ============================================
		e.Router.POST("/api/finance/budget-items", func(e *core.RequestEvent) error {
			var body map[string]any
			if err := json.NewDecoder(e.Request.Body).Decode(&body); err != nil {
				return e.JSON(http.StatusBadRequest, map[string]string{"error": "invalid JSON"})
			}
			collection, err := app.FindCollectionByNameOrId("finance_budget_items")
			if err != nil {
				return e.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
			}
			record := core.NewRecord(collection)
			for k, v := range body {
				record.Set(k, v)
			}
			if err := app.Save(record); err != nil {
				return e.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
			}
			return e.JSON(http.StatusOK, map[string]string{"id": record.Id})
		})

		e.Router.PUT("/api/finance/budget-items/{id}", func(e *core.RequestEvent) error {
			id := e.Request.PathValue("id")
			record, err := app.FindRecordById("finance_budget_items", id)
			if err != nil {
				return e.JSON(http.StatusNotFound, map[string]string{"error": "not found"})
			}
			var body map[string]any
			if err := json.NewDecoder(e.Request.Body).Decode(&body); err != nil {
				return e.JSON(http.StatusBadRequest, map[string]string{"error": "invalid JSON"})
			}
			for k, v := range body {
				record.Set(k, v)
			}
			if err := app.Save(record); err != nil {
				return e.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
			}
			return e.JSON(http.StatusOK, map[string]string{"status": "ok"})
		})

		e.Router.DELETE("/api/finance/budget-items/{id}", func(e *core.RequestEvent) error {
			id := e.Request.PathValue("id")
			record, err := app.FindRecordById("finance_budget_items", id)
			if err != nil {
				return e.JSON(http.StatusNotFound, map[string]string{"error": "not found"})
			}
			if err := app.Delete(record); err != nil {
				return e.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
			}
			return e.JSON(http.StatusOK, map[string]string{"status": "ok"})
		})

		// ============================================
		// Finance: Budget Status (computed summary)
		// ============================================
		e.Router.GET("/api/finance/budget/status", func(e *core.RequestEvent) error {
			workspaceID := e.Request.URL.Query().Get("workspace")
			startDateStr := e.Request.URL.Query().Get("start_date")
			endDateStr := e.Request.URL.Query().Get("end_date")

			if workspaceID == "" || startDateStr == "" || endDateStr == "" {
				return e.JSON(http.StatusBadRequest, map[string]string{"error": "workspace, start_date, and end_date required"})
			}

			startDate, err := time.Parse("2006-01-02", startDateStr)
			if err != nil {
				return e.JSON(http.StatusBadRequest, map[string]string{"error": "invalid start_date format"})
			}
			endDate, err := time.Parse("2006-01-02", endDateStr)
			if err != nil {
				return e.JSON(http.StatusBadRequest, map[string]string{"error": "invalid end_date format"})
			}

			summary, err := budget.ComputeStatus(workspaceID, startDate, endDate)
			if err != nil {
				return e.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
			}

			return e.JSON(http.StatusOK, summary)
		})

		// ============================================
		// Investments: Import PDF
		// ============================================
		e.Router.POST("/api/investments/import", func(e *core.RequestEvent) error {
			file, _, err := e.Request.FormFile("file")
			if err != nil {
				return e.JSON(http.StatusBadRequest, map[string]string{"error": "file required"})
			}
			defer file.Close()

			workspaceID := e.Request.FormValue("workspace")
			provider := e.Request.FormValue("provider")
			password := e.Request.FormValue("password")

			if workspaceID == "" || provider == "" {
				return e.JSON(http.StatusBadRequest, map[string]string{"error": "workspace and provider required"})
			}
			validProviders := map[string]bool{"fondee": true, "amundi": true, "revolut-stocks": true, "revolut-crypto": true}
			if !validProviders[provider] {
				return e.JSON(http.StatusBadRequest, map[string]string{"error": "provider must be one of: fondee, amundi, revolut-stocks, revolut-crypto"})
			}

			// Read uploaded file
			data, err := io.ReadAll(file)
			if err != nil {
				return e.JSON(http.StatusBadRequest, map[string]string{"error": "failed to read file"})
			}

			// Parse based on provider
			var snapshot *investments.PortfolioSnapshot
			isCSVProvider := provider == "revolut-stocks" || provider == "revolut-crypto"

			if isCSVProvider {
				// CSV-based providers (Revolut)
				switch provider {
				case "revolut-stocks":
					snapshot, err = investments.ParseRevolutStocks(data)
				case "revolut-crypto":
					snapshot, err = investments.ParseRevolutCrypto(data)
				}
				if err != nil {
					return e.JSON(http.StatusBadRequest, map[string]string{"error": "failed to parse CSV: " + err.Error()})
				}
			} else {
				// PDF-based providers (Fondee, Amundi)
				tmpDir, err := os.MkdirTemp("", "investment-import-*")
				if err != nil {
					return e.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to create temp dir"})
				}
				defer os.RemoveAll(tmpDir)

				pdfPath := filepath.Join(tmpDir, "upload.pdf")
				if err := os.WriteFile(pdfPath, data, 0600); err != nil {
					return e.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to save file"})
				}

				// Decrypt if password provided
				if password != "" {
					decryptedPath := filepath.Join(tmpDir, "decrypted.pdf")
					cmd := exec.Command("qpdf", "--password="+password, "--decrypt", pdfPath, decryptedPath)
					if out, err := cmd.CombinedOutput(); err != nil {
						log.Printf("qpdf decrypt failed: %s", string(out))
						return e.JSON(http.StatusBadRequest, map[string]string{"error": "failed to decrypt PDF"})
					}
					pdfPath = decryptedPath
				}

				// Extract text with pdftotext
				cmd := exec.Command("pdftotext", "-layout", pdfPath, "-")
				textBytes, err := cmd.Output()
				if err != nil {
					return e.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to extract text from PDF"})
				}
				text := string(textBytes)

				switch provider {
				case "fondee":
					snapshot, err = investments.ParseFondee(text)
				case "amundi":
					snapshot, err = investments.ParseAmundi(text)
				}
				if err != nil {
					return e.JSON(http.StatusBadRequest, map[string]string{"error": "failed to parse PDF: " + err.Error()})
				}
			}

			// Validate parsed data based on provider
			var validationErrors []string
			if snapshot.ReportDate.IsZero() {
				validationErrors = append(validationErrors, "report date not found")
			}

			switch provider {
			case "fondee":
				if snapshot.EndValue == 0 {
					validationErrors = append(validationErrors, "end value not found or zero")
				}
				if snapshot.PortfolioName == "" {
					validationErrors = append(validationErrors, "portfolio name not found")
				}
				if snapshot.PeriodStart.IsZero() || snapshot.PeriodEnd.IsZero() {
					validationErrors = append(validationErrors, "period dates not found")
				}
				if snapshot.StartValue == 0 {
					validationErrors = append(validationErrors, "start value not found or zero")
				}
			case "amundi":
				if snapshot.EndValue == 0 {
					validationErrors = append(validationErrors, "end value not found or zero")
				}
				if snapshot.ContractID == "" {
					validationErrors = append(validationErrors, "contract ID not found")
				}
				if snapshot.Invested == 0 {
					validationErrors = append(validationErrors, "invested amount not found or zero")
				}
				if len(snapshot.Holdings) == 0 {
					validationErrors = append(validationErrors, "no holdings found")
				}
				for i, h := range snapshot.Holdings {
					if h.Name == "" {
						validationErrors = append(validationErrors, fmt.Sprintf("holding %d: name missing", i+1))
					}
					if h.TotalValue == 0 {
						validationErrors = append(validationErrors, fmt.Sprintf("holding %d (%s): total value is zero", i+1, h.Name))
					}
				}
			case "revolut-stocks", "revolut-crypto":
				if len(snapshot.Holdings) == 0 {
					validationErrors = append(validationErrors, "no holdings found")
				}
			}

			if len(validationErrors) > 0 {
				return e.JSON(http.StatusBadRequest, map[string]any{
					"error":             "parsed data validation failed",
					"validation_errors": validationErrors,
					"partial_snapshot":  snapshot,
				})
			}

			// Find or create portfolio
			portfolioFilter := "provider = '" + provider + "' && workspace = '" + workspaceID + "'"
			if snapshot.PortfolioName != "" {
				portfolioFilter += " && name = '" + snapshot.PortfolioName + "'"
			}

			var portfolioID string
			existing, err := app.FindRecordsByFilter("investment_portfolios", portfolioFilter, "", 1, 0)
			if err == nil && len(existing) > 0 {
				portfolioID = existing[0].Id
			} else {
				portfolioCol, err := app.FindCollectionByNameOrId("investment_portfolios")
				if err != nil {
					return e.JSON(http.StatusInternalServerError, map[string]string{"error": "investment_portfolios collection not found"})
				}
				portfolioRec := core.NewRecord(portfolioCol)
				portfolioRec.Set("provider", provider)
				portfolioRec.Set("name", snapshot.PortfolioName)
				portfolioRec.Set("contract_id", snapshot.ContractID)
				portfolioRec.Set("currency", snapshot.Currency)
				portfolioRec.Set("workspace", workspaceID)
				if err := app.Save(portfolioRec); err != nil {
					return e.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to create portfolio: " + err.Error()})
				}
				portfolioID = portfolioRec.Id
			}

			// Check for duplicate snapshot (same portfolio + report_date)
			reportDateStr := snapshot.ReportDate.Format("2006-01-02 15:04:05.000Z")
			dupeFilter := "portfolio = '" + portfolioID + "' && report_date = '" + reportDateStr + "'"
			dupes, _ := app.FindRecordsByFilter("investment_snapshots", dupeFilter, "", 1, 0)
			if len(dupes) > 0 {
				return e.JSON(http.StatusConflict, map[string]any{
					"error":        "duplicate snapshot",
					"message":      "A snapshot for this portfolio with report date " + snapshot.ReportDate.Format("2006-01-02") + " already exists",
					"snapshot_id":  dupes[0].Id,
					"portfolio_id": portfolioID,
				})
			}

			// Create snapshot
			snapshotCol, err := app.FindCollectionByNameOrId("investment_snapshots")
			if err != nil {
				return e.JSON(http.StatusInternalServerError, map[string]string{"error": "investment_snapshots collection not found"})
			}
			snapshotRec := core.NewRecord(snapshotCol)
			snapshotRec.Set("portfolio", portfolioID)
			snapshotRec.Set("report_date", snapshot.ReportDate)
			snapshotRec.Set("period_start", snapshot.PeriodStart)
			snapshotRec.Set("period_end", snapshot.PeriodEnd)
			snapshotRec.Set("start_value", snapshot.StartValue)
			snapshotRec.Set("end_value", snapshot.EndValue)
			snapshotRec.Set("invested", snapshot.Invested)
			snapshotRec.Set("gain_loss", snapshot.GainLoss)
			snapshotRec.Set("fees", snapshot.Fees)
			snapshotRec.Set("workspace", workspaceID)

			if err := app.Save(snapshotRec); err != nil {
				return e.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to create snapshot: " + err.Error()})
			}

			// Create holdings (Amundi has individual fund holdings)
			if len(snapshot.Holdings) > 0 {
				holdingCol, err := app.FindCollectionByNameOrId("investment_holdings")
				if err != nil {
					return e.JSON(http.StatusInternalServerError, map[string]string{"error": "investment_holdings collection not found"})
				}
				for _, h := range snapshot.Holdings {
					holdingRec := core.NewRecord(holdingCol)
					holdingRec.Set("snapshot", snapshotRec.Id)
					holdingRec.Set("name", h.Name)
					holdingRec.Set("isin", h.ISIN)
					holdingRec.Set("category", h.Category)
					holdingRec.Set("units", h.Units)
					holdingRec.Set("price_per_unit", h.PricePerUnit)
					holdingRec.Set("price_currency", h.PriceCurrency)
					holdingRec.Set("total_value", h.TotalValue)
					holdingRec.Set("value_currency", h.ValueCurrency)
					holdingRec.Set("workspace", workspaceID)
					if err := app.Save(holdingRec); err != nil {
						log.Printf("Failed to save holding %s: %v", h.Name, err)
					}
				}
			}

			return e.JSON(http.StatusOK, map[string]any{
				"status":       "ok",
				"portfolio_id": portfolioID,
				"snapshot_id":  snapshotRec.Id,
				"snapshot":     snapshot,
			})
		})

		// ============================================
		// Investments: List Portfolios
		// ============================================
		e.Router.GET("/api/investments/portfolios", func(e *core.RequestEvent) error {
			workspaceID := e.Request.URL.Query().Get("workspace")
			if workspaceID == "" {
				return e.JSON(http.StatusBadRequest, map[string]string{"error": "workspace required"})
			}

			filter := "workspace = '" + workspaceID + "'"
			records, err := app.FindRecordsByFilter("investment_portfolios", filter, "name", 100, 0)
			if err != nil {
				return e.JSON(http.StatusOK, []map[string]any{})
			}

			result := []map[string]any{}
			for _, r := range records {
				portfolio := map[string]any{
					"id":          r.Id,
					"provider":    r.GetString("provider"),
					"name":        r.GetString("name"),
					"contract_id": r.GetString("contract_id"),
					"currency":    r.GetString("currency"),
				}

				// Get latest snapshot
				snapshotFilter := "portfolio = '" + r.Id + "'"
				snapshots, err := app.FindRecordsByFilter("investment_snapshots", snapshotFilter, "-report_date", 1, 0)
				if err == nil && len(snapshots) > 0 {
					s := snapshots[0]
					portfolio["latest_snapshot"] = map[string]any{
						"id":           s.Id,
						"report_date":  s.GetDateTime("report_date").Time(),
						"period_start": s.GetDateTime("period_start").Time(),
						"period_end":   s.GetDateTime("period_end").Time(),
						"start_value":  s.GetFloat("start_value"),
						"end_value":    s.GetFloat("end_value"),
						"invested":     s.GetFloat("invested"),
						"gain_loss":    s.GetFloat("gain_loss"),
						"fees":         s.GetFloat("fees"),
					}
				}

				result = append(result, portfolio)
			}

			return e.JSON(http.StatusOK, result)
		})

		// ============================================
		// Investments: Snapshot History
		// ============================================
		e.Router.GET("/api/investments/snapshots", func(e *core.RequestEvent) error {
			portfolioID := e.Request.URL.Query().Get("portfolio")
			if portfolioID == "" {
				return e.JSON(http.StatusBadRequest, map[string]string{"error": "portfolio required"})
			}

			filter := "portfolio = '" + portfolioID + "'"
			records, err := app.FindRecordsByFilter("investment_snapshots", filter, "-report_date", 100, 0)
			if err != nil {
				return e.JSON(http.StatusOK, []map[string]any{})
			}

			result := []map[string]any{}
			for _, r := range records {
				snap := map[string]any{
					"id":           r.Id,
					"report_date":  r.GetDateTime("report_date").Time(),
					"period_start": r.GetDateTime("period_start").Time(),
					"period_end":   r.GetDateTime("period_end").Time(),
					"start_value":  r.GetFloat("start_value"),
					"end_value":    r.GetFloat("end_value"),
					"invested":     r.GetFloat("invested"),
					"gain_loss":    r.GetFloat("gain_loss"),
					"fees":         r.GetFloat("fees"),
				}

				// Include holdings
				holdingsFilter := "snapshot = '" + r.Id + "'"
				holdingRecords, err := app.FindRecordsByFilter("investment_holdings", holdingsFilter, "name", 100, 0)
				if err == nil && len(holdingRecords) > 0 {
					holdings := []map[string]any{}
					for _, h := range holdingRecords {
						holdings = append(holdings, map[string]any{
							"id":             h.Id,
							"name":           h.GetString("name"),
							"isin":           h.GetString("isin"),
							"category":       h.GetString("category"),
							"units":          h.GetFloat("units"),
							"price_per_unit": h.GetFloat("price_per_unit"),
							"price_currency": h.GetString("price_currency"),
							"total_value":    h.GetFloat("total_value"),
							"value_currency": h.GetString("value_currency"),
						})
					}
					snap["holdings"] = holdings
				}

				result = append(result, snap)
			}

			return e.JSON(http.StatusOK, result)
		})

		// ============================================
		// E-Ink & Web Aggregation Endpoint (existing)
		// ============================================
		e.Router.GET("/api/eink/relevant", func(e *core.RequestEvent) error {
			token := e.Request.URL.Query().Get("token")
			workspaceID := e.Request.URL.Query().Get("workspace")

			var allowedWorkspaces []string
			var permsMap map[string]any

			// 1. Try Authenticating via User Session (Web Dashboard)
			if e.Auth != nil {
				if workspaceID != "" {
					allowedWorkspaces = []string{workspaceID}
				} else {
					records, _ := app.FindRecordsByFilter("workspaces", "", "name", 0, 0)
					for _, r := range records {
						allowedWorkspaces = append(allowedWorkspaces, r.Id)
					}
				}
				permsMap = map[string]any{}
			} else if token != "" {
				device, err := app.FindRecordById("devices", token)
				if err != nil {
					device, err = app.FindFirstRecordByData("devices", "token", token)
					if err != nil {
						return e.JSON(http.StatusUnauthorized, map[string]string{"error": "Invalid device token"})
					}
				}
				allowedWorkspaces = device.GetStringSlice("allowed_workspaces")
				permissions := device.Get("permissions")
				permsMap, _ = permissions.(map[string]any)

				device.Set("last_active", "now")
				app.Save(device)
			} else {
				return e.JSON(http.StatusUnauthorized, map[string]string{"error": "Authentication required"})
			}

			if len(allowedWorkspaces) == 0 {
				return e.JSON(http.StatusOK, map[string]any{"status": "ok", "data": []domain.Result{}})
			}

			workspaceFilter := ""
			for i, id := range allowedWorkspaces {
				workspaceFilter += "workspace = '" + id + "'"
				if i < len(allowedWorkspaces)-1 {
					workspaceFilter += " || "
				}
			}

			records, err := app.FindRecordsByFilter("sources", "(active = true) && ("+workspaceFilter+")", "name", 0, 0)
			if err != nil {
				log.Printf("Error fetching sources: %v", err)
				return err
			}

			log.Printf("Found %d active sources for workspaces %v", len(records), allowedWorkspaces)

			allData := []domain.Result{}
			for _, record := range records {
				sourceType := record.GetString("type")
				log.Printf("Processing source: %s (type: %s)", record.GetString("name"), sourceType)

				allowedOps := []sources.Operation{sources.OpRead, sources.OpMask} // Default for web

				if perms, ok := permsMap[sourceType].(map[string]any); ok {
					if enabled, exists := perms["enabled"].(bool); exists && !enabled {
						continue
					}
					allowedOps = []sources.Operation{}
					if canRead, _ := perms["can_read"].(bool); canRead {
						allowedOps = append(allowedOps, sources.OpRead)
					}
					if showFinance, _ := perms["show_finance_amounts"].(bool); showFinance {
						allowedOps = append(allowedOps, sources.OpMask)
					}
				}

				configMap, _ := record.Get("config").(map[string]any)
				typedCfg := sources.SourceConfig{
					SourceID:    record.Id,
					WorkspaceID: record.GetString("workspace"),
					RawConfig:   configMap,
				}

				if factory, ok := sources.Registry[sourceType]; ok {
					sourceImpl := factory()
					payload, err := sourceImpl.FetchTypedData(context.Background(), typedCfg, allowedOps)
					if err == nil {
						// Override the default source name with the custom name from DB
						payload.SourceName = record.GetString("name")
						allData = append(allData, payload)
					}
				}
			}

			return e.JSON(http.StatusOK, map[string]any{
				"status": "ok",
				"data":   allData,
			})
		})

		return e.Next()
	})

	if err := app.Start(); err != nil {
		log.Fatal(err)
	}
}
