# CLAUDE.md

Guidance for Claude Code (claude.ai/code) working on this repository.

## Project Overview

Single-page web app for snake-drafting Dodgers season tickets among 16 participants. Each of ~81 home games has 2 ticket pairs, so each game appears twice in the draft pool (~162 total picks). Backend is Supabase (Postgres + Auth + Realtime).

**Frontend-only app** — vanilla HTML/CSS/JS served by Vite 6, no framework. Uses ES modules.

## Quick Reference

- **Dev server:** `npm run dev` (or `npx vite`)
- **Build:** `npm run build`
- **Commands:** See [docs/COMMANDS.md](docs/COMMANDS.md)
- **Architecture:** See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- **Git workflow:** See [docs/GIT_WORKFLOW.md](docs/GIT_WORKFLOW.md)

Skills (`.claude/commands/`):
- `/run-dev` — Start the development server
- `/create-pr` — Create a pull request for current changes
- `/retro` — Retrospective to identify friction and improve docs/skills

## Documentation Map

```
CLAUDE.md                    <- you are here
AGENTS.md                    # Universal agent instructions
docs/
├── ARCHITECTURE.md          # System design, components, data flow, env vars
├── COMMANDS.md              # Dev, build, deploy, and git commands
└── GIT_WORKFLOW.md          # Branch strategy, PR requirements
.claude/commands/
├── run-dev.md               # Start dev server
├── create-pr.md             # Create PR for current changes
└── retro.md                 # Retrospective skill
```

## Architecture

- `index.html` — All UI markup. Phases shown/hidden via `.active` CSS class.
- `app.js` — All application logic: auth, lobby, schedule, participants, draft engine, realtime sync.
- `supabase.js` — Supabase client init. Reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- `style.css` — Dark theme, Dodger Blue accents, glassmorphism, responsive.
- `db/migrations/001_initial_schema.sql` — Postgres schema with trigger and RLS policies.

## Key Conventions

- Global functions (`joinDraft`, `makePick`) attached to `window` for inline `onclick` handlers.
- Snake draft: even-numbered rounds reverse pick order. `getPickerAtOverall()` is the source of truth.
- Two picks per game enforced by Postgres trigger — do not duplicate in JS.
- Environment variables must be prefixed with `VITE_` for Vite exposure.
- No test framework or linter is configured.

## Critical Rules

- **Never commit directly to `main`.** All changes go through pull requests.
- **Start from updated main:** `git checkout main && git pull origin main` before branching.
- **Never commit `.env` or secrets.**
- **Update documentation** after completing a task if architecture or commands changed.
