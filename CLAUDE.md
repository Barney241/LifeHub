# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LifeHub is a centralized "Command Center" that aggregates data from multiple sources (tasks, finances, communications) into workspaces. It displays on desktop, mobile, and e-ink (Inkplate 6) displays.

## Commands

### Backend (Go + PocketBase)
> **The backend API is assumed to already be running at `http://127.0.0.1:8090`.** Do not attempt to start it unless explicitly asked.

Admin UI: http://127.0.0.1:8090/_/

If you do need to restart:
```bash
cd backend && go run main.go serve
```

### Frontend (Next.js)
```bash
cd frontend
npm install        # Install dependencies
npm run dev        # Start dev server at http://localhost:3000
npm run build      # Production build
npm run lint       # Run ESLint
```

### E-Ink Client (MicroPython)
Configure `eink_client/main.py` with WiFi credentials, device token, and backend API URL, then flash to Inkplate 6.

## Demo / Test Account

A seed migration (`backend/pb_migrations/4000000000_demo_seed.js`) creates a fully-populated demo environment. It runs automatically on backend start (idempotent — skips if already applied).

**Credentials:**
```
Email:    test@test.com
Password: testtest
```

**What's pre-seeded:**
| Data | Details |
|---|---|
| Workspace | "Demo Workspace" (CZK display currency) |
| Accounts | KB Běžný účet (50 000 Kč), Spoření (120 000 Kč) |
| Income | Zaměstnání 68 000 Kč/mo + Freelance 12 000 Kč/mo |
| Categories | 10 system categories (Housing, Groceries, Transport…) |
| Merchants | 10 merchants (Albert, Lidl, Spotify, Netflix, Bolt…) |
| Import Rules | 10 rules auto-matching merchants → categories |
| Transactions | ~21 Feb 2026 transactions (income + expenses) |
| Budget Groups | 5 groups: Bydlení, Jídlo, Doprava, Předplatné, Nakupování |
| Budget Items | 9 items, each linked to import rules via match patterns |

**To test the Budget tab specifically:**
1. Log in as `test@test.com` — the Budget tab is pre-populated with real data
2. Select "This month" (Feb 2026) — all overview totals should be non-zero
3. Add a new budget item → pick a rule from the dropdown → see matching transactions preview
4. Verify: amount field shows suggestion but does NOT auto-fill (you must type/click "Use avg")

**To reset demo data:** delete the demo user from PocketBase admin UI at `http://127.0.0.1:8090/_/` — the seed migration will re-run on the next backend restart. Remember: **do not restart the backend unless asked.**

## Architecture

### Three-Tier Structure
- **backend/**: Go server using PocketBase (embedded SQLite, real-time subscriptions, migrations)
- **frontend/**: Next.js 16 + React 19 + TypeScript dashboard with Tailwind CSS
- **eink_client/**: MicroPython client for low-power e-ink displays

### Backend Source System

Sources are plugins that implement `internal/sources/source.go`:
```go
type Source interface {
    ID() string
    Name() string
    Description() string
    Icon() string
    SupportedOperations() []Operation  // OpRead, OpWrite, OpDelete, OpMask
    FetchTypedData(ctx, cfg, allowedOps) (Result, error)
}
```

Sources register themselves via `init()` in the global registry. Current sources: `internal_tasks`, `finance`, `slack`, `debug_source`.

### Domain Models (`backend/internal/domain/models.go`)
- **ItemType**: `task`, `finance`, `communication`
- **Task**: `id`, `content`, `priority`, `due`
- **FinancialRecord**: `id`, `description`, `amount`, `currency`, `is_expense`, `date`
- **Message**: `id`, `sender`, `preview`, `channel`
- **Result**: Polymorphic container with `type`, `source_id`, `source_name`, `items`

### Database Collections (PocketBase)
- **workspaces**: Multi-workspace isolation
- **sources**: Data source configurations per workspace
- **tasks**: Task items with workspace/source scoping
- **finance_transactions**: Financial records
- **devices**: E-ink device registration with granular permissions

### API Endpoints (`backend/main.go`)
- `GET /api/sources/available`: List registered source types
- `GET /api/eink/relevant?token=X&workspace=Y`: Main aggregation endpoint (supports web auth or device tokens)

### Frontend State (`frontend/src/hooks/useLifeHubData.ts`)
Central hook managing PocketBase connection, real-time subscriptions, and CRUD operations. Backend URL hardcoded to `http://127.0.0.1:8090`.

## PocketBase Migrations

Located in `backend/pb_migrations/`. Key patterns:
- Filenames: `TIMESTAMP_name.js` (use high timestamps like `1800...` to run after system migrations)
- Use `collection.fields.add(new TextField({...}))` pattern, not raw field arrays in constructor
- Migrations track in `_migrations` table; renamed file = new migration
- See `MIGRATIONS.md` for full guide

## Key Design Decisions

1. **Operation-Driven Security**: Permissions control what operations (read, mask, delete) are allowed per source/device
2. **Workspace Isolation**: All data scoped to workspaces
3. **Type-Safe Plugin Registry**: Sources implement strict Go interfaces
4. **Real-Time via PocketBase**: WebSocket subscriptions for instant UI updates
