#!/usr/bin/env bash
# Block Edit/Write/MultiEdit calls that would change the top-level "version"
# field in any package.json. Registered as a PreToolUse hook.
#
# Policy: root package.json is the single source of truth. Use `bun run bump`
# to propagate versions — see CLAUDE.md.

set -uo pipefail

payload=$(cat)
tool_name=$(echo "$payload" | jq -r '.tool_name // empty' 2>/dev/null || echo "")
file_path=$(echo "$payload" | jq -r '.tool_input.file_path // empty' 2>/dev/null || echo "")

# Only inspect package.json files (and not vendored ones).
case "$file_path" in
  */package.json|package.json) ;;
  *) exit 0 ;;
esac
case "$file_path" in
  */node_modules/*|*/.claude/worktrees/*) exit 0 ;;
esac

extract_version() {
  # Extract the first top-level `"version": "X.Y.Z"` value from stdin.
  grep -oE '"version"[[:space:]]*:[[:space:]]*"[^"]+"' | head -1 | sed -E 's/.*"([^"]+)"$/\1/'
}

block() {
  cat >&2 <<EOF
Blocked: this $tool_name call would change the "version" field in $file_path.

Root package.json is the single source of truth for CrabPal versions. All
workspace package.json files MUST match root, and they are kept in sync by
scripts/bump-version.ts.

Use the bump script instead:
  bun run bump              # sync all workspaces to root version
  bun run bump patch        # bump root patch, then sync
  bun run bump minor|major
  bun run bump 1.2.3        # set directly

See CLAUDE.md ("Versioning — single source of truth") for details.
EOF
  exit 2
}

case "$tool_name" in
  Edit)
    old_string=$(echo "$payload" | jq -r '.tool_input.old_string // empty')
    new_string=$(echo "$payload" | jq -r '.tool_input.new_string // empty')
    old_v=$(echo "$old_string" | extract_version || true)
    new_v=$(echo "$new_string" | extract_version || true)
    if [ -n "$old_v" ] && [ -n "$new_v" ] && [ "$old_v" != "$new_v" ]; then
      block
    fi
    ;;

  MultiEdit)
    # Iterate edits; fail if any changes the version.
    count=$(echo "$payload" | jq '.tool_input.edits | length' 2>/dev/null || echo 0)
    for i in $(seq 0 $((count - 1))); do
      old_string=$(echo "$payload" | jq -r ".tool_input.edits[$i].old_string // empty")
      new_string=$(echo "$payload" | jq -r ".tool_input.edits[$i].new_string // empty")
      old_v=$(echo "$old_string" | extract_version || true)
      new_v=$(echo "$new_string" | extract_version || true)
      if [ -n "$old_v" ] && [ -n "$new_v" ] && [ "$old_v" != "$new_v" ]; then
        block
      fi
    done
    ;;

  Write)
    content=$(echo "$payload" | jq -r '.tool_input.content // empty')
    new_v=$(echo "$content" | extract_version || true)
    current_v=""
    if [ -f "$file_path" ]; then
      current_v=$(extract_version < "$file_path" || true)
    fi
    if [ -n "$new_v" ] && [ -n "$current_v" ] && [ "$new_v" != "$current_v" ]; then
      block
    fi
    ;;
esac

exit 0
