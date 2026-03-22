# Architecture

## Tech Stack

- **Frontend:** Vanilla HTML/CSS/JS (no framework), ES modules
- **Build tool:** Vite 6 (`vite ^6.0.0`)
- **Backend:** Supabase (Postgres + Auth + Realtime)
- **Client SDK:** `@supabase/supabase-js ^2.99.3`
- **External API:** MLB Stats API (`statsapi.mlb.com`) for Dodgers schedule data
- **Deployment:** Vercel (static site)

## System Design

```
┌──────────────┐     ┌──────────────────┐     ┌──────────────┐
│   Browser    │────▶│  Vite Dev/Build   │     │  MLB Stats   │
│  (SPA)       │     │  (static serve)   │     │  API         │
└──────┬───────┘     └──────────────────┘     └──────┬───────┘
       │                                             │
       │  Supabase JS SDK                            │ fetch()
       │  (Auth, REST, Realtime WebSocket)           │
       ▼                                             ▼
┌──────────────────────────────────────────────────────────────┐
│                        Supabase                              │
│  ┌──────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │   Auth   │  │   Postgres   │  │  Realtime (WebSocket)  │ │
│  │          │  │              │  │  postgres_changes on   │ │
│  │  email/  │  │  users       │  │  draft_picks table     │ │
│  │  password │  │  drafts      │  │                        │ │
│  │          │  │  draft_*     │  │                        │ │
│  └──────────┘  └──────────────┘  └────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

## Source Files

| File | Purpose |
|------|---------|
| `index.html` | All UI markup. Phases shown/hidden via `.active` CSS class |
| `app.js` | All application logic: auth, lobby, schedule, participants, draft engine, realtime sync |
| `supabase.js` | Supabase client init. Reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` |
| `style.css` | Dark theme, Dodger Blue accents, glassmorphism, responsive |
| `db/migrations/001_initial_schema.sql` | Postgres schema: `users`, `drafts`, `draft_participants`, `draft_games`, `draft_picks` |

## UI Phases

The app is a single page with 5 sequential phases. Only one phase is visible at a time (controlled by `.active` class):

1. **Auth** — Supabase email/password sign-in or auto-signup
2. **Lobby** — List/create draft sessions
3. **Schedule** — Fetch Dodgers home schedule from MLB Stats API, saved to `draft_games`
4. **Participants** — 16 named slots with randomize/reorder, saved to `draft_participants`
5. **Draft Board** — Live snake draft with realtime sync. Supports Cmd+Z undo.

## Key Design Decisions

- **No framework:** Intentionally vanilla JS to keep the app simple and dependency-light.
- **Snake draft:** Even-numbered rounds reverse pick order. `getPickerAtOverall()` computes which participant picks at any overall pick number.
- **Two picks per game:** Each of ~81 home games appears twice in the draft pool (~162 total picks). Enforced by a Postgres trigger (`enforce_two_picks_per_game`).
- **Realtime sync:** Supabase Realtime subscribes to `postgres_changes` on `draft_picks` so all connected clients see picks live.
- **Admin-only auth:** Only admin users can authenticate. Anonymous visitors get read-only access.
- **RLS policies:** Any authenticated user has full access via Row Level Security policies.

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase publishable anon key |

Both must be prefixed with `VITE_` for Vite to expose them to the client. Stored in `.env` (git-ignored).
