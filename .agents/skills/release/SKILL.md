---
name: release
description: Use when shipping a new CrabPal version — user says "cut a release", "bump and tag", or it's time to push a new GitHub Release. Runs the bump + notes + tag + push pipeline with the single source-of-truth rule.
alwaysAllow: ["Bash"]
---

# Release

## Overview

Root `package.json` is the single source of truth for versions. `bun run bump` syncs every workspace + creates a release-notes stub. You write the notes, validate, commit, tag, then push only with explicit user confirmation.

## When to Use

- User says "release", "cut vX.Y.Z", "ship"
- A batch of changes is ready for GitHub Releases auto-update to pick up

**Do NOT use for:**
- Regular commits → `commit`
- In-progress bumps without release intent — just run `bun run bump` directly

## Prereqs

1. Working tree clean (`git status`) — otherwise stop and ask.
2. On `main` (or release branch) — otherwise ask before switching.
3. Up to date with `origin/main` — `git pull --ff-only` if not.

## Core Pattern

1. **Decide the bump.** `patch` / `minor` / `major` / explicit `X.Y.Z`.
2. **Bump:** `bun run bump <kind>` — syncs all workspace `package.json` files + creates `apps/electron/resources/release-notes/<version>.md` stub.
3. **Write release notes.** Replace the `_Release notes pending._` stub. Match tone of prior files in the directory.
4. **Validate:** `bun run typecheck:all` + `bun run lint`. Any failure → stop, fix, resume.
5. **Commit** via `commit` skill: `chore: release vX.Y.Z`.
6. **Tag:** `git tag -a vX.Y.Z -m "vX.Y.Z"`.
7. **Push — only with user confirmation:** `git push origin main && git push origin vX.Y.Z`.

## Output — always

Log to `tasks/<issue-id>/release.md`. For releases, `<issue-id>` is the version without `v` prefix (e.g. `0.0.6`). See the [task-artifacts convention](../../../CLAUDE.md#task-artifacts). Capture: target version, each step PASS/FAIL with one-liner, tag + SHA + push confirmation, any deviations from the standard workflow.

## Quick Reference

| Kind | Example | Use for |
|---|---|---|
| `patch` | 0.0.5 → 0.0.6 | Bug fixes, internal cleanup |
| `minor` | 0.0.5 → 0.1.0 | New user-facing feature |
| `major` | 0.0.5 → 1.0.0 | Breaking change |
| `X.Y.Z` | explicit | Rare — set directly |

Cross-checks after bump:
- **About** reads version via `getAppVersion()` from `@crabpal/shared`.
- **What's New** picks the newest file in `apps/electron/resources/release-notes/` by semver.
- If these disagree post-release, the bump script was bypassed somewhere.

## Red Flags — STOP

- Editing `"version"` fields by hand → forbidden by [CLAUDE.md](../../../CLAUDE.md); use `bun run bump`
- Pushing without user confirmation → tags trigger auto-update; point of no return
- Force-pushing or deleting a published tag → consumed by auto-update; cut a follow-up patch instead
- Skipping `typecheck:all` / `lint` because "it's just a version bump" → the release goes to users
- Leaving the `_Release notes pending._` stub → What's New will display it verbatim

## Rollback

Something wrong after tag push? Cut a follow-up `patch` that fixes it. Do **not** delete or force-push the tag unless the user explicitly approves.

## Handoff

Report tag name, commit SHA, GitHub Releases URL. Verify the release workflow actually built installers before telling the user "done".
