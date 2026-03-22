# AGENTS.md

Universal instructions for AI coding agents working on this repository.

## Project Overview

Single-page web app for snake-drafting Dodgers season tickets among 16 participants. Each of ~81 home games has 2 ticket pairs, so each game appears twice in the draft pool (~162 total picks). Backend is Supabase (Postgres + Auth + Realtime).

**Tech stack:** Vanilla HTML/CSS/JS, Vite 6, Supabase (`@supabase/supabase-js ^2.99.3`)
**Package manager:** npm (uses `package-lock.json`)
**Runtime:** Browser only — no server-side code

## Quick Reference

- **Commands:** See [docs/COMMANDS.md](docs/COMMANDS.md) for all CLI commands
- **Architecture:** See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for system design and data flow
- **Git workflow:** See [docs/GIT_WORKFLOW.md](docs/GIT_WORKFLOW.md) for branch and PR requirements

## Documentation Map

```
AGENTS.md                    <- you are here
CLAUDE.md                    # Claude Code specific instructions
docs/
├── ARCHITECTURE.md          # System design, components, data flow, env vars
├── COMMANDS.md              # Dev, build, deploy, and git commands
└── GIT_WORKFLOW.md          # Branch strategy, PR requirements
```

## Commands

```bash
npm run dev                  # Start Vite dev server
npm run build                # Production build to dist/
npm run preview              # Preview production build
```

No test framework or linter is configured.

## Code Style

- **Vanilla JS with ES modules** — no framework, no TypeScript
- Global functions (`joinDraft`, `makePick`) are attached to `window` for inline `onclick` handlers
- UI phases are shown/hidden via `.active` CSS class on section elements
- Environment variables must be prefixed with `VITE_` for Vite to expose them

## Architectural Rules

- **All application logic lives in `app.js`** — do not split into multiple JS modules without discussion
- **Supabase client is initialized in `supabase.js`** — import from there, never create a second client
- **Two picks per game enforced by Postgres trigger** — do not duplicate this constraint in JS
- **Realtime sync via Supabase `postgres_changes`** — all connected clients receive pick updates live
- **Snake draft order** — even-numbered rounds reverse pick order; `getPickerAtOverall()` is the source of truth

## Database Schema

Tables: `users`, `drafts`, `draft_participants`, `draft_games`, `draft_picks`

Schema defined in `db/migrations/001_initial_schema.sql`. RLS policies allow any authenticated user full access.

## Critical Rules

- **Never commit directly to `main`.** All changes go through pull requests.
- **Always create a PR.** Every task must end with a PR.
- **Start from updated main:** `git checkout main && git pull origin main` before branching.
- **Never commit `.env` or secrets.**
- **Update documentation** after completing a task if architecture or commands changed.
