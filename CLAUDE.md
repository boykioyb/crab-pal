# CLAUDE.md — CrabPal monorepo

## Purpose
CrabPal is an agent-native desktop workspace (Electron + React) running two first-class agent backends (Claude Agent SDK and Pi SDK). This is a community fork of Craft Agents. Full user-facing overview lives in [README.md](README.md).

## Layout
```
apps/
  cli/        Terminal client for the headless server
  electron/   Desktop GUI — primary interface (main / preload / renderer)
  viewer/     Shared session viewer
  webui/      Browser-based UI
packages/
  core/                 @crabpal/core — shared types (dependency-light)
  shared/               @crabpal/shared — agent, auth, sources, sessions, credentials
  server/               @crabpal/server — headless server entrypoint
  server-core/          server composition / runtime glue
  pi-agent-server/      Pi SDK agent subprocess
  session-mcp-server/   Bundled MCP server for session tools
  session-tools-core/   Session-scoped tool implementations
  ui/                   @crabpal/ui — shared React components
```
Package-level context: [packages/core/CLAUDE.md](packages/core/CLAUDE.md), [packages/shared/CLAUDE.md](packages/shared/CLAUDE.md). Bundled-resources notes: [apps/electron/resources/AGENTS.md](apps/electron/resources/AGENTS.md). Read the relevant package CLAUDE.md before editing that package.

## Commands
```bash
bun install
bun run electron:dev        # hot-reload dev
bun run electron:start      # build + run once
bun run typecheck:all       # whole-monorepo typecheck
bun run typecheck:shared    # shared only (fastest useful check)
bun run lint                # ipc-sends + electron + shared + ui
bun run validate:dev        # typecheck:all + shared tests + doc-tool tests
bun test                    # unit tests
```

## Versioning — single source of truth
Root `package.json` is the canonical version. All workspace `package.json` files MUST match.

```bash
bun run bump              # sync all workspaces to root version
bun run bump patch        # bump root + sync (0.0.5 → 0.0.6)
bun run bump minor|major
bun run bump 1.2.3        # set directly
```

`bump` also creates `apps/electron/resources/release-notes/<version>.md` as a stub if missing. The **About** screen reads version from `@crabpal/shared` (via `getAppVersion()` in [packages/shared/src/version/index.ts](packages/shared/src/version/index.ts)) and **What's New** reads the newest file in the release-notes directory — both stay in sync only if every bump goes through `bun run bump`. Never edit version fields by hand.

## Task artifacts
Every skill run (`brainstorming`, `plan`, `impl`, `commit`, `release`) writes one markdown file into `tasks/<issue-id>/`:

```
tasks/
  <issue-id>/
    brainstorm.md   # from brainstorming skill
    plan.md         # from plan skill
    impl.md         # from impl skill (working log)
    commit.md       # draft of the next commit message
    release.md      # for release tasks only
```

### Resolving `<issue-id>`
Use the first that applies:
1. **GitHub issue/PR number** — parse from the current branch (`fix/42-oauth` → `42`, `42-oauth` → `42`) or from user input (`#42`).
2. **Release version** — for release tasks, the target tag without the `v` prefix (e.g. `0.0.6`).
3. **Kebab slug** — if no issue exists, derive from the task title (`sync workspace versions` → `sync-workspace-versions`).
4. **Ask** the user when ambiguous.

### Lifecycle
- Files are **committed** — they are the durable record of why a change was made.
- A task folder persists after the change ships; don't delete after merge.
- The `impl` / `commit` skills may overwrite their own file on the same task. `brainstorm.md` appends.
- Skills cross-read: `plan` may read `brainstorm.md`; `impl` may read `plan.md`; `commit` may reference `impl.md` decisions.

## Hard rules
- **Permission modes** are fixed: `safe`, `ask`, `allow-all`. Don't invent new ones.
- **Source types** are fixed: `mcp`, `api`, `local`.
- **Credentials** only flow through `packages/shared/src/credentials/`. No ad-hoc secret storage.
- **User-facing tool contracts** stay backward-compatible where possible.
- **Bundled defaults** under `apps/electron/resources/` are the source of truth — no TypeScript fallback. Missing files must fail loud.
- **Don't edit `package.json` versions manually** — use `bun run bump`.
- **Don't skip git hooks** (`--no-verify`, `--no-gpg-sign`) unless the user explicitly asks.

## Build & release notes
- Electron packaging uses `apps/electron/package.json` version (electron-builder convention). Keeping it in sync with root is handled by `bun run bump`.
- Release notes live at `apps/electron/resources/release-notes/<version>.md`. What's New picks the newest file by semver.
- Auto-update hits GitHub Releases — URLs in `packages/shared/src/branding.ts`.

## Notes & gotchas
- Claude SDK subprocess env strips Bedrock routing vars (`CLAUDE_CODE_USE_BEDROCK`, `AWS_BEARER_TOKEN_BEDROCK`, `ANTHROPIC_BEDROCK_BASE_URL`). Pi Bedrock uses its own AWS env path.
- Session lifecycle separates **hard aborts** (`UserStop`, redirect fallback) from **UI handoff interrupts** (`AuthRequest`, `PlanSubmitted`) — don't conflate them.
- WebUI source OAuth uses a stable relay redirect URI (`https://crabpal.app/auth/callback`); the deployment-specific target is carried in a relay-owned outer `state` envelope.
- Automations matching goes through canonical adapters in `packages/shared/src/automations/utils.ts` (`matcherMatches*`). Don't check primitive matchers ad hoc.
- Some root scripts reference files that don't exist yet in this fork (`scripts/release.ts`, `scripts/build.ts`, `scripts/check-version.ts`, `scripts/oss-sync.ts`) — drop-ins inherited from upstream. Fix by adding the script or removing the entry; don't chase it during unrelated work.

## Git
Commits are co-authored with CrabPal:
```
Co-Authored-By: CrabPal <crabpal-agents@users.noreply.github.com>
```
PR base is `main`. Default branch has husky hooks — don't bypass.
