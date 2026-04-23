chore: centralize version with root package.json source-of-truth

About and What's New were drifting (0.0.3 vs 0.0.4) because workspace
package.json versions were edited independently from the root and the
release-notes directory. Root package.json is now the single authority;
`bun run bump` syncs every workspace and seeds a release-notes stub so
both screens can't disagree.

All 11 workspaces synced to 0.0.5 to match root.

Co-Authored-By: CrabPal <crabpal-agents@users.noreply.github.com>
