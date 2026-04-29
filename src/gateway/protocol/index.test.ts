import type { ErrorObject } from "ajv";
import { describe, expect, it } from "vitest";
import { TALK_TEST_PROVIDER_ID } from "../../test-utils/talk-test-provider.js";
import {
  formatValidationErrors,
  validateAutonomyCapabilityInventoryParams,
  validateAutonomyGenesisPlanParams,
  validateAutonomyGovernanceReconcileParams,
  validateAutonomySuperviseParams,
  validateAgentEvent,
  validateGovernanceCapabilityAssetRegistryParams,
  validateGovernanceCapabilityInventoryParams,
  validateGovernanceProposalsApplyManyParams,
  validateGovernanceProposalsReconcileParams,
  validateGovernanceProposalsReviewManyParams,
  validateGovernanceProposalsRevertManyParams,
  validateGovernanceTeamParams,
  validateGovernanceGenesisPlanParams,
  validateGovernanceProposalsSynthesizeParams,
  validateSessionsPatchParams,
  validateTalkConfigResult,
} from "./index.js";

const makeError = (overrides: Partial<ErrorObject>): ErrorObject => ({
  keyword: "type",
  instancePath: "",
  schemaPath: "#/",
  params: {},
  message: "validation error",
  ...overrides,
});

describe("formatValidationErrors", () => {
  it("returns unknown validation error when missing errors", () => {
    expect(formatValidationErrors(undefined)).toBe("unknown validation error");
    expect(formatValidationErrors(null)).toBe("unknown validation error");
  });

  it("returns unknown validation error when errors list is empty", () => {
    expect(formatValidationErrors([])).toBe("unknown validation error");
  });

  it("formats additionalProperties at root", () => {
    const err = makeError({
      keyword: "additionalProperties",
      params: { additionalProperty: "token" },
    });

    expect(formatValidationErrors([err])).toBe("at root: unexpected property 'token'");
  });

  it("formats additionalProperties with instancePath", () => {
    const err = makeError({
      keyword: "additionalProperties",
      instancePath: "/auth",
      params: { additionalProperty: "token" },
    });

    expect(formatValidationErrors([err])).toBe("at /auth: unexpected property 'token'");
  });

  it("formats message with path for other errors", () => {
    const err = makeError({
      keyword: "required",
      instancePath: "/auth",
      message: "must have required property 'token'",
    });

    expect(formatValidationErrors([err])).toBe("at /auth: must have required property 'token'");
  });

  it("de-dupes repeated entries", () => {
    const err = makeError({
      keyword: "required",
      instancePath: "/auth",
      message: "must have required property 'token'",
    });

    expect(formatValidationErrors([err, err])).toBe(
      "at /auth: must have required property 'token'",
    );
  });
});

describe("validateTalkConfigResult", () => {
  it("accepts Talk SecretRef payloads", () => {
    expect(
      validateTalkConfigResult({
        config: {
          talk: {
            provider: TALK_TEST_PROVIDER_ID,
            providers: {
              [TALK_TEST_PROVIDER_ID]: {
                apiKey: {
                  source: "env",
                  provider: "default",
                  id: "ELEVENLABS_API_KEY",
                },
              },
            },
            resolved: {
              provider: TALK_TEST_PROVIDER_ID,
              config: {
                apiKey: {
                  source: "env",
                  provider: "default",
                  id: "ELEVENLABS_API_KEY",
                },
              },
            },
          },
        },
      }),
    ).toBe(true);
  });

  it("rejects normalized talk payloads without talk.resolved", () => {
    expect(
      validateTalkConfigResult({
        config: {
          talk: {
            provider: TALK_TEST_PROVIDER_ID,
            providers: {
              [TALK_TEST_PROVIDER_ID]: {
                voiceId: "voice-normalized",
              },
            },
          },
        },
      }),
    ).toBe(false);
  });
});

describe("validateAgentEvent", () => {
  it("accepts enriched agent events with governance runtime metadata", () => {
    expect(
      validateAgentEvent({
        runId: "run-1",
        seq: 1,
        stream: "lifecycle",
        ts: 1_710_000_000_000,
        sessionKey: "agent:main:main",
        agentId: "founder",
        governanceRuntime: {
          agentId: "founder",
          observedAt: 1_710_000_000_000,
          summary: {
            charterDeclared: true,
            charterTitle: "Autonomy Charter",
            charterLayer: "governance",
            charterToolDeny: ["git reset --hard"],
            charterRequireAgentId: true,
            charterExecutionContract: "strict-agentic",
            charterElevatedLocked: true,
            freezeActive: false,
            freezeDeny: [],
            freezeDetails: [],
            activeSovereigntyIncidentCount: 0,
            activeSovereigntyIncidentIds: [],
            activeSovereigntyFreezeIncidentIds: [],
          },
        },
        data: {
          phase: "end",
        },
      }),
    ).toBe(true);
  });
});

describe("validateSessionsPatchParams", () => {
  it("accepts governance runtime patches", () => {
    expect(
      validateSessionsPatchParams({
        key: "agent:main:subagent:child",
        governanceRuntime: {
          agentId: "main",
          observedAt: 1_710_000_000_000,
          summary: {
            charterDeclared: false,
            charterToolDeny: [],
            charterRequireAgentId: true,
            charterExecutionContract: "strict-agentic",
            charterElevatedLocked: true,
            freezeActive: false,
            freezeDeny: [],
            freezeDetails: [],
            activeSovereigntyIncidentCount: 0,
            activeSovereigntyIncidentIds: [],
            activeSovereigntyFreezeIncidentIds: [],
          },
        },
      }),
    ).toBe(true);
  });
});

describe("autonomy capability validators", () => {
  it("accepts capability inventory params", () => {
    expect(
      validateAutonomyCapabilityInventoryParams({
        sessionKey: "agent:main:main",
        agentIds: ["founder"],
      }),
    ).toBe(true);
  });

  it("accepts genesis plan params", () => {
    expect(
      validateAutonomyGenesisPlanParams({
        sessionKey: "agent:main:main",
        agentIds: ["founder"],
        teamId: "genesis_team",
      }),
    ).toBe(true);
  });

  it("accepts governance capability inventory params", () => {
    expect(
      validateGovernanceCapabilityInventoryParams({
        agentIds: ["founder"],
        workspaceDirs: ["/tmp/workspace-a"],
      }),
    ).toBe(true);
  });

  it("accepts governance genesis plan params", () => {
    expect(
      validateGovernanceGenesisPlanParams({
        agentIds: ["founder"],
        teamId: "genesis_team",
        workspaceDirs: ["/tmp/workspace-a"],
      }),
    ).toBe(true);
  });

  it("accepts governance capability asset registry params", () => {
    expect(
      validateGovernanceCapabilityAssetRegistryParams({
        agentIds: ["librarian"],
        workspaceDirs: ["/tmp/workspace-a"],
      }),
    ).toBe(true);
  });

  it("accepts governance proposal synthesis params", () => {
    expect(
      validateGovernanceProposalsSynthesizeParams({
        agentIds: ["founder", "strategist"],
        workspaceDirs: ["/tmp/workspace-a"],
      }),
    ).toBe(true);
  });

  it("accepts governance proposal reconcile params", () => {
    expect(
      validateGovernanceProposalsReconcileParams({
        agentIds: ["founder", "librarian"],
        workspaceDirs: ["/tmp/workspace-a"],
        mode: "apply_safe",
        createdByAgentId: "founder",
        createdBySessionKey: "agent:founder:main",
        decidedBy: "founder",
        decisionNote: "Auto-apply safe fixes.",
        appliedBy: "founder",
      }),
    ).toBe(true);
  });

  it("accepts governance proposal review-many params", () => {
    expect(
      validateGovernanceProposalsReviewManyParams({
        status: "pending",
        limit: 5,
        decision: "approve",
        decidedBy: "architect",
        continueOnError: false,
      }),
    ).toBe(true);
  });

  it("accepts governance proposal apply-many params", () => {
    expect(
      validateGovernanceProposalsApplyManyParams({
        proposalIds: ["gpr-1", "gpr-2"],
        appliedBy: "architect",
      }),
    ).toBe(true);
  });

  it("accepts governance proposal revert-many params", () => {
    expect(
      validateGovernanceProposalsRevertManyParams({
        status: "applied",
        limit: 2,
        revertedBy: "architect",
        continueOnError: true,
      }),
    ).toBe(true);
  });

  it("accepts governance team params", () => {
    expect(
      validateGovernanceTeamParams({
        teamId: "genesis_team",
      }),
    ).toBe(true);
  });

  it("accepts autonomy governance reconcile params", () => {
    expect(
      validateAutonomyGovernanceReconcileParams({
        sessionKey: "agent:main:main",
        agentIds: ["founder"],
        workspaceDirs: ["/tmp/workspace-a"],
        mode: "force_apply_all",
        decisionNote: "Escalate all deterministic governance repairs.",
      }),
    ).toBe(true);
  });

  it("accepts autonomy supervisor params", () => {
    expect(
      validateAutonomySuperviseParams({
        sessionKey: "agent:main:main",
        agentIds: ["founder", "strategist"],
        workspaceDirs: ["/tmp/workspace-a"],
        teamId: "genesis_team",
        restartBlockedFlows: true,
        governanceMode: "force_apply_all",
        decisionNote: "Escalate the supervisor pass.",
        includeCapabilityInventory: true,
        includeGenesisPlan: true,
        recordHistory: true,
      }),
    ).toBe(true);
  });
});
