---
name: impl
description: Use when writing code — features, fixes, refactors — in the CrabPal monorepo. Enforces minimum viable change, convention-matching, hard rules from CLAUDE.md, and honest validation before claiming "done".
alwaysAllow: ["Bash"]
---

# Impl

## Overview

Keep the change tight. Match the neighbor. Validate before claiming done. Log decisions as you go — not at the end.

## When to Use

- Writing a feature, fix, or refactor
- A `tasks/<issue-id>/plan.md` exists and is accepted
- User says "implement", "build", "fix"

**Do NOT use for:**
- Exploring options → `brainstorming`
- Designing structure → `plan`
- Creating commits → `commit`

## Core Pattern

1. **Read context.** [Root CLAUDE.md](../../../CLAUDE.md) + package `CLAUDE.md` for every package you'll touch.
2. **Find a neighbor.** A similar existing file. Match imports, error style, naming, layout.
3. **Minimum viable change.** Bug fix → no surrounding cleanup. New feature → no helper abstraction until a second caller exists.
4. **Update `tasks/<issue-id>/impl.md` as you work** — not at the end.
5. **Validate with the smallest check that covers the change.**

## Output — always

Maintain `tasks/<issue-id>/impl.md` as a working log. See the [task-artifacts convention](../../../CLAUDE.md#task-artifacts) for `<issue-id>`. Contains: Scope (one line, from `plan.md` if present), Changes (file + why), Decisions (non-obvious choices + rejected alternatives), Validation (commands run + results), Follow-ups (deferred items).

## Hard Rules (from CLAUDE.md)

- Permission modes: `safe`, `ask`, `allow-all` only.
- Source types: `mcp`, `api`, `local` only.
- All secret handling → `packages/shared/src/credentials/`.
- Bundled defaults (`apps/electron/resources/`) fail loud on missing — no TS fallback.
- Never edit `"version"` fields. Use `bun run bump`.
- Never bypass git hooks (`--no-verify`, `--no-gpg-sign`).

## Quick Reference

| Check | When |
|---|---|
| `bun run typecheck:shared` | Change is in shared — fastest useful check |
| `bun run typecheck:all` | Touches multiple packages |
| `bun run lint` | After any non-trivial change |
| `bun test` | Logic changes with tests |
| `bun run validate:dev` | Before commit on anything substantial |
| Manual in Electron | Any UI change — typecheck doesn't catch UX |

## Red Flags — STOP

- Adding comments that narrate *what* (code already says that) — only *why* is worth a comment
- Error handling for impossible internal cases — trust guarantees; validate only at boundaries
- `_unused` renames, `// removed` breadcrumbs, backwards-compat shims → delete cleanly
- Claiming "tested" based on typecheck alone for UI changes → run the app
- `git reset --hard`, `--no-verify` to bypass an obstacle → investigate, don't shortcut
- Scope growing silently → surface it: "this also needs X, Y — in scope?"

## Handoff

Summarize in 1–2 sentences. Don't auto-commit. Report honestly — if you typechecked but didn't run the UI, say so.
