package google_calendar

import (
	"context"
	"encoding/json"
	"log"
	"os"
	"time"

	"lifehub/backend/internal/domain"
	"lifehub/backend/internal/sources"

	"github.com/pocketbase/pocketbase"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
	"google.golang.org/api/calendar/v3"
	"google.golang.org/api/option"
)

var App *pocketbase.PocketBase

func init() {
	sources.Register("google_calendar", func() sources.Source {
		return &GoogleCalendarSource{}
	})
}

type GoogleCalendarSource struct{}

func (s *GoogleCalendarSource) ID() string          { return "google_calendar" }
func (s *GoogleCalendarSource) Name() string        { return "Google Calendar" }
func (s *GoogleCalendarSource) Description() string { return "Display upcoming events from your Google Calendar." }
func (s *GoogleCalendarSource) Icon() string        { return "calendar" }

func (s *GoogleCalendarSource) SupportedOperations() []sources.Operation {
	return []sources.Operation{sources.OpRead}
}

func GetOAuthConfig() *oauth2.Config {
	redirectURL := os.Getenv("GOOGLE_REDIRECT_URL")
	if redirectURL == "" {
		redirectURL = "http://127.0.0.1:8090/api/oauth/google/callback"
	}
	return &oauth2.Config{
		ClientID:     os.Getenv("GOOGLE_CLIENT_ID"),
		ClientSecret: os.Getenv("GOOGLE_CLIENT_SECRET"),
		RedirectURL:  redirectURL,
		Scopes:       []string{calendar.CalendarReadonlyScope},
		Endpoint:     google.Endpoint,
	}
}

func (s *GoogleCalendarSource) FetchTypedData(ctx context.Context, cfg sources.SourceConfig, allowedOps []sources.Operation) (domain.Result, error) {
	log.Printf("GoogleCalendarSource: Fetching data for source %s", cfg.SourceID)

	accessToken, _ := cfg.RawConfig["access_token"].(string)
	refreshToken, _ := cfg.RawConfig["refresh_token"].(string)
	tokenExpiryStr, _ := cfg.RawConfig["token_expiry"].(string)
	tokenType, _ := cfg.RawConfig["token_type"].(string)
	if tokenType == "" {
		tokenType = "Bearer"
	}

	var expiry time.Time
	if tokenExpiryStr != "" {
		expiry, _ = time.Parse(time.RFC3339, tokenExpiryStr)
	}

	tok := &oauth2.Token{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		TokenType:    tokenType,
		Expiry:       expiry,
	}

	oauthCfg := GetOAuthConfig()
	tokenSource := oauthCfg.TokenSource(ctx, tok)

	// Get a (possibly refreshed) token
	newTok, err := tokenSource.Token()
	if err != nil {
		log.Printf("GoogleCalendarSource: Token error: %v", err)
		return domain.Result{}, err
	}

	// If token was refreshed, persist back to PocketBase
	if newTok.AccessToken != tok.AccessToken {
		log.Printf("GoogleCalendarSource: Token was refreshed, persisting")
		persistToken(cfg.SourceID, newTok)
	}

	srv, err := calendar.NewService(ctx, option.WithTokenSource(tokenSource))
	if err != nil {
		log.Printf("GoogleCalendarSource: Failed to create calendar service: %v", err)
		return domain.Result{}, err
	}

	now := time.Now()
	timeMin := now.Format(time.RFC3339)
	timeMax := now.AddDate(0, 0, 7).Format(time.RFC3339)

	events, err := srv.Events.List("primary").
		ShowDeleted(false).
		SingleEvents(true).
		TimeMin(timeMin).
		TimeMax(timeMax).
		MaxResults(50).
		OrderBy("startTime").
		Do()
	if err != nil {
		log.Printf("GoogleCalendarSource: Failed to list events: %v", err)
		return domain.Result{}, err
	}

	results := make([]domain.CalendarEvent, 0, len(events.Items))
	for _, item := range events.Items {
		if item.Status == "cancelled" {
			continue
		}

		ev := domain.CalendarEvent{
			ID:          item.Id,
			Title:       item.Summary,
			Description: item.Description,
			Location:    item.Location,
			MeetLink:    item.HangoutLink,
			Status:      item.Status,
		}

		if item.Start.DateTime != "" {
			ev.Start, _ = time.Parse(time.RFC3339, item.Start.DateTime)
			ev.End, _ = time.Parse(time.RFC3339, item.End.DateTime)
		} else {
			// All-day event
			ev.AllDay = true
			ev.Start, _ = time.Parse("2006-01-02", item.Start.Date)
			ev.End, _ = time.Parse("2006-01-02", item.End.Date)
		}

		results = append(results, ev)
	}

	return domain.Result{
		Type:       domain.TypeCalendar,
		SourceID:   cfg.SourceID,
		SourceName: s.Name(),
		Items:      results,
	}, nil
}

func persistToken(sourceID string, tok *oauth2.Token) {
	if App == nil {
		return
	}

	record, err := App.FindRecordById("sources", sourceID)
	if err != nil {
		log.Printf("GoogleCalendarSource: Failed to find source record %s: %v", sourceID, err)
		return
	}

	configMap, _ := record.Get("config").(map[string]any)
	if configMap == nil {
		configMap = make(map[string]any)
	}

	configMap["access_token"] = tok.AccessToken
	configMap["refresh_token"] = tok.RefreshToken
	configMap["token_expiry"] = tok.Expiry.Format(time.RFC3339)
	configMap["token_type"] = tok.TokenType

	configJSON, err := json.Marshal(configMap)
	if err != nil {
		log.Printf("GoogleCalendarSource: Failed to marshal config: %v", err)
		return
	}
	record.Set("config", string(configJSON))

	if err := App.Save(record); err != nil {
		log.Printf("GoogleCalendarSource: Failed to save token: %v", err)
	}
}
