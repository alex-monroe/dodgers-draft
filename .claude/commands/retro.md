---
description: Retrospective — identify friction points, propose doc/skill improvements
---
Review the current conversation for:

1. **Agent errors or backtracking** — places where the wrong approach was tried first
2. **User corrections** — anything the user had to manually fix or redirect
3. **Missing documentation** — info that would have prevented confusion
4. **Missing skills** — repetitive workflows that should be automated
5. **Approval gates** — permission prompts that could be pre-authorized

Present findings as a table:

| # | Type | Description | Proposed Fix |
|---|------|-------------|--------------|

Then ask the user which fixes to implement. For approved changes:
- Update docs/ files or CLAUDE.md/AGENTS.md as needed
- Create new skills in `.claude/commands/` if warranted
- Commit and create a PR with the improvements
