---
name: plan
description: Use when a change touches multiple files, introduces structural shifts (new modules, refactors, migrations), affects a release, or the user says "plan first". Produces a short, acceptable plan before any code moves.
---

# Plan

## Overview

A plan is a checklist the user and you will both execute against. Tight, file-specific, ordered by dependency. The user should read it in under a minute and accept with confidence.

## When to Use

- Change touches >1 file
- Structural change (new module, refactor, migration)
- Release-impacting change
- User explicitly asks to plan

**Do NOT use for:**
- Single-file fixes → just implement
- Pure exploration → use `brainstorming`
- Ambiguous scope → ask one clarifying question first, *then* plan

## Core Pattern

1. **Read context first.** [Root CLAUDE.md](../../../CLAUDE.md) and every package-level `CLAUDE.md` you'll touch. Hard rules (permission modes, source types, credentials, versioning, bundled defaults) live there.
2. **Find existing patterns.** One `Grep`/`Glob` pass to confirm shape of similar code. Plans that ignore repo convention get rejected.
3. **Read `tasks/<issue-id>/brainstorm.md`** if it exists — pick up decisions already made.
4. **Write the plan.** File-specific, ordered, capped at ~8 steps.
5. **Explore mode**: call `SubmitPlan` pointing at the file so the user can accept.

## Output — always

Write to `tasks/<issue-id>/plan.md`. See the [task-artifacts convention](../../../CLAUDE.md#task-artifacts) for `<issue-id>`. Do **not** write to the session `plansFolderPath` — `tasks/` is the single project-local location.

## Quick Reference

| Section | Content |
|---|---|
| Goal | One sentence. Outcome, not activity. |
| Approach | 2–4 sentences. Why this over alternatives. Name the tradeoff. |
| Steps | Numbered, ≤8, each with file:line + one-line reason. |
| Files touched | Bulleted list, one line per file. |
| Validation | Tightest check that covers the change + manual steps (if UI). |
| Risks | What could break. How you'd notice. Rollback. |

## Red Flags — STOP

- "Step 1: investigate the codebase" → investigation happens *before* the plan
- Hedging words: "consider", "maybe", "possibly" → commit or cut
- >8 steps → task is probably two tasks; split it
- Starting to edit files while writing the plan → stop, add to plan
- Vague locations: "the session module" → name the file and line

## Handoff

End with:

> Want me to submit this, or refine first?

Don't silently start implementing.
