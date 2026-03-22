---
description: Create a pull request for current changes
---
1. Verify all changes are committed — if not, stage and commit them with a descriptive message.
2. Push the current branch: `git push -u origin $(git branch --show-current)`
3. Create PR: `gh pr create --fill`
4. Return the PR URL to the user.
