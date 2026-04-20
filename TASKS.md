# CrabPal Rewrite Tasks

Last updated: 2026-04-16

## Locked Decisions

- [x] Product name: `CrabPal`
- [x] Bundle id: `com.boykioyb.crabpal`
- [x] Protocol scheme: `crabpal://`
- [x] Config root: `~/.crabpal`
- [x] Package scope: `@crabpal`
- [x] Domain direction: prioritize `.app`

## Completed

### Phase 1: Rebrand and Compliance Baseline

- [x] Rebrand core app identity from Craft Agents to CrabPal
- [x] Replace package scope from `@craft-agent/*` to `@crabpal/*`
- [x] Update Electron app name, bundle metadata, installer metadata, and product strings
- [x] Change deep link handling to `crabpal://`
- [x] Change default config root to `~/.crabpal`
- [x] Rebrand CLI/server naming to `crabpal` and `crabpal-server`
- [x] Update bundled docs and wrapper binaries to CrabPal names
- [x] Refresh `NOTICE` and keep required upstream attribution in place
- [x] Replace primary app icons/assets with new CrabPal assets
- [x] Clean broad runtime/docs/test branding surface from current Craft product naming

### Phase 2: Storage and Migration

- [x] Add one-time legacy import from `~/.craft-agent` to `~/.crabpal`
- [x] Add import marker file so migration does not re-run indefinitely
- [x] Prevent legacy import from overwriting an existing CrabPal config root
- [x] Rewrite imported legacy paths so default workspace/config paths point to `~/.crabpal`
- [x] Align core runtime path consumers to shared `CONFIG_DIR`
- [x] Move workspace storage helpers to shared `CONFIG_DIR`
- [x] Move secure credential file path to shared `CONFIG_DIR`
- [x] Move window-state path to shared `CONFIG_DIR`
- [x] Move interceptor/config/log path handling to shared `CONFIG_DIR`
- [x] Add integration test coverage for legacy config import behavior

### Phase 3: UI Baseline Rewrite

- [x] Replace the old top bar framing with a new CrabPal header baseline
- [x] Restyle the left sidebar shell into a distinct CrabPal rail/card
- [x] Restyle navigator/container framing so the shell no longer reads like the original app
- [x] Update primary shell copy from old labels toward CrabPal language
- [x] Refresh onboarding frame/background/card styling
- [x] Rewrite welcome-step copy to match CrabPal positioning
- [x] Refresh session list search bar styling
- [x] Refresh session row visual language
- [x] Refresh entity group headers / collapsible list headers
- [x] Refresh panel header styling

## In Progress

- [x] Continue Phase 3 by rewriting settings information architecture and settings navigation
- [x] Continue Phase 3 by rewriting main chat/content surfaces so the center pane no longer preserves the old visual grammar

## Pending

### Product and UX

- [ ] Redesign settings pages, preferences flows, and settings subpage hierarchy
- [ ] Redesign session detail/chat surface beyond shell-level framing
- [ ] Redesign sources pages and source detail flows to match CrabPal visual language
- [ ] Redesign skills pages and detail flows
- [ ] Redesign automations list/detail views beyond shell-level framing
- [ ] Revisit browser panel UX and browser-related empty states
- [ ] Revisit empty states, illustrations, and success/error surfaces across the app
- [ ] Replace remaining legacy-looking component patterns in renderer subviews

### Branding and Content Cleanup

- [ ] Finish scanning for non-attribution `Craft` references outside intentional compatibility/historical areas
- [ ] Revisit release notes/history content strategy for CrabPal distribution
- [ ] Revisit public docs/help URLs and marketing-facing links once final domain is live
- [ ] Revisit `craft-agents-docs` / `craftdocs:` compatibility identifiers and decide whether to keep or rename them later

### Technical Cleanup

- [ ] Audit remaining runtime uses of hardcoded `~/.crabpal` paths and decide which should use shared `CONFIG_DIR` dynamically
- [x] Retire legacy `CRAFT_*` env fallbacks
- [ ] Add/expand renderer tests around the new shell layout where valuable
- [ ] Rebuild any platform-specific generated assets that still depend on missing local tooling

### Release Readiness

- [ ] Run broader test pass beyond current targeted validation
- [ ] Add compliance scan/release gate for old brand strings in distributable output
- [ ] Verify packaged builds for Electron targets after the rewrite stabilizes
- [ ] Prepare migration/release notes for first CrabPal release

## Validation Completed

- [x] `bun run typecheck:all`
- [x] `bun test packages/shared/src/config/__tests__/legacy-config-import.test.ts`
- [x] `bun test packages/shared/src/config/__tests__/storage-startup-migration.test.ts`
- [x] `bun test packages/shared/src/agent/__tests__/permissions-config-craft-cli-flag.test.ts`

## Known Gaps / Notes

- [ ] UI rewrite is not complete yet. The app shell and onboarding baseline have changed, but many internal pages still inherit old component structure.
- [ ] Some compatibility and historical references remain intentionally, especially around attribution, legacy identifiers, and older release-note/history content.
- [ ] The repo currently has a large dirty worktree, so this file is a progress tracker, not a release checklist sign-off.
