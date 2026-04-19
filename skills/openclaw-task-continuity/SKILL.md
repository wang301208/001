---
name: openclaw-task-continuity
description: Use when changing OpenClaw task/session continuity, compaction summaries, active-task resume behavior, or any code that should preserve what the agent was doing before context compaction or session handoff. Applies to work touching compaction safeguards, session async task status, embedded runner continuity hints, progressSummary/terminalSummary, or Task status / next step sections.
metadata: { "openclaw": { "emoji": "🧵" } }
---

# OpenClaw Task Continuity

Use this skill when the job is to make OpenClaw remember and resume in-flight work more reliably.

## Primary goal

Preserve continuation-critical state across:

- context compaction
- long embedded runs
- async session tasks
- parent/child session handoff
- ACP or detached task resume

## Target codepaths

Read these first when relevant:

- `src/agents/session-async-task-status.ts`
- `src/agents/pi-hooks/compaction-instructions.ts`
- `src/agents/pi-hooks/compaction-safeguard-quality.ts`
- `src/agents/pi-hooks/compaction-safeguard.ts`
- `src/agents/pi-embedded-runner/run/attempt.ts`
- `src/tasks/task-status.ts`
- `src/tasks/task-registry.types.ts`

If the work involves fallback summaries or compaction internals, also read `references/compaction-checklist.md`.

## Design rules

1. Treat transcript summaries as compressed recall, not the sole source of truth.
2. Prefer runtime task state over stale transcript history when they conflict.
3. Keep continuity logic centralized; avoid re-implementing hint construction in multiple runners.
4. Preserve exact identifiers, paths, commands, and task ids.
5. Optimize for restartability: after compaction, the next agent turn should know what it was doing and what to do next.

## What good continuity looks like

A compacted session should still answer:

- What is the active goal?
- What has already been done?
- What task is still running or waiting?
- What is blocked?
- What is the single highest-priority next step?

## Implementation pattern

When improving continuity:

1. Find the active task source (`task`, `progressSummary`, `terminalSummary`, status).
2. Build a single continuity snapshot or hint from runtime state.
3. Inject that snapshot into compaction instructions or fallback summary generation.
4. Ensure `## Task status / next step` prefers active runtime state when present.
5. Add focused tests for both normal and fallback summary paths.

## Guardrails

- Do not add generic prose-only summary requirements if runtime state can be threaded directly.
- Do not duplicate continuity formatting logic across multiple files without a shared helper.
- Do not weaken the required structured summary headings unless the user explicitly asks.

## Verification

At minimum, run targeted tests covering:

- compaction structure instructions
- summary quality auditing
- embedded runner continuity hint plumbing
- fallback summary behavior when an active task exists

See `references/test-targets.md` for likely test files.
