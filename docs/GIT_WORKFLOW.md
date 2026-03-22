# Git Workflow

## Starting a New Task

```bash
git checkout main
git pull origin main
git checkout -b <type>/<description>
```

Branch name prefixes: `feat/`, `fix/`, `setup/`, `refactor/`, `docs/`

## Making Changes

- Commit frequently with descriptive messages
- Keep commits focused on a single change
- Never commit `.env` or secrets

## Creating a Pull Request

```bash
git push -u origin $(git branch --show-current)
gh pr create --fill
```

## Rules

- **Never commit directly to `main`.** All changes go through pull requests.
- **Start from updated main** before creating a new branch.
- **Keep PRs focused.** One feature or fix per PR.
