# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Single-page web app for snake-drafting Dodgers season tickets among 16 participants. Each of ~81 home games has 2 ticket pairs, so each game appears twice in the draft pool (~162 total picks). Backend is Supabase (Postgres + Auth + Realtime).

## Development

```bash
npx vite          # Start dev server (no npm script defined; uses Vite directly)
```

No test framework is configured. No linter is configured.

## Architecture

**Frontend-only app** — vanilla HTML/CSS/JS served by Vite, no framework.

- `index.html` — All UI markup. Phases are shown/hidden via `.active` CSS class.
- `app.js` — All application logic: auth, lobby, schedule fetch, participant setup, draft engine, realtime sync. Uses ES module imports.
- `supabase.js` — Supabase client initialization. Reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from environment.
- `style.css` — Dark theme with Dodger Blue accents, glassmorphism, responsive down to tablet.
- `db/migrations/001_initial_schema.sql` — Postgres schema for Supabase: `users`, `drafts`, `draft_participants`, `draft_games`, `draft_picks`. Includes a trigger (`enforce_two_picks_per_game`) limiting each game to 2 picks, and RLS policies allowing any authenticated user full access.

**UI Phases** (sequential flow managed in `app.js`):
1. **Auth** — Supabase email/password sign-in or auto-signup
2. **Lobby** — List/create draft sessions
3. **Schedule** — Fetch Dodgers home schedule from MLB Stats API (`statsapi.mlb.com`), saved to `draft_games`
4. **Participants** — 16 named slots with randomize/reorder, saved to `draft_participants`
5. **Draft Board** — Live snake draft with realtime sync via Supabase Realtime (postgres_changes on `draft_picks`). Supports Cmd+Z undo.

**Snake draft logic**: Even-numbered rounds reverse the pick order. `getPickerAtOverall()` in `app.js` computes which participant picks at any overall pick number.

## Key Conventions

- Global functions (`joinDraft`, `makePick`) are attached to `window` for inline `onclick` handlers in rendered HTML.
- Optimistic UI updates on picks — the pick is added to local state before the Supabase insert resolves, then rolled back on error.
- Environment variables must be prefixed with `VITE_` for Vite to expose them to the client.
