import { describe, expect, it } from "vitest";
import {
  applyTaskStatusOverrideToSummary,
  buildContinuationState,
  buildAttemptContinuationAuditPayload,
  buildAttemptContinuationGuidanceLine,
  buildAttemptTaskContinuityHint,
  buildAttemptTaskStatusOverrideFromContinuationState,
  buildCompactionContinuationAuditPayload,
  buildCompactionTaskStatusOverrideFromContinuationState,
  buildReplayContinuationAuditPayload,
  buildReplayTaskStatusOverrideFromContinuationState,
  explainAttemptContinuationDecision,
  explainCompactionContinuationDecision,
  explainContinuationDecision,
  explainReplayContinuationDecision,
  getDefaultTaskStatusOverrideFromContinuationState,
  buildTaskContinuationFromSummary,
  buildTaskStatusOverrideFromContinuation,
  extractTaskStatusSection,
  formatNextStepAnchorForContinuationState,
  hasMeaningfulTaskContinuation,
  hasTaskStatusActionabilitySignals,
  mergeTaskContinuationDetails,
  readTaskContinuationFromDetails,
  resolveContinuationStateFromCompactionEntry,
  resolvePreferredTaskContinuation,
  shouldAcceptTaskStatusWithoutImmediateNextStep,
  shouldDescribeNextStepAsImmediatelyExecutable,
  shouldTreatContinuationStateAsRestoreBoundary,
} from "./task-status-override.js";

describe("task-status-override", () => {
  it("builds textual task status override from structured continuation", () => {
    expect(
      buildTaskStatusOverrideFromContinuation({
        statusText: "Blocked waiting on runtime refresh.",
        recentOutcome: "Rebuilt continuation from checkpoint.",
        nextStep: "Resume from checkpoint continuation.",
      }),
    ).toBe(
      [
        "Blocked waiting on runtime refresh.",
        "Recent outcome: Rebuilt continuation from checkpoint.",
        "Next step: Resume from checkpoint continuation.",
      ].join("\n"),
    );
  });

  it("merges structured continuation into compaction details", () => {
    expect(
      mergeTaskContinuationDetails({
        details: { existing: true },
        continuation: {
          taskId: "task-1",
          nextStep: "Resume from structured continuation.",
        },
      }),
    ).toEqual({
      existing: true,
      continuation: {
        taskId: "task-1",
        nextStep: "Resume from structured continuation.",
      },
    });
  });

  it("reads structured continuation back from compaction details", () => {
    expect(
      readTaskContinuationFromDetails({
        continuation: {
          taskId: "task-1",
          runId: "run-1",
          statusText: "Blocked waiting for transcript restore.",
          nextStep: "Resume from compaction details.",
        },
      }),
    ).toEqual({
      taskId: "task-1",
      runId: "run-1",
      statusText: "Blocked waiting for transcript restore.",
      nextStep: "Resume from compaction details.",
    });
  });

  it("extracts task status section from summary text", () => {
    expect(
      extractTaskStatusSection(
        [
          "## Current goal",
          "Keep restoring task continuity.",
          "## Task status / next step",
          "Blocked waiting for transcript restore.",
          "Recent outcome: Loaded summary fallback.",
          "Next step: Resume from summary text.",
          "## Open TODOs",
          "None.",
        ].join("\n"),
      ),
    ).toBe(
      [
        "Blocked waiting for transcript restore.",
        "Recent outcome: Loaded summary fallback.",
        "Next step: Resume from summary text.",
      ].join("\n"),
    );
  });

  it("builds structured continuation from summary text", () => {
    expect(
      buildTaskContinuationFromSummary(
        [
          "## Current goal",
          "Keep restoring task continuity.",
          "## Task status / next step",
          "Blocked waiting for transcript restore.",
          "Recent outcome: Loaded summary fallback.",
          "Next step: Resume from summary text.",
          "## Open TODOs",
          "None.",
        ].join("\n"),
      ),
    ).toEqual({
      statusText: "Blocked waiting for transcript restore.",
      recentOutcome: "Loaded summary fallback.",
      nextStep: "Resume from summary text.",
    });
  });

  it("detects meaningful task continuation", () => {
    expect(hasMeaningfulTaskContinuation({ statusText: "Blocked waiting for restore." })).toBe(
      true,
    );
    expect(hasMeaningfulTaskContinuation({})).toBe(false);
    expect(hasMeaningfulTaskContinuation(undefined)).toBe(false);
  });

  it("treats meaningful or blocked-like continuation states as restore boundaries", () => {
    expect(
      shouldTreatContinuationStateAsRestoreBoundary({
        meaningful: true,
        statusKind: "ready",
      }),
    ).toBe(true);
    expect(
      shouldTreatContinuationStateAsRestoreBoundary({
        meaningful: false,
        statusKind: "failed",
      }),
    ).toBe(true);
    expect(
      shouldTreatContinuationStateAsRestoreBoundary({
        meaningful: false,
        statusKind: "unknown",
      }),
    ).toBe(false);
    expect(shouldTreatContinuationStateAsRestoreBoundary(undefined)).toBe(false);
  });

  it("distinguishes whether a continuation next step should be described as immediately executable", () => {
    expect(shouldDescribeNextStepAsImmediatelyExecutable("ready")).toBe(true);
    expect(shouldDescribeNextStepAsImmediatelyExecutable("unknown")).toBe(true);
    expect(shouldDescribeNextStepAsImmediatelyExecutable(undefined)).toBe(true);
    expect(shouldDescribeNextStepAsImmediatelyExecutable("blocked")).toBe(false);
    expect(shouldDescribeNextStepAsImmediatelyExecutable("failed")).toBe(false);
    expect(shouldDescribeNextStepAsImmediatelyExecutable("done")).toBe(false);
  });

  it("formats next-step anchors according to continuation status semantics", () => {
    expect(
      formatNextStepAnchorForContinuationState({
        statusKind: "ready",
        nextStep: "Resume the active task.",
      }),
    ).toBe("- Next step anchor: continue the active task if still relevant -> Resume the active task.");
    expect(
      formatNextStepAnchorForContinuationState({
        statusKind: "failed",
        nextStep: "Repair restore state.",
      }),
    ).toBe(
      "- Next step anchor after resolving the blocker or failure state, if still valid -> Repair restore state.",
    );
    expect(
      formatNextStepAnchorForContinuationState({
        statusKind: "done",
        nextStep: "Open a follow-up task if needed.",
      }),
    ).toBe(
      "- Prior next step anchor, only if follow-up work is still needed -> Open a follow-up task if needed.",
    );
  });

  it("builds attempt guidance lines according to continuation status semantics", () => {
    expect(buildAttemptContinuationGuidanceLine("ready")).toBe(
      "- Make the next step immediately actionable when the active task still applies.",
    );
    expect(buildAttemptContinuationGuidanceLine("done")).toBe(
      "- Treat any stored next step as optional follow-up, not as evidence that the prior task is still active.",
    );
    expect(buildAttemptContinuationGuidanceLine("blocked")).toBe(
      "- Do not present the next step as immediately executable unless the blocker or failure state has been cleared.",
    );
  });

  it("builds attempt continuity hints from continuation state", () => {
    expect(
      buildAttemptTaskContinuityHint({
        continuation: {
          statusText: "Done. Prior task completed.",
          recentOutcome: "Verified the migration completed successfully.",
          nextStep: "Open a follow-up task if needed.",
        },
        statusKind: "done",
        source: "checkpoint",
        sourceLabel: "structured compaction checkpoint",
        meaningful: true,
      }),
    ).toContain(
      "- Treat any stored next step as optional follow-up, not as evidence that the prior task is still active.",
    );
    expect(
      buildAttemptTaskContinuityHint({
        continuation: {
          statusText: "Done. Prior task completed.",
          recentOutcome: "Verified the migration completed successfully.",
          nextStep: "Open a follow-up task if needed.",
        },
        statusKind: "done",
        source: "checkpoint",
        sourceLabel: "structured compaction checkpoint",
        meaningful: true,
      }),
    ).toContain(
      "- Active runtime task missing; using latest structured compaction checkpoint as the restore fallback.",
    );
    expect(
      buildAttemptTaskContinuityHint({
        continuation: {
          statusText: "Done. Prior task completed.",
          recentOutcome: "Verified the migration completed successfully.",
          nextStep: "Open a follow-up task if needed.",
        },
        statusKind: "done",
        source: "checkpoint",
        sourceLabel: "structured compaction checkpoint",
        meaningful: true,
      }),
    ).toContain(
      "- Prior next step anchor, only if follow-up work is still needed -> Open a follow-up task if needed.",
    );
  });

  it("accepts blocked-like or done continuation states without requiring an immediately executable next step", () => {
    expect(
      shouldAcceptTaskStatusWithoutImmediateNextStep({
        statusText: "Failed waiting for restore repair.",
      }),
    ).toBe(true);
    expect(
      shouldAcceptTaskStatusWithoutImmediateNextStep({
        statusText: "Done. Prior task completed.",
        recentOutcome: "Verified the migration completed successfully.",
      }),
    ).toBe(true);
    expect(
      shouldAcceptTaskStatusWithoutImmediateNextStep({
        statusText: "Ready to continue.",
      }),
    ).toBe(false);
  });

  it("treats taskStatusOverride as a legacy compatibility alias for default projection", () => {
    expect(
      getDefaultTaskStatusOverrideFromContinuationState({
        taskStatusOverride: "legacy override",
        defaultTaskStatusOverride: "default override",
      }),
    ).toBe("default override");
    expect(
      getDefaultTaskStatusOverrideFromContinuationState({
        taskStatusOverride: "legacy override",
      }),
    ).toBe("legacy override");
    expect(getDefaultTaskStatusOverrideFromContinuationState(undefined)).toBeUndefined();
  });

  it("builds attempt override for done continuation with follow-up preserved", () => {
    expect(
      buildAttemptTaskStatusOverrideFromContinuationState({
        continuation: {
          statusText: "Done. Prior task completed.",
          recentOutcome: "Verified the migration completed successfully.",
          nextStep: "Open a follow-up task if needed.",
        },
        statusKind: "done",
        meaningful: true,
        taskStatusOverride:
          "Done. Prior task completed.\nRecent outcome: Verified the migration completed successfully.\nNext step: Open a follow-up task if needed.",
      }),
    ).toBe(
      "Done. Prior task completed.\nRecent outcome: Verified the migration completed successfully.\nNext step: Open a follow-up task if needed.",
    );
  });

  it("builds compaction override for done continuation with follow-up preserved", () => {
    expect(
      buildCompactionTaskStatusOverrideFromContinuationState({
        continuation: {
          statusText: "Done. Prior task completed.",
          recentOutcome: "Verified the migration completed successfully.",
          nextStep: "Open a follow-up task if needed.",
        },
        statusKind: "done",
        meaningful: true,
        taskStatusOverride:
          "Done. Prior task completed.\nRecent outcome: Verified the migration completed successfully.\nNext step: Open a follow-up task if needed.",
        defaultTaskStatusOverride:
          "Done. Prior task completed.\nRecent outcome: Verified the migration completed successfully.\nNext step: Open a follow-up task if needed.",
      }),
    ).toBe(
      "Done. Prior task completed.\nRecent outcome: Verified the migration completed successfully.\nNext step: Open a follow-up task if needed.",
    );
  });

  it("builds replay override for done continuation without projecting stale next-step text", () => {
    expect(
      buildReplayTaskStatusOverrideFromContinuationState({
        continuation: {
          statusText: "Done. Prior task completed.",
          recentOutcome: "Verified the migration completed successfully.",
          nextStep: "Open a follow-up task if needed.",
        },
        statusKind: "done",
        meaningful: true,
        taskStatusOverride:
          "Done. Prior task completed.\nRecent outcome: Verified the migration completed successfully.\nNext step: Open a follow-up task if needed.",
      }),
    ).toBe(
      "Done. Prior task completed.\nRecent outcome: Verified the migration completed successfully.",
    );
  });

  it("explains done continuation projection decisions for replay consumers", () => {
    expect(
      explainContinuationDecision({
        continuationState: {
          continuation: {
            statusText: "Done. Prior task completed.",
            recentOutcome: "Verified the migration completed successfully.",
            nextStep: "Open a follow-up task if needed.",
          },
          statusKind: "done",
          meaningful: true,
          source: "checkpoint",
          sourceLabel: "structured compaction checkpoint",
        },
        includeNextStepForDone: false,
      }),
    ).toEqual({
      meaningful: true,
      restoreBoundary: true,
      statusKind: "done",
      source: "checkpoint",
      sourceLabel: "structured compaction checkpoint",
      projectionMode: "done-no-next-step",
      auditCodes: [
        "continuation.meaningful",
        "continuation.has_source",
        "continuation.has_status_kind",
        "continuation.restore_boundary",
        "projection.done_without_next_step",
      ],
      reasons: [
        "continuation state is meaningful",
        "continuation source: structured compaction checkpoint",
        "continuation status kind: done",
        "continuation state is treated as a restore boundary",
        "done continuation suppresses stale next-step text for this consumer",
      ],
    });
  });

  it("explains non-boundary continuation decisions when no projection should be emitted", () => {
    expect(
      explainContinuationDecision({
        continuationState: {
          continuation: {
            statusText: "Ready to continue.",
            nextStep: "Resume the active task.",
          },
          statusKind: "ready",
          meaningful: false,
          source: "summary-text",
          sourceLabel: "compaction summary text",
        },
        includeNextStepForDone: true,
      }),
    ).toEqual({
      meaningful: false,
      restoreBoundary: false,
      statusKind: "ready",
      source: "summary-text",
      sourceLabel: "compaction summary text",
      projectionMode: "none",
      auditCodes: [
        "continuation.not_meaningful",
        "continuation.has_source",
        "continuation.has_status_kind",
        "continuation.not_restore_boundary",
        "projection.none",
      ],
      reasons: [
        "continuation state is not meaningful",
        "continuation source: compaction summary text",
        "continuation status kind: ready",
        "continuation state is not treated as a restore boundary",
        "no projected task-status override will be emitted",
      ],
    });
  });

  it("provides consumer-specific explain helpers for replay/attempt/compaction", () => {
    const continuationState = {
      continuation: {
        statusText: "Done. Prior task completed.",
        recentOutcome: "Verified the migration completed successfully.",
        nextStep: "Open a follow-up task if needed.",
      },
      statusKind: "done" as const,
      meaningful: true,
      source: "checkpoint" as const,
      sourceLabel: "structured compaction checkpoint",
    };

    expect(explainReplayContinuationDecision(continuationState).projectionMode).toBe(
      "done-no-next-step",
    );
    expect(explainAttemptContinuationDecision(continuationState).projectionMode).toBe(
      "done-with-next-step",
    );
    expect(explainCompactionContinuationDecision(continuationState).projectionMode).toBe(
      "done-with-next-step",
    );
  });

  it("builds unified audit payloads for replay/attempt/compaction consumers", () => {
    const continuationState = {
      continuation: {
        statusText: "Done. Prior task completed.",
        recentOutcome: "Verified the migration completed successfully.",
        nextStep: "Open a follow-up task if needed.",
      },
      statusKind: "done" as const,
      meaningful: true,
      source: "checkpoint" as const,
      sourceLabel: "structured compaction checkpoint",
    };

    expect(buildReplayContinuationAuditPayload(continuationState)).toMatchObject({
      consumer: "replay",
      projectedTaskStatusOverride:
        "Done. Prior task completed.\nRecent outcome: Verified the migration completed successfully.",
      explanation: { projectionMode: "done-no-next-step" },
    });
    expect(buildAttemptContinuationAuditPayload(continuationState)).toMatchObject({
      consumer: "attempt",
      projectedTaskStatusOverride:
        "Done. Prior task completed.\nRecent outcome: Verified the migration completed successfully.\nNext step: Open a follow-up task if needed.",
      explanation: { projectionMode: "done-with-next-step" },
    });
    expect(buildCompactionContinuationAuditPayload(continuationState)).toMatchObject({
      consumer: "compaction",
      projectedTaskStatusOverride:
        "Done. Prior task completed.\nRecent outcome: Verified the migration completed successfully.\nNext step: Open a follow-up task if needed.",
      explanation: { projectionMode: "done-with-next-step" },
    });
  });

  it("keeps blocker and next-step projection for blocked-like replay continuation", () => {
    expect(
      buildReplayTaskStatusOverrideFromContinuationState({
        continuation: {
          statusText: "Blocked waiting for transcript restore.",
          recentOutcome: "Recovered structured continuation from compaction details.",
          nextStep: "Resume from transcript-backed continuation.",
        },
        statusKind: "blocked",
        meaningful: true,
        taskStatusOverride:
          "Blocked waiting for transcript restore.\nRecent outcome: Recovered structured continuation from compaction details.\nNext step: Resume from transcript-backed continuation.",
      }),
    ).toBe(
      "Blocked waiting for transcript restore.\nRecent outcome: Recovered structured continuation from compaction details.\nNext step: Resume from transcript-backed continuation.",
    );
  });

  it("detects actionable task status signals", () => {
    expect(
      hasTaskStatusActionabilitySignals(
        "Blocked waiting for runtime confirmation. Recent outcome: verified the active task state. Next step: continue from runtime truth.",
      ),
    ).toBe(true);
    expect(hasTaskStatusActionabilitySignals("Need more detail soon.")).toBe(false);
    expect(hasTaskStatusActionabilitySignals(undefined)).toBe(false);
  });

  it("builds a meaningful continuation state with projected override", () => {
    expect(
      buildContinuationState({
        continuation: {
          statusText: "Blocked waiting for runtime confirmation.",
          recentOutcome: "Recovered checkpoint continuation.",
          nextStep: "Resume from continuation state.",
        },
        source: "checkpoint",
      }),
    ).toEqual({
      continuation: {
        statusText: "Blocked waiting for runtime confirmation.",
        recentOutcome: "Recovered checkpoint continuation.",
        nextStep: "Resume from continuation state.",
      },
      source: "checkpoint",
      taskStatusOverride:
        "Blocked waiting for runtime confirmation.\nRecent outcome: Recovered checkpoint continuation.\nNext step: Resume from continuation state.",
      defaultTaskStatusOverride:
        "Blocked waiting for runtime confirmation.\nRecent outcome: Recovered checkpoint continuation.\nNext step: Resume from continuation state.",
      statusKind: "blocked",
      blocker: "Blocked waiting for runtime confirmation.",
      sourceLabel: "structured compaction checkpoint",
      meaningful: true,
    });
  });

  it("resolves continuation state from a compaction entry", () => {
    expect(
      resolveContinuationStateFromCompactionEntry({
        summary: [
          "## Current goal",
          "Keep continuity aligned.",
          "## Task status / next step",
          "Blocked waiting for transcript restore.",
          "Recent outcome: Loaded summary fallback.",
          "Next step: Resume from summary text.",
          "## Open TODOs",
          "None.",
        ].join("\n"),
      }),
    ).toEqual({
      continuation: {
        statusText: "Blocked waiting for transcript restore.",
        recentOutcome: "Loaded summary fallback.",
        nextStep: "Resume from summary text.",
      },
      source: "summary-text",
      taskStatusOverride:
        "Blocked waiting for transcript restore.\nRecent outcome: Loaded summary fallback.\nNext step: Resume from summary text.",
      defaultTaskStatusOverride:
        "Blocked waiting for transcript restore.\nRecent outcome: Loaded summary fallback.\nNext step: Resume from summary text.",
      statusKind: "blocked",
      blocker: "Blocked waiting for transcript restore.",
      sourceLabel: "compaction summary text",
      meaningful: true,
    });
  });

  it("falls back to summary text continuation when compaction details are absent", () => {
    expect(
      resolvePreferredTaskContinuation({
        messages: [
          {
            role: "compactionSummary",
            summary: [
              "## Current goal",
              "Keep continuity aligned.",
              "## Task status / next step",
              "Blocked waiting for transcript restore.",
              "Recent outcome: Loaded summary fallback.",
              "Next step: Resume from summary text.",
              "## Open TODOs",
              "None.",
            ].join("\n"),
          } as never,
        ],
      }),
    ).toEqual({
      continuation: {
        statusText: "Blocked waiting for transcript restore.",
        recentOutcome: "Loaded summary fallback.",
        nextStep: "Resume from summary text.",
      },
      source: "summary-text",
    });
  });

  it("prefers compaction details continuation when no runtime or checkpoint continuation exists", () => {
    expect(
      resolvePreferredTaskContinuation({
        messages: [
          {
            role: "compactionSummary",
            summary: "compressed",
            details: {
              continuation: {
                statusText: "Blocked waiting for transcript restore.",
                nextStep: "Resume from compaction details.",
              },
            },
          } as never,
        ],
      }),
    ).toEqual({
      continuation: {
        statusText: "Blocked waiting for transcript restore.",
        nextStep: "Resume from compaction details.",
      },
      source: "compaction-details",
    });
  });

  it("applies structured continuation-derived override to task status section", () => {
    const summary = [
      "## Current goal",
      "Keep restoring task continuity.",
      "## Task status / next step",
      "Stale checkpoint summary.",
      "## Open TODOs",
      "None.",
    ].join("\n");

    const override = buildTaskStatusOverrideFromContinuation({
      statusText: "Waiting on verification.",
      recentOutcome: "Checkpoint continuation loaded.",
      nextStep: "Use checkpoint continuation as restore fallback.",
    });

    const next = applyTaskStatusOverrideToSummary(summary, override);
    expect(next).toContain("Waiting on verification.");
    expect(next).toContain("Recent outcome: Checkpoint continuation loaded.");
    expect(next).toContain("Next step: Use checkpoint continuation as restore fallback.");
    expect(next).not.toContain("Stale checkpoint summary.");
  });
});
