# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LifeHub is a centralized "Command Center" that aggregates data from multiple sources (tasks, finances, communications) into workspaces. It displays on desktop, mobile, and e-ink (Inkplate 6) displays.

## Commands

### Backend (Go + PocketBase)
```bash
cd backend
go mod tidy        # Install dependencies
go run main.go serve  # Start server at http://127.0.0.1:8090
```
Admin UI: http://127.0.0.1:8090/_/

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
