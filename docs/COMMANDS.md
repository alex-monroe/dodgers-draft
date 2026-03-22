# Commands

## Development

```bash
npm run dev           # Start Vite dev server (or: npx vite)
npm run build         # Production build to dist/
npm run preview       # Preview production build locally
```

## Dependencies

```bash
npm install           # Install dependencies from package-lock.json
npm install <pkg>     # Add a new dependency
```

## Database

No local Supabase CLI is configured. Migrations are applied manually via Supabase dashboard or SQL editor.

```bash
# Migration files live in:
db/migrations/001_initial_schema.sql
```

## Deployment

Deployed via Vercel (auto-deploys on push). No manual deploy command needed.

## Git

```bash
git checkout main && git pull origin main   # Start from updated main
git checkout -b <type>/<description>        # Create feature branch
git push -u origin <branch>                 # Push and set upstream
gh pr create --fill                         # Create PR
```
