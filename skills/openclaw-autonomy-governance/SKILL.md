---
name: openclaw-autonomy-governance
description: Governed workflow for maintaining OpenClaw autonomous governance, capability assets, Genesis handoffs, sandbox validation, and promotion evidence.
openclaw:
  skillKey: openclaw-autonomy-governance
  always: false
---

# OpenClaw Autonomy Governance

Use this skill when a task changes or verifies the strong-autonomy architecture:

- Check `governance/charter/constitution.yaml`, `governance/charter/policies/`, and `governance/charter/agents/` before changing autonomy behavior.
- Use `src/governance/capability-registry.ts` as the source of truth for capability inventory and Genesis gap detection.
- Use `src/governance/capability-asset-registry.ts` to build or compare `governance/charter/capability/asset-registry.yaml`.
- Route capability changes through the Genesis chain: sentinel, archaeologist, tdd_developer, qa, publisher, librarian.
- Validate sandbox promotion logic with `src/governance/sandbox-universe.test.ts` when changing experiment, replay, or promotion gates.
- Validate fleet supervision with `src/plugins/runtime/runtime-autonomy.test.ts` when changing managed loops, supervisor, or replay submission.

Before promoting a new governed capability, produce:

- A capability asset entry or manifest.
- QA or replay evidence.
- A rollback reference.
- An audit-visible proposal or registration path.
