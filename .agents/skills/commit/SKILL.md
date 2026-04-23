---
name: commit
description: Use when creating git commits in this repo — after implementing a change, when the user says "commit", or when staging work before push. Enforces Conventional Commits, CrabPal co-author, heredoc format, and safety rails around version edits and hook bypass.
alwaysAllow: ["Bash"]
---

# Commit

## Overview

One focused commit per logical change. Subject says what, body says why. CrabPal co-authors every commit. Never bypass hooks. Never sweep-stage.

## When to Use

- User says "commit"
- Finishing a unit of work ready to snapshot
- Before a `push` or release-tag step

**Do NOT use for:**
- Amending — only when user explicitly asks
- Pushing — commit only; user decides when to push
- Version bumps — use `bun run bump` (separate commit)

## Core Pattern

1. **Draft the message** into `tasks/<issue-id>/commit.md` first.
2. Run in parallel: `git status` (no `-uall`), `git diff`, `git diff --staged`, `git log --oneline -10`.
3. Pick commit type from the actual diff: `feat` / `fix` / `docs` / `refactor` / `chore` / `test`.
4. **Stage specific files by name.** Never `git add -A` / `git add .`.
5. `git commit` via heredoc with the CrabPal co-author trailer.
6. `git status` to confirm.

## Output — always

Draft the commit message in `tasks/<issue-id>/commit.md` before running `git commit`. See the [task-artifacts convention](../../../CLAUDE.md#task-artifacts) for `<issue-id>`. The file contains exactly the message body that will be passed via heredoc — no surrounding commentary. Overwrite on each new commit for the same task.

## Quick Reference

```bash
git commit -m "$(cat <<'EOF'
fix: subject under 72 chars, imperative

Why this change exists — not what the diff shows.

Co-Authored-By: CrabPal <crabpal-agents@users.noreply.github.com>
EOF
)"
```

| Type | Use for |
|---|---|
| `feat:` | New user-facing capability |
| `fix:` | Bug fix |
| `docs:` | Docs only |
| `refactor:` | Non-behavioral code change |
| `chore:` | Tooling, deps, build, versioning |
| `test:` | Tests only |

## Red Flags — STOP

- `--no-verify` / `--no-gpg-sign` → hook exists for a reason; fix root cause, make a **new** commit
- `--amend` by default → creates confusion; only when user asks
- `git add -A` / `git add .` → can sweep `.env`, credentials, build artefacts
- Manual `"version"` edits in `package.json` → use `bun run bump` (see [CLAUDE.md](../../../CLAUDE.md))
- Message that narrates the diff → say *why*, not *what*
- Trailers referencing current session/task IDs that will rot → skip them

## Pre-Commit Checks

- `packages/shared/package.json` version out of sync with root? → stop; run `bun run bump` as a separate commit first.
- Changes under `apps/electron/resources/`? → bundled defaults; double-check intent.
- Unstaged files that belong here? → ask, don't assume.

## Handoff

Report the commit SHA and one-line summary. Don't push.
