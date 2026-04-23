---
name: brainstorming
description: Use when the user wants to think through a problem before committing — phrases like "what do you think", "how should we approach", "just ideas", or when the task is fuzzy and multiple approaches are plausible. Widens the option space instead of narrowing it.
---

# Brainstorming

## Overview

The user is exploring, not executing. Your job is to surface 2–4 real alternatives with honest tradeoffs — not to pick a plan and start implementing. Code reads are fine; file edits are not.

## When to Use

- User asks open-ended: "what could we do about X?", "how should we approach Y?", "thoughts?"
- Task is ambiguous or has multiple viable approaches
- Before committing to a plan on anything non-trivial

**Do NOT use for:**
- Clear, single-path tasks → just do them
- "Implement X" requests → use `impl`
- Once a direction is chosen → switch to `plan`

## Core Pattern

1. **Rephrase the ask** in one sentence to surface ambiguity.
2. **Generate 2–4 distinct options.** If the first idea feels obvious, force 1–2 alternatives before stopping.
3. For each option: name, one-line summary, what it's good at, what it costs.
4. **Pick one and own it.** One short paragraph on why. Don't hedge into "it depends".
5. **Name 1–2 unknowns** that would change the recommendation.

## Output — always

Write the exploration to `tasks/<issue-id>/brainstorm.md`. See the [task-artifacts convention](../../../CLAUDE.md#task-artifacts) for how to resolve `<issue-id>`.

This file is a **living document** — append new options as the brainstorm evolves; don't overwrite prior thinking. The `plan` skill reads this when the user commits to an approach.

## Quick Reference

| Section | Purpose |
|---|---|
| What I think you're asking | Catches misread intent in one sentence |
| The options | 2–4 approaches, each with cost named |
| What I'd pick, and why | One opinion, one paragraph |
| What I'd want to check first | 1–2 unknowns that could flip the choice |

Diagrams beat prose for structural differences — use Mermaid. Quote specifics (`packages/shared/src/sessions/index.ts:42`), not vague regions.

## Red Flags — STOP

- Editing a file "just to illustrate" → stop, add it as an option instead
- Producing a numbered implementation plan → wrong skill, use `plan`
- Listing 5+ theoretical approaches → only 2–4 realistic ones
- Rubber-stamping the user's idea without naming its cost → you're not brainstorming, you're agreeing

## Handoff

End every response explicitly:

> Want me to dig deeper on option B, or pick one and move to a plan?

Don't silently drift into implementation.
