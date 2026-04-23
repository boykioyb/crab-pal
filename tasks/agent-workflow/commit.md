chore: add project agent workflow (CLAUDE.md, skills, subagents, hooks)

Codify CrabPal-specific conventions so every agent run follows the hard
rules without re-deriving them. Root CLAUDE.md covers layout, commands,
versioning policy, task-artifacts convention, and the fixed enums
(permission modes, source types).

Five project-level skills cover the workflow end-to-end: brainstorming,
plan, impl, commit, release — each writes a durable artifact under
tasks/<issue-id>/. Two subagents (code-reviewer, release-auditor) give
independent second opinions. A PreToolUse hook blocks manual edits to
package.json version fields so the bump script stays the only path.

Co-Authored-By: CrabPal <crabpal-agents@users.noreply.github.com>
