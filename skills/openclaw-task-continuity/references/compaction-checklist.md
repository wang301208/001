# Compaction continuity checklist

Use this checklist when changing OpenClaw summary/continuity behavior.

## Core headings that must remain stable

- `## Current goal`
- `## Decisions`
- `## Completed work`
- `## Task status / next step`
- `## Open TODOs`
- `## Constraints/Rules`
- `## Pending user asks`
- `## Exact identifiers`

## Prefer runtime task state from

- active `TaskRecord`
- `progressSummary`
- `terminalSummary`
- task prompt / task text
- flow blocked or waiting reason when available

## Good `Task status / next step` content

Should make resume obvious:

- current status
- blocker or waiting reason if present
- most important next step

## Failure modes to watch for

- summary has headings but loses in-flight task state
- fallback summary ignores active task runtime data
- stale transcript text overrides current running task state
- exact identifiers disappear during compaction
- tests only validate presence of headings, not continuity quality
