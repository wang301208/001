import { Type } from "@sinclair/typebox";
import { CronJobSchema } from "./cron.js";
import { NonEmptyString } from "./primitives.js";

export const ModelChoiceSchema = Type.Object(
  {
    id: NonEmptyString,
    name: NonEmptyString,
    provider: NonEmptyString,
    alias: Type.Optional(NonEmptyString),
    contextWindow: Type.Optional(Type.Integer({ minimum: 1 })),
    reasoning: Type.Optional(Type.Boolean()),
  },
  { additionalProperties: false },
);

export const ToolGovernanceSummarySchema = Type.Object(
  {
    charterDeclared: Type.Boolean(),
    charterTitle: Type.Optional(NonEmptyString),
    charterLayer: Type.Optional(NonEmptyString),
    charterToolDeny: Type.Array(NonEmptyString),
    charterRequireAgentId: Type.Boolean(),
    charterExecutionContract: Type.Optional(
      Type.Union([Type.Literal("default"), Type.Literal("strict-agentic")]),
    ),
    charterElevatedLocked: Type.Boolean(),
    freezeActive: Type.Boolean(),
    freezeReasonCode: Type.Optional(NonEmptyString),
    freezeDeny: Type.Array(NonEmptyString),
    freezeDetails: Type.Array(NonEmptyString),
    activeSovereigntyIncidentCount: Type.Integer({ minimum: 0 }),
    activeSovereigntyIncidentIds: Type.Array(NonEmptyString),
    activeSovereigntyFreezeIncidentIds: Type.Array(NonEmptyString),
  },
  { additionalProperties: false },
);

export const AgentGovernanceRuntimeContractSchema = Type.Object(
  {
    agentId: NonEmptyString,
    charterDeclared: Type.Boolean(),
    charterTitle: Type.Optional(NonEmptyString),
    charterLayer: Type.Optional(NonEmptyString),
    charterClass: Type.Optional(NonEmptyString),
    charterStatus: Type.Optional(NonEmptyString),
    missionPrimary: Type.Optional(NonEmptyString),
    authorityLevel: Type.Optional(NonEmptyString),
    collaborators: Type.Array(NonEmptyString),
    reportsTo: Type.Array(NonEmptyString),
    mutationAllow: Type.Array(NonEmptyString),
    mutationDeny: Type.Array(NonEmptyString),
    networkDefault: Type.Optional(NonEmptyString),
    networkConditions: Type.Array(NonEmptyString),
    runtimeHooks: Type.Array(NonEmptyString),
    resourceBudget: Type.Optional(
      Type.Object(
        {
          tokens: Type.Optional(NonEmptyString),
          parallelism: Type.Optional(NonEmptyString),
          runtime: Type.Optional(NonEmptyString),
        },
        { additionalProperties: false },
      ),
    ),
    charterToolDeny: Type.Array(NonEmptyString),
    charterRequireAgentId: Type.Boolean(),
    charterExecutionContract: Type.Optional(
      Type.Union([Type.Literal("default"), Type.Literal("strict-agentic")]),
    ),
    charterElevatedLocked: Type.Boolean(),
    freezeActive: Type.Boolean(),
    freezeReasonCode: Type.Optional(NonEmptyString),
    freezeDeny: Type.Array(NonEmptyString),
    freezeDetails: Type.Array(NonEmptyString),
    activeSovereigntyIncidentCount: Type.Integer({ minimum: 0 }),
    activeSovereigntyIncidentIds: Type.Array(NonEmptyString),
    activeSovereigntyFreezeIncidentIds: Type.Array(NonEmptyString),
    effectiveToolDeny: Type.Array(NonEmptyString),
  },
  { additionalProperties: false },
);

export const AgentGovernanceRuntimeSnapshotSchema = Type.Object(
  {
    agentId: NonEmptyString,
    observedAt: Type.Integer({ minimum: 0 }),
    summary: ToolGovernanceSummarySchema,
  },
  { additionalProperties: false },
);

export const GovernanceCharterDocumentStatusSchema = Type.Object(
  {
    path: NonEmptyString,
    exists: Type.Boolean(),
    parseError: Type.Optional(NonEmptyString),
  },
  { additionalProperties: false },
);

export const GovernanceEnforcementSummarySchema = Type.Object(
  {
    active: Type.Boolean(),
    reasonCode: Type.Optional(NonEmptyString),
    message: Type.Optional(NonEmptyString),
    details: Type.Array(NonEmptyString),
    denyTools: Type.Array(NonEmptyString),
    activeSovereigntyIncidentIds: Type.Array(NonEmptyString),
    activeSovereigntyFreezeIncidentIds: Type.Array(NonEmptyString),
  },
  { additionalProperties: false },
);

export const GovernanceFindingSchema = Type.Object(
  {
    checkId: NonEmptyString,
    severity: Type.Union([
      Type.Literal("info"),
      Type.Literal("warn"),
      Type.Literal("critical"),
    ]),
    title: NonEmptyString,
    detail: NonEmptyString,
    remediation: Type.Optional(NonEmptyString),
  },
  { additionalProperties: false },
);

export const GovernanceAuditActorSchema = Type.Object(
  {
    type: Type.Union([
      Type.Literal("agent"),
      Type.Literal("human"),
      Type.Literal("system"),
      Type.Literal("runtime"),
    ]),
    id: NonEmptyString,
  },
  { additionalProperties: false },
);

export const GovernanceAuditFactRefsSchema = Type.Object(
  {
    sessionKey: Type.Optional(NonEmptyString),
    runId: Type.Optional(NonEmptyString),
    proposalId: Type.Optional(NonEmptyString),
    taskId: Type.Optional(NonEmptyString),
    flowId: Type.Optional(NonEmptyString),
    assetId: Type.Optional(NonEmptyString),
    workspaceDirs: Type.Optional(Type.Array(NonEmptyString)),
  },
  { additionalProperties: false },
);

export const GovernanceAuditFactRecordSchema = Type.Object(
  {
    eventId: NonEmptyString,
    ts: Type.Integer({ minimum: 0 }),
    domain: NonEmptyString,
    action: NonEmptyString,
    actor: GovernanceAuditActorSchema,
    summary: Type.Optional(NonEmptyString),
    traceId: Type.Optional(NonEmptyString),
    causationId: Type.Optional(NonEmptyString),
    refs: Type.Optional(GovernanceAuditFactRefsSchema),
    payload: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
  },
  { additionalProperties: false },
);

export const GovernanceAuditSummarySchema = Type.Object(
  {
    filePath: NonEmptyString,
    total: Type.Integer({ minimum: 0 }),
    latestTs: Type.Optional(Type.Integer({ minimum: 0 })),
    domains: Type.Array(NonEmptyString),
  },
  { additionalProperties: false },
);

export const GovernanceSovereigntyIncidentRecordSchema = Type.Object(
  {
    id: NonEmptyString,
    key: NonEmptyString,
    status: Type.Union([Type.Literal("open"), Type.Literal("resolved")]),
    severity: Type.Union([Type.Literal("warn"), Type.Literal("critical")]),
    source: Type.Union([Type.Literal("signal"), Type.Literal("finding")]),
    title: NonEmptyString,
    summary: NonEmptyString,
    reasonCode: Type.Optional(NonEmptyString),
    detailLines: Type.Array(NonEmptyString),
    findingIds: Type.Array(NonEmptyString),
    freezeRequested: Type.Boolean(),
    firstObservedAt: Type.Integer({ minimum: 0 }),
    lastObservedAt: Type.Integer({ minimum: 0 }),
    updatedAt: Type.Integer({ minimum: 0 }),
    resolvedAt: Type.Optional(Type.Integer({ minimum: 0 })),
  },
  { additionalProperties: false },
);

export const GovernanceSovereigntyIncidentSummarySchema = Type.Object(
  {
    storagePath: NonEmptyString,
    total: Type.Integer({ minimum: 0 }),
    open: Type.Integer({ minimum: 0 }),
    resolved: Type.Integer({ minimum: 0 }),
    criticalOpen: Type.Integer({ minimum: 0 }),
    freezeActive: Type.Boolean(),
    activeIncidentIds: Type.Array(NonEmptyString),
    freezeIncidentIds: Type.Array(NonEmptyString),
    latestObservedAt: Type.Optional(Type.Integer({ minimum: 0 })),
    incidents: Type.Array(GovernanceSovereigntyIncidentRecordSchema),
    openedIds: Type.Array(NonEmptyString),
    reopenedIds: Type.Array(NonEmptyString),
    resolvedIds: Type.Array(NonEmptyString),
  },
  { additionalProperties: false },
);

export const GovernanceCharterAgentRecordSchema = Type.Object(
  {
    id: NonEmptyString,
    title: Type.Optional(NonEmptyString),
    layer: Type.Optional(NonEmptyString),
    class: Type.Optional(NonEmptyString),
    status: Type.Optional(NonEmptyString),
    missionPrimary: Type.Optional(NonEmptyString),
    successMetrics: Type.Array(NonEmptyString),
    canObserve: Type.Array(NonEmptyString),
    canDecide: Type.Array(NonEmptyString),
    cannotDecide: Type.Array(NonEmptyString),
    authorityLevel: Type.Optional(NonEmptyString),
    mutationAllow: Type.Array(NonEmptyString),
    mutationDeny: Type.Array(NonEmptyString),
    networkDefault: Type.Optional(NonEmptyString),
    networkConditions: Type.Array(NonEmptyString),
    resourceBudget: Type.Optional(
      Type.Object(
        {
          tokens: Type.Optional(NonEmptyString),
          parallelism: Type.Optional(NonEmptyString),
          runtime: Type.Optional(NonEmptyString),
        },
        { additionalProperties: false },
      ),
    ),
    worksWith: Type.Array(NonEmptyString),
    reportsTo: Type.Array(NonEmptyString),
    promotionRequirements: Type.Array(NonEmptyString),
    runtimeHooks: Type.Array(NonEmptyString),
    sourcePath: NonEmptyString,
    declaredCollaborators: Type.Array(NonEmptyString),
  },
  { additionalProperties: false },
);

export const GovernanceCharterTeamRecordSchema = Type.Object(
  {
    id: NonEmptyString,
    title: Type.Optional(NonEmptyString),
    layer: Type.Optional(NonEmptyString),
    class: Type.Optional(NonEmptyString),
    status: Type.Optional(NonEmptyString),
    members: Type.Array(NonEmptyString),
    sourcePath: NonEmptyString,
  },
  { additionalProperties: false },
);

export const GovernanceCharterRuntimeProfileRecordSchema = Type.Object(
  {
    name: Type.Optional(NonEmptyString),
    identityName: Type.Optional(NonEmptyString),
    subagentAllowAgents: Type.Array(NonEmptyString),
    requireAgentId: Type.Boolean(),
    executionContract: Type.Optional(
      Type.Union([Type.Literal("default"), Type.Literal("strict-agentic")]),
    ),
    contextLimits: Type.Optional(
      Type.Object(
        {
          memoryGetMaxChars: Type.Optional(Type.Integer({ minimum: 1 })),
          memoryGetDefaultLines: Type.Optional(Type.Integer({ minimum: 1 })),
          toolResultMaxChars: Type.Optional(Type.Integer({ minimum: 1 })),
          postCompactionMaxChars: Type.Optional(Type.Integer({ minimum: 1 })),
        },
        { additionalProperties: false },
      ),
    ),
    toolDeny: Type.Array(NonEmptyString),
    elevatedEnabled: Type.Optional(Type.Boolean()),
  },
  { additionalProperties: false },
);

export const GovernanceCharterCollaborationPolicySchema = Type.Object(
  {
    requesterAgentId: NonEmptyString,
    charterDeclared: Type.Boolean(),
    collaboratorAgentIds: Type.Array(NonEmptyString),
    allowedAgentIds: Type.Array(NonEmptyString),
  },
  { additionalProperties: false },
);

export const GovernanceOrganizationRecordSchema = Type.Object(
  {
    charterDir: NonEmptyString,
    discovered: Type.Boolean(),
    agentCount: Type.Integer({ minimum: 0 }),
    teamCount: Type.Integer({ minimum: 0 }),
    agents: Type.Array(GovernanceCharterAgentRecordSchema),
    teams: Type.Array(GovernanceCharterTeamRecordSchema),
  },
  { additionalProperties: false },
);

export const GovernanceProposalOperationSchema = Type.Object(
  {
    kind: Type.Union([Type.Literal("write"), Type.Literal("delete")]),
    path: NonEmptyString,
    content: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);

export const GovernanceProposalReviewRecordSchema = Type.Object(
  {
    decision: Type.Union([Type.Literal("approve"), Type.Literal("reject")]),
    decidedAt: Type.Integer({ minimum: 0 }),
    decidedBy: NonEmptyString,
    decisionNote: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);

export const GovernanceProposalApplyRecordSchema = Type.Object(
  {
    appliedAt: Type.Integer({ minimum: 0 }),
    appliedBy: NonEmptyString,
    writtenPaths: Type.Array(NonEmptyString),
    ledgerPath: Type.Optional(NonEmptyString),
    revertedAt: Type.Optional(Type.Integer({ minimum: 0 })),
    revertedBy: Type.Optional(NonEmptyString),
    restoredPaths: Type.Optional(Type.Array(NonEmptyString)),
  },
  { additionalProperties: false },
);

export const GovernanceProposalRecordSchema = Type.Object(
  {
    id: NonEmptyString,
    createdAt: Type.Integer({ minimum: 0 }),
    updatedAt: Type.Integer({ minimum: 0 }),
    createdByAgentId: Type.Optional(NonEmptyString),
    createdBySessionKey: Type.Optional(NonEmptyString),
    title: NonEmptyString,
    rationale: Type.Optional(Type.String()),
    status: Type.Union([
      Type.Literal("pending"),
      Type.Literal("approved"),
      Type.Literal("rejected"),
      Type.Literal("applied"),
    ]),
    operations: Type.Array(GovernanceProposalOperationSchema, { minItems: 1 }),
    review: Type.Optional(GovernanceProposalReviewRecordSchema),
    apply: Type.Optional(GovernanceProposalApplyRecordSchema),
  },
  { additionalProperties: false },
);

export const GovernanceProposalSummarySchema = Type.Object(
  {
    total: Type.Integer({ minimum: 0 }),
    pending: Type.Integer({ minimum: 0 }),
    approved: Type.Integer({ minimum: 0 }),
    rejected: Type.Integer({ minimum: 0 }),
    applied: Type.Integer({ minimum: 0 }),
    latestCreatedAt: Type.Optional(Type.Integer({ minimum: 0 })),
    latestUpdatedAt: Type.Optional(Type.Integer({ minimum: 0 })),
  },
  { additionalProperties: false },
);

export const GovernanceProposalLedgerSchema = Type.Composite([
  GovernanceProposalSummarySchema,
  Type.Object(
    {
      storageDir: NonEmptyString,
    },
    { additionalProperties: false },
  ),
]);

export const GovernanceProposalSynthesisItemSchema = Type.Object(
  {
    ruleId: NonEmptyString,
    findingIds: Type.Array(NonEmptyString),
    title: NonEmptyString,
    status: Type.Union([
      Type.Literal("created"),
      Type.Literal("existing"),
      Type.Literal("skipped"),
    ]),
    rationale: Type.Optional(Type.String()),
    operations: Type.Array(GovernanceProposalOperationSchema),
    dedupeKey: NonEmptyString,
    proposalId: Type.Optional(NonEmptyString),
    proposalStatus: Type.Optional(
      Type.Union([
        Type.Literal("pending"),
        Type.Literal("approved"),
        Type.Literal("rejected"),
        Type.Literal("applied"),
      ]),
    ),
    reason: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);

export const GovernanceProposalSynthesisResultSchema = Type.Object(
  {
    observedAt: Type.Integer({ minimum: 0 }),
    charterDir: NonEmptyString,
    requestedAgentIds: Type.Array(NonEmptyString),
    eligibleAgentIds: Type.Array(NonEmptyString),
    findingIds: Type.Array(NonEmptyString),
    results: Type.Array(GovernanceProposalSynthesisItemSchema),
    createdCount: Type.Integer({ minimum: 0 }),
    existingCount: Type.Integer({ minimum: 0 }),
    skippedCount: Type.Integer({ minimum: 0 }),
  },
  { additionalProperties: false },
);

export const GovernanceOverviewParamsSchema = Type.Object({}, { additionalProperties: false });

export const GovernanceOverviewResultSchema = Type.Object(
  {
    observedAt: Type.Integer({ minimum: 0 }),
    charterDir: NonEmptyString,
    discovered: Type.Boolean(),
    proposals: GovernanceProposalLedgerSchema,
    audit: Type.Object(
      {
        summary: GovernanceAuditSummarySchema,
        recentFacts: Type.Array(GovernanceAuditFactRecordSchema),
        recentGovernanceFacts: Type.Array(GovernanceAuditFactRecordSchema),
      },
      { additionalProperties: false },
    ),
    documents: Type.Object(
      {
        constitution: GovernanceCharterDocumentStatusSchema,
        sovereigntyPolicy: GovernanceCharterDocumentStatusSchema,
        evolutionPolicy: GovernanceCharterDocumentStatusSchema,
      },
      { additionalProperties: false },
    ),
    artifactPaths: Type.Array(NonEmptyString),
    missingArtifactPaths: Type.Array(NonEmptyString),
    reservedAuthorities: Type.Array(NonEmptyString),
    automaticEnforcementActions: Type.Array(NonEmptyString),
    freezeTargets: Type.Array(NonEmptyString),
    sovereignty: GovernanceSovereigntyIncidentSummarySchema,
    enforcement: GovernanceEnforcementSummarySchema,
    organization: GovernanceOrganizationRecordSchema,
    findings: Type.Array(GovernanceFindingSchema),
  },
  { additionalProperties: false },
);

export const GovernanceProposalsListParamsSchema = Type.Object(
  {
    status: Type.Optional(
      Type.Union([
        Type.Literal("pending"),
        Type.Literal("approved"),
        Type.Literal("rejected"),
        Type.Literal("applied"),
      ]),
    ),
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 200 })),
  },
  { additionalProperties: false },
);

export const GovernanceProposalsListResultSchema = Type.Object(
  {
    storageDir: NonEmptyString,
    summary: GovernanceProposalSummarySchema,
    proposals: Type.Array(GovernanceProposalRecordSchema),
  },
  { additionalProperties: false },
);

export const GovernanceProposalsSynthesizeParamsSchema = Type.Object(
  {
    agentIds: Type.Optional(Type.Array(NonEmptyString, { minItems: 1 })),
    workspaceDirs: Type.Optional(Type.Array(NonEmptyString, { minItems: 1 })),
  },
  { additionalProperties: false },
);

export const GovernanceProposalsSynthesizeResultSchema =
  GovernanceProposalSynthesisResultSchema;

export const GovernanceProposalsReconcileModeSchema = Type.Union([
  Type.Literal("apply_safe"),
  Type.Literal("force_apply_all"),
]);

const GovernanceProposalStatusSchema = Type.Union([
  Type.Literal("pending"),
  Type.Literal("approved"),
  Type.Literal("rejected"),
  Type.Literal("applied"),
]);

export const GovernanceProposalBatchSelectionSchema = Type.Object(
  {
    proposalIds: Type.Optional(Type.Array(NonEmptyString, { minItems: 1 })),
    status: Type.Optional(GovernanceProposalStatusSchema),
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 200 })),
    matchedProposalIds: Type.Array(NonEmptyString),
  },
  { additionalProperties: false },
);

export const GovernanceProposalBatchEntrySchema = Type.Object(
  {
    proposalId: NonEmptyString,
    ok: Type.Boolean(),
    title: Type.Optional(NonEmptyString),
    statusBefore: Type.Optional(GovernanceProposalStatusSchema),
    statusAfter: Type.Optional(GovernanceProposalStatusSchema),
    reason: Type.Optional(Type.String()),
    ledgerPath: Type.Optional(NonEmptyString),
    writtenPaths: Type.Optional(Type.Array(NonEmptyString)),
    restoredPaths: Type.Optional(Type.Array(NonEmptyString)),
  },
  { additionalProperties: false },
);

export const GovernanceProposalReconcileEntrySchema = Type.Object(
  {
    ruleId: NonEmptyString,
    title: NonEmptyString,
    findingIds: Type.Array(NonEmptyString),
    operations: Type.Array(GovernanceProposalOperationSchema),
    synthesisStatus: Type.Union([
      Type.Literal("created"),
      Type.Literal("existing"),
      Type.Literal("skipped"),
    ]),
    proposalId: Type.Optional(NonEmptyString),
    proposalStatusBefore: Type.Optional(GovernanceProposalStatusSchema),
    proposalStatusAfter: Type.Optional(GovernanceProposalStatusSchema),
    safe: Type.Boolean(),
    autoApproved: Type.Boolean(),
    autoApplied: Type.Boolean(),
    reason: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);

export const GovernanceProposalsReconcileParamsSchema = Type.Object(
  {
    agentIds: Type.Optional(Type.Array(NonEmptyString, { minItems: 1 })),
    workspaceDirs: Type.Optional(Type.Array(NonEmptyString, { minItems: 1 })),
    mode: Type.Optional(GovernanceProposalsReconcileModeSchema),
    createdByAgentId: Type.Optional(NonEmptyString),
    createdBySessionKey: Type.Optional(NonEmptyString),
    decidedBy: Type.Optional(NonEmptyString),
    decisionNote: Type.Optional(Type.String()),
    appliedBy: Type.Optional(NonEmptyString),
  },
  { additionalProperties: false },
);

export const GovernanceProposalsReconcileResultSchema = Type.Object(
  {
    observedAt: Type.Integer({ minimum: 0 }),
    charterDir: NonEmptyString,
    requestedAgentIds: Type.Array(NonEmptyString),
    eligibleAgentIds: Type.Array(NonEmptyString),
    findingIds: Type.Array(NonEmptyString),
    mode: GovernanceProposalsReconcileModeSchema,
    synthesized: GovernanceProposalSynthesisResultSchema,
    entries: Type.Array(GovernanceProposalReconcileEntrySchema),
    reviewedCount: Type.Integer({ minimum: 0 }),
    appliedCount: Type.Integer({ minimum: 0 }),
    skippedCount: Type.Integer({ minimum: 0 }),
  },
  { additionalProperties: false },
);

export const GovernanceProposalsCreateParamsSchema = Type.Object(
  {
    title: NonEmptyString,
    rationale: Type.Optional(Type.String()),
    createdByAgentId: Type.Optional(NonEmptyString),
    createdBySessionKey: Type.Optional(NonEmptyString),
    operations: Type.Array(GovernanceProposalOperationSchema, { minItems: 1 }),
  },
  { additionalProperties: false },
);

export const GovernanceProposalsCreateResultSchema = Type.Object(
  {
    storageDir: NonEmptyString,
    proposal: GovernanceProposalRecordSchema,
  },
  { additionalProperties: false },
);

export const GovernanceProposalsReviewParamsSchema = Type.Object(
  {
    proposalId: NonEmptyString,
    decision: Type.Union([Type.Literal("approve"), Type.Literal("reject")]),
    decidedBy: NonEmptyString,
    decisionNote: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);

export const GovernanceProposalsReviewResultSchema = Type.Object(
  {
    storageDir: NonEmptyString,
    proposal: GovernanceProposalRecordSchema,
  },
  { additionalProperties: false },
);

export const GovernanceProposalsReviewManyParamsSchema = Type.Object(
  {
    proposalIds: Type.Optional(Type.Array(NonEmptyString, { minItems: 1 })),
    status: Type.Optional(GovernanceProposalStatusSchema),
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 200 })),
    decision: Type.Union([Type.Literal("approve"), Type.Literal("reject")]),
    decidedBy: NonEmptyString,
    decisionNote: Type.Optional(Type.String()),
    continueOnError: Type.Optional(Type.Boolean()),
  },
  { additionalProperties: false },
);

export const GovernanceProposalsReviewManyResultSchema = Type.Object(
  {
    storageDir: NonEmptyString,
    selection: GovernanceProposalBatchSelectionSchema,
    decision: Type.Union([Type.Literal("approve"), Type.Literal("reject")]),
    reviewedCount: Type.Integer({ minimum: 0 }),
    failedCount: Type.Integer({ minimum: 0 }),
    stoppedEarly: Type.Boolean(),
    entries: Type.Array(GovernanceProposalBatchEntrySchema),
  },
  { additionalProperties: false },
);

export const GovernanceProposalsApplyParamsSchema = Type.Object(
  {
    proposalId: NonEmptyString,
    appliedBy: NonEmptyString,
  },
  { additionalProperties: false },
);

export const GovernanceProposalsApplyResultSchema = Type.Object(
  {
    storageDir: NonEmptyString,
    charterDir: NonEmptyString,
    ledgerPath: NonEmptyString,
    proposal: GovernanceProposalRecordSchema,
    writtenPaths: Type.Array(NonEmptyString),
  },
  { additionalProperties: false },
);

export const GovernanceProposalsApplyManyParamsSchema = Type.Object(
  {
    proposalIds: Type.Optional(Type.Array(NonEmptyString, { minItems: 1 })),
    status: Type.Optional(GovernanceProposalStatusSchema),
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 200 })),
    appliedBy: NonEmptyString,
    continueOnError: Type.Optional(Type.Boolean()),
  },
  { additionalProperties: false },
);

export const GovernanceProposalsApplyManyResultSchema = Type.Object(
  {
    storageDir: NonEmptyString,
    selection: GovernanceProposalBatchSelectionSchema,
    appliedCount: Type.Integer({ minimum: 0 }),
    failedCount: Type.Integer({ minimum: 0 }),
    stoppedEarly: Type.Boolean(),
    entries: Type.Array(GovernanceProposalBatchEntrySchema),
  },
  { additionalProperties: false },
);

export const GovernanceProposalsRevertParamsSchema = Type.Object(
  {
    proposalId: NonEmptyString,
    revertedBy: NonEmptyString,
  },
  { additionalProperties: false },
);

export const GovernanceProposalsRevertResultSchema = Type.Object(
  {
    storageDir: NonEmptyString,
    charterDir: NonEmptyString,
    ledgerPath: NonEmptyString,
    proposal: GovernanceProposalRecordSchema,
    restoredPaths: Type.Array(NonEmptyString),
  },
  { additionalProperties: false },
);

export const GovernanceProposalsRevertManyParamsSchema = Type.Object(
  {
    proposalIds: Type.Optional(Type.Array(NonEmptyString, { minItems: 1 })),
    status: Type.Optional(GovernanceProposalStatusSchema),
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 200 })),
    revertedBy: NonEmptyString,
    continueOnError: Type.Optional(Type.Boolean()),
  },
  { additionalProperties: false },
);

export const GovernanceProposalsRevertManyResultSchema = Type.Object(
  {
    storageDir: NonEmptyString,
    selection: GovernanceProposalBatchSelectionSchema,
    revertedCount: Type.Integer({ minimum: 0 }),
    failedCount: Type.Integer({ minimum: 0 }),
    stoppedEarly: Type.Boolean(),
    entries: Type.Array(GovernanceProposalBatchEntrySchema),
  },
  { additionalProperties: false },
);

export const GovernanceAgentParamsSchema = Type.Object(
  {
    agentId: NonEmptyString,
  },
  { additionalProperties: false },
);

export const GovernanceAgentResultSchema = Type.Object(
  {
    observedAt: Type.Integer({ minimum: 0 }),
    agentId: NonEmptyString,
    blueprint: Type.Optional(GovernanceCharterAgentRecordSchema),
    runtimeProfile: Type.Optional(GovernanceCharterRuntimeProfileRecordSchema),
    collaborationPolicy: GovernanceCharterCollaborationPolicySchema,
    contract: AgentGovernanceRuntimeContractSchema,
    runtimeSnapshot: Type.Optional(AgentGovernanceRuntimeSnapshotSchema),
    prompt: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);

export const GovernanceTeamMemberRecordSchema = Type.Object(
  {
    agentId: NonEmptyString,
    blueprint: Type.Optional(GovernanceCharterAgentRecordSchema),
    contract: AgentGovernanceRuntimeContractSchema,
    runtimeSnapshot: Type.Optional(AgentGovernanceRuntimeSnapshotSchema),
  },
  { additionalProperties: false },
);

export const GovernanceTeamParamsSchema = Type.Object(
  {
    teamId: NonEmptyString,
  },
  { additionalProperties: false },
);

export const GovernanceTeamResultSchema = Type.Object(
  {
    observedAt: Type.Integer({ minimum: 0 }),
    teamId: NonEmptyString,
    declared: Type.Boolean(),
    blueprint: Type.Optional(GovernanceCharterTeamRecordSchema),
    members: Type.Array(GovernanceTeamMemberRecordSchema),
    declaredMemberIds: Type.Array(NonEmptyString),
    missingMemberIds: Type.Array(NonEmptyString),
    runtimeHookCoverage: Type.Array(NonEmptyString),
    effectiveToolDeny: Type.Array(NonEmptyString),
    mutationAllow: Type.Array(NonEmptyString),
    mutationDeny: Type.Array(NonEmptyString),
    freezeActiveMemberIds: Type.Array(NonEmptyString),
  },
  { additionalProperties: false },
);

export const AgentSummarySchema = Type.Object(
  {
    id: NonEmptyString,
    name: Type.Optional(NonEmptyString),
    identity: Type.Optional(
      Type.Object(
        {
          name: Type.Optional(NonEmptyString),
          theme: Type.Optional(NonEmptyString),
          emoji: Type.Optional(NonEmptyString),
          avatar: Type.Optional(NonEmptyString),
          avatarUrl: Type.Optional(NonEmptyString),
        },
        { additionalProperties: false },
      ),
    ),
    workspace: Type.Optional(NonEmptyString),
    model: Type.Optional(
      Type.Object(
        {
          primary: Type.Optional(NonEmptyString),
          fallbacks: Type.Optional(Type.Array(NonEmptyString)),
        },
        { additionalProperties: false },
      ),
    ),
    configured: Type.Optional(Type.Boolean()),
    charterDeclared: Type.Optional(Type.Boolean()),
    charterTitle: Type.Optional(NonEmptyString),
    charterLayer: Type.Optional(NonEmptyString),
    governance: Type.Optional(ToolGovernanceSummarySchema),
    governanceContract: Type.Optional(AgentGovernanceRuntimeContractSchema),
  },
  { additionalProperties: false },
);

export const AgentsListParamsSchema = Type.Object({}, { additionalProperties: false });

export const AgentsListResultSchema = Type.Object(
  {
    defaultId: NonEmptyString,
    mainKey: NonEmptyString,
    scope: Type.Union([Type.Literal("per-sender"), Type.Literal("global")]),
    agents: Type.Array(AgentSummarySchema),
  },
  { additionalProperties: false },
);

export const AgentsCreateParamsSchema = Type.Object(
  {
    name: NonEmptyString,
    workspace: NonEmptyString,
    model: Type.Optional(NonEmptyString),
    emoji: Type.Optional(Type.String()),
    avatar: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);

export const AgentsCreateResultSchema = Type.Object(
  {
    ok: Type.Literal(true),
    agentId: NonEmptyString,
    name: NonEmptyString,
    workspace: NonEmptyString,
    model: Type.Optional(NonEmptyString),
  },
  { additionalProperties: false },
);

export const AgentsUpdateParamsSchema = Type.Object(
  {
    agentId: NonEmptyString,
    name: Type.Optional(NonEmptyString),
    workspace: Type.Optional(NonEmptyString),
    model: Type.Optional(NonEmptyString),
    emoji: Type.Optional(Type.String()),
    avatar: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);

export const AgentsUpdateResultSchema = Type.Object(
  {
    ok: Type.Literal(true),
    agentId: NonEmptyString,
  },
  { additionalProperties: false },
);

export const AgentsDeleteParamsSchema = Type.Object(
  {
    agentId: NonEmptyString,
    deleteFiles: Type.Optional(Type.Boolean()),
  },
  { additionalProperties: false },
);

export const AgentsDeleteResultSchema = Type.Object(
  {
    ok: Type.Literal(true),
    agentId: NonEmptyString,
    removedBindings: Type.Integer({ minimum: 0 }),
  },
  { additionalProperties: false },
);

export const AgentsFileEntrySchema = Type.Object(
  {
    name: NonEmptyString,
    path: NonEmptyString,
    missing: Type.Boolean(),
    size: Type.Optional(Type.Integer({ minimum: 0 })),
    updatedAtMs: Type.Optional(Type.Integer({ minimum: 0 })),
    content: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);

export const AgentsFilesListParamsSchema = Type.Object(
  {
    agentId: NonEmptyString,
  },
  { additionalProperties: false },
);

export const AgentsFilesListResultSchema = Type.Object(
  {
    agentId: NonEmptyString,
    workspace: NonEmptyString,
    files: Type.Array(AgentsFileEntrySchema),
  },
  { additionalProperties: false },
);

export const AgentsFilesGetParamsSchema = Type.Object(
  {
    agentId: NonEmptyString,
    name: NonEmptyString,
  },
  { additionalProperties: false },
);

export const AgentsFilesGetResultSchema = Type.Object(
  {
    agentId: NonEmptyString,
    workspace: NonEmptyString,
    file: AgentsFileEntrySchema,
  },
  { additionalProperties: false },
);

export const AgentsFilesSetParamsSchema = Type.Object(
  {
    agentId: NonEmptyString,
    name: NonEmptyString,
    content: Type.String(),
  },
  { additionalProperties: false },
);

export const AgentsFilesSetResultSchema = Type.Object(
  {
    ok: Type.Literal(true),
    agentId: NonEmptyString,
    workspace: NonEmptyString,
    file: AgentsFileEntrySchema,
  },
  { additionalProperties: false },
);

const TaskRuntimeSchema = Type.Union([
  Type.Literal("subagent"),
  Type.Literal("acp"),
  Type.Literal("cli"),
  Type.Literal("cron"),
]);

const TaskStatusSchema = Type.Union([
  Type.Literal("queued"),
  Type.Literal("running"),
  Type.Literal("succeeded"),
  Type.Literal("failed"),
  Type.Literal("timed_out"),
  Type.Literal("cancelled"),
  Type.Literal("lost"),
]);

const TaskDeliveryStatusSchema = Type.Union([
  Type.Literal("pending"),
  Type.Literal("delivered"),
  Type.Literal("session_queued"),
  Type.Literal("failed"),
  Type.Literal("parent_missing"),
  Type.Literal("not_applicable"),
]);

const TaskNotifyPolicySchema = Type.Union([
  Type.Literal("done_only"),
  Type.Literal("state_changes"),
  Type.Literal("silent"),
]);

const TaskScopeKindSchema = Type.Union([Type.Literal("session"), Type.Literal("system")]);
const TaskTerminalOutcomeSchema = Type.Union([
  Type.Literal("succeeded"),
  Type.Literal("blocked"),
]);
const TaskFlowStatusSchema = Type.Union([
  Type.Literal("queued"),
  Type.Literal("running"),
  Type.Literal("waiting"),
  Type.Literal("blocked"),
  Type.Literal("succeeded"),
  Type.Literal("failed"),
  Type.Literal("cancelled"),
  Type.Literal("lost"),
]);

const DeliveryContextSchema = Type.Object(
  {
    channel: Type.Optional(Type.String()),
    to: Type.Optional(Type.String()),
    accountId: Type.Optional(Type.String()),
    threadId: Type.Optional(Type.Union([Type.String(), Type.Number()])),
  },
  { additionalProperties: false },
);

export const SandboxUniverseTargetKindSchema = Type.Union([
  Type.Literal("capability"),
  Type.Literal("strategy"),
  Type.Literal("algorithm"),
  Type.Literal("organization"),
]);

export const SandboxUniverseExperimentStageIdSchema = Type.Union([
  Type.Literal("proposal"),
  Type.Literal("sandbox_validation"),
  Type.Literal("qa_replay"),
  Type.Literal("promotion_gate"),
]);

export const SandboxUniverseExperimentStageSchema = Type.Object(
  {
    id: SandboxUniverseExperimentStageIdSchema,
    title: NonEmptyString,
    status: Type.Union([Type.Literal("planned"), Type.Literal("blocked")]),
    requiredEvidence: Type.Array(NonEmptyString),
    blockers: Type.Array(NonEmptyString),
  },
  { additionalProperties: false },
);

export const SandboxUniverseReplayPlanSchema = Type.Object(
  {
    scenarios: Type.Array(NonEmptyString),
    workspaceDirs: Type.Array(NonEmptyString),
    requiredOutputs: Type.Array(NonEmptyString),
  },
  { additionalProperties: false },
);

export const SandboxUniversePromotionGatePreviewSchema = Type.Object(
  {
    freezeActive: Type.Boolean(),
    blockers: Type.Array(NonEmptyString),
    requiredEvidence: Type.Array(NonEmptyString),
  },
  { additionalProperties: false },
);

export const SandboxUniverseEvidenceArtifactStatusSchema = Type.Union([
  Type.Literal("planned"),
  Type.Literal("collected"),
  Type.Literal("failed"),
]);

export const SandboxUniverseEvidenceArtifactSchema = Type.Object(
  {
    id: NonEmptyString,
    status: SandboxUniverseEvidenceArtifactStatusSchema,
    producedByAgentId: Type.Optional(NonEmptyString),
    note: Type.Optional(Type.String()),
    observedAt: Type.Optional(Type.Integer({ minimum: 0 })),
    storagePath: Type.Optional(NonEmptyString),
    mediaType: Type.Optional(NonEmptyString),
    sizeBytes: Type.Optional(Type.Integer({ minimum: 0 })),
    sha256: Type.Optional(NonEmptyString),
  },
  { additionalProperties: false },
);

export const SandboxUniverseControllerStageStatusSchema = Type.Union([
  Type.Literal("planned"),
  Type.Literal("active"),
  Type.Literal("blocked"),
  Type.Literal("passed"),
  Type.Literal("failed"),
]);

export const SandboxUniverseControllerStageStateSchema = Type.Object(
  {
    id: SandboxUniverseExperimentStageIdSchema,
    title: NonEmptyString,
    status: SandboxUniverseControllerStageStatusSchema,
    requiredEvidence: Type.Array(NonEmptyString),
    blockers: Type.Array(NonEmptyString),
    startedAt: Type.Optional(Type.Integer({ minimum: 0 })),
    completedAt: Type.Optional(Type.Integer({ minimum: 0 })),
  },
  { additionalProperties: false },
);

export const SandboxUniverseExperimentTargetSchema = Type.Object(
  {
    kind: SandboxUniverseTargetKindSchema,
    id: NonEmptyString,
    title: NonEmptyString,
    focusGapIds: Type.Array(NonEmptyString),
    teamId: NonEmptyString,
  },
  { additionalProperties: false },
);

export const SandboxUniverseExperimentPlanSchema = Type.Object(
  {
    observedAt: Type.Integer({ minimum: 0 }),
    charterDir: NonEmptyString,
    workspaceDirs: Type.Array(NonEmptyString),
    universeId: NonEmptyString,
    requestedByAgentId: Type.Optional(NonEmptyString),
    target: SandboxUniverseExperimentTargetSchema,
    stages: Type.Array(SandboxUniverseExperimentStageSchema),
    replayPlan: SandboxUniverseReplayPlanSchema,
    promotionGate: SandboxUniversePromotionGatePreviewSchema,
  },
  { additionalProperties: false },
);

export const SandboxUniverseControllerStateSchema = Type.Object(
  {
    observedAt: Type.Integer({ minimum: 0 }),
    charterDir: NonEmptyString,
    universeId: NonEmptyString,
    target: SandboxUniverseExperimentTargetSchema,
    workspaceDirs: Type.Array(NonEmptyString),
    activeStageId: Type.Optional(SandboxUniverseExperimentStageIdSchema),
    blockers: Type.Array(NonEmptyString),
    evidence: Type.Array(SandboxUniverseEvidenceArtifactSchema),
    stages: Type.Array(SandboxUniverseControllerStageStateSchema),
    statePath: Type.Optional(NonEmptyString),
    artifactDir: Type.Optional(NonEmptyString),
  },
  { additionalProperties: false },
);

export const SandboxUniverseReplayRunnerLastRunSchema = Type.Object(
  {
    observedAt: Type.Integer({ minimum: 0 }),
    replayPassed: Type.Boolean(),
    qaPassed: Type.Boolean(),
    auditPassed: Type.Boolean(),
    canPromote: Type.Boolean(),
  },
  { additionalProperties: false },
);

export const SandboxUniversePromotionGateDecisionSchema = Type.Object(
  {
    observedAt: Type.Integer({ minimum: 0 }),
    charterDir: NonEmptyString,
    universeId: NonEmptyString,
    target: SandboxUniverseExperimentTargetSchema,
    qaPassed: Type.Boolean(),
    replayPassed: Type.Boolean(),
    auditPassed: Type.Boolean(),
    freezeActive: Type.Boolean(),
    blockers: Type.Array(NonEmptyString),
    requiredEvidence: Type.Array(NonEmptyString),
    canPromote: Type.Boolean(),
  },
  { additionalProperties: false },
);

export const SandboxUniverseReplayRunnerStateSchema = Type.Object(
  {
    observedAt: Type.Integer({ minimum: 0 }),
    charterDir: NonEmptyString,
    universeId: NonEmptyString,
    status: Type.Union([
      Type.Literal("ready"),
      Type.Literal("passed"),
      Type.Literal("failed"),
    ]),
    scenarios: Type.Array(NonEmptyString),
    workspaceDirs: Type.Array(NonEmptyString),
    requiredOutputs: Type.Array(NonEmptyString),
    producedByAgentId: Type.Optional(NonEmptyString),
    blockers: Type.Array(NonEmptyString),
    lastRun: Type.Optional(SandboxUniverseReplayRunnerLastRunSchema),
    statePath: Type.Optional(NonEmptyString),
    artifactDir: Type.Optional(NonEmptyString),
  },
  { additionalProperties: false },
);

const ManagedTaskFlowExecutionGraphNodeSchema = Type.Object(
  {
    id: NonEmptyString,
    title: NonEmptyString,
    dependsOn: Type.Array(NonEmptyString),
    output: NonEmptyString,
  },
  { additionalProperties: false },
);

const ManagedTaskFlowExecutionCapabilityRequestSchema = Type.Object(
  {
    status: Type.Union([
      Type.Literal("required"),
      Type.Literal("recommended"),
      Type.Literal("not_needed"),
    ]),
    focusGapIds: Type.Array(NonEmptyString),
    handoffTeamId: NonEmptyString,
    reason: NonEmptyString,
    blockers: Type.Array(NonEmptyString),
  },
  { additionalProperties: false },
);

const ManagedTaskFlowGenesisStageRuntimeSchema = Type.Object(
  {
    kind: Type.Literal("genesis_stage"),
    teamId: NonEmptyString,
    teamTitle: Type.Optional(Type.Union([NonEmptyString, Type.Null()])),
    mode: Type.Union([
      Type.Literal("repair"),
      Type.Literal("build"),
      Type.Literal("steady_state"),
    ]),
    stage: Type.Object(
      {
        id: NonEmptyString,
        title: NonEmptyString,
        ownerAgentId: NonEmptyString,
        status: Type.Union([
          Type.Literal("ready"),
          Type.Literal("waiting"),
          Type.Literal("blocked"),
        ]),
        goal: NonEmptyString,
        dependsOn: Type.Array(NonEmptyString),
        inputRefs: Type.Array(NonEmptyString),
        outputRefs: Type.Array(NonEmptyString),
        actions: Type.Array(NonEmptyString),
        rationale: Type.Optional(Type.Union([Type.String(), Type.Null()])),
      },
      { additionalProperties: false },
    ),
    focusGapIds: Type.Array(NonEmptyString),
    blockers: Type.Array(NonEmptyString),
    stageGraph: Type.Array(
      Type.Object(
        {
          id: NonEmptyString,
          title: NonEmptyString,
          ownerAgentId: NonEmptyString,
          status: Type.Union([
            Type.Literal("ready"),
            Type.Literal("waiting"),
            Type.Literal("blocked"),
          ]),
          dependsOn: Type.Array(NonEmptyString),
        },
        { additionalProperties: false },
      ),
    ),
    sandboxUniverse: SandboxUniverseExperimentPlanSchema,
    sandboxController: Type.Optional(SandboxUniverseControllerStateSchema),
    sandboxReplayRunner: Type.Optional(SandboxUniverseReplayRunnerStateSchema),
  },
  { additionalProperties: false },
);

const ManagedTaskFlowExecutionSystemRuntimeSchema = Type.Object(
  {
    kind: Type.Literal("execution_system"),
    goalContract: Type.Object(
      {
        goal: NonEmptyString,
        layer: Type.Optional(Type.Union([NonEmptyString, Type.Null()])),
        authorityLevel: Type.Optional(Type.Union([NonEmptyString, Type.Null()])),
      },
      { additionalProperties: false },
    ),
    taskGraph: Type.Array(ManagedTaskFlowExecutionGraphNodeSchema),
    executionPlan: Type.Object(
      {
        phases: Type.Array(ManagedTaskFlowExecutionGraphNodeSchema),
        runtimeHooks: Type.Array(NonEmptyString),
        collaborators: Type.Array(NonEmptyString),
      },
      { additionalProperties: false },
    ),
    capabilityRequest: ManagedTaskFlowExecutionCapabilityRequestSchema,
    observedCapabilityGaps: Type.Array(NonEmptyString),
    genesisPlan: Type.Object(
      {
        teamId: NonEmptyString,
        mode: Type.Union([
          Type.Literal("repair"),
          Type.Literal("build"),
          Type.Literal("steady_state"),
        ]),
        focusGapIds: Type.Array(NonEmptyString),
        blockers: Type.Array(NonEmptyString),
      },
      { additionalProperties: false },
    ),
    sandboxUniverse: Type.Optional(SandboxUniverseExperimentPlanSchema),
    sandboxController: Type.Optional(SandboxUniverseControllerStateSchema),
    sandboxReplayRunner: Type.Optional(SandboxUniverseReplayRunnerStateSchema),
  },
  { additionalProperties: false },
);

const ManagedTaskFlowAlgorithmResearchRuntimeSchema = Type.Object(
  {
    kind: Type.Literal("algorithm_research"),
    focusGapIds: Type.Array(NonEmptyString),
    observedAlgorithmGaps: Type.Array(NonEmptyString),
    inventorySummary: Type.Object(
      {
        gapCount: Type.Integer({ minimum: 0 }),
        criticalGapCount: Type.Integer({ minimum: 0 }),
        algorithmCount: Type.Integer({ minimum: 0 }),
        algorithmReady: Type.Integer({ minimum: 0 }),
        algorithmAttention: Type.Integer({ minimum: 0 }),
        algorithmBlocked: Type.Integer({ minimum: 0 }),
      },
      { additionalProperties: false },
    ),
    researchPlan: Type.Object(
      {
        phases: Type.Array(ManagedTaskFlowExecutionGraphNodeSchema),
        targetDomains: Type.Array(NonEmptyString),
        runtimeHooks: Type.Array(NonEmptyString),
        collaborators: Type.Array(NonEmptyString),
      },
      { additionalProperties: false },
    ),
    promotionPolicy: Type.Object(
      {
        requiredEvidence: Type.Array(NonEmptyString),
        blockers: Type.Array(NonEmptyString),
      },
      { additionalProperties: false },
    ),
    sandboxUniverse: Type.Optional(SandboxUniverseExperimentPlanSchema),
    sandboxController: Type.Optional(SandboxUniverseControllerStateSchema),
    sandboxReplayRunner: Type.Optional(SandboxUniverseReplayRunnerStateSchema),
  },
  { additionalProperties: false },
);

const ManagedTaskFlowSovereigntyWatchRuntimeSchema = Type.Object(
  {
    kind: Type.Literal("sovereignty_watch"),
    governanceOverview: Type.Object(
      {
        discovered: Type.Boolean(),
        missingArtifactCount: Type.Integer({ minimum: 0 }),
        findingCount: Type.Integer({ minimum: 0 }),
        proposalPendingCount: Type.Integer({ minimum: 0 }),
        enforcementActive: Type.Boolean(),
        freezeReasonCode: Type.Optional(Type.Union([NonEmptyString, Type.Null()])),
      },
      { additionalProperties: false },
    ),
    watchPlan: Type.Object(
      {
        phases: Type.Array(ManagedTaskFlowExecutionGraphNodeSchema),
        reservedAuthorities: Type.Array(NonEmptyString),
        freezeTargets: Type.Array(NonEmptyString),
      },
      { additionalProperties: false },
    ),
    incidentPolicy: Type.Object(
      {
        automaticEnforcementActions: Type.Array(NonEmptyString),
        criticalFindings: Type.Array(NonEmptyString),
      },
      { additionalProperties: false },
    ),
  },
  { additionalProperties: false },
);

const ManagedTaskFlowAutonomyProjectRuntimeSchema = Type.Union([
  ManagedTaskFlowGenesisStageRuntimeSchema,
  ManagedTaskFlowExecutionSystemRuntimeSchema,
  ManagedTaskFlowAlgorithmResearchRuntimeSchema,
  ManagedTaskFlowSovereigntyWatchRuntimeSchema,
]);

const ManagedTaskFlowAutonomyRuntimeStateSchema = Type.Object(
  {
    agentId: NonEmptyString,
    controllerId: NonEmptyString,
    goal: NonEmptyString,
    currentStep: Type.Optional(NonEmptyString),
    workspaceDirs: Type.Array(NonEmptyString),
    primaryWorkspaceDir: Type.Optional(NonEmptyString),
    project: Type.Optional(ManagedTaskFlowAutonomyProjectRuntimeSchema),
  },
  { additionalProperties: false },
);

const TaskRunAggregateSummarySchema = Type.Object(
  {
    total: Type.Integer({ minimum: 0 }),
    active: Type.Integer({ minimum: 0 }),
    terminal: Type.Integer({ minimum: 0 }),
    failures: Type.Integer({ minimum: 0 }),
    byStatus: Type.Object(
      {
        queued: Type.Integer({ minimum: 0 }),
        running: Type.Integer({ minimum: 0 }),
        succeeded: Type.Integer({ minimum: 0 }),
        failed: Type.Integer({ minimum: 0 }),
        timed_out: Type.Integer({ minimum: 0 }),
        cancelled: Type.Integer({ minimum: 0 }),
        lost: Type.Integer({ minimum: 0 }),
      },
      { additionalProperties: false },
    ),
    byRuntime: Type.Object(
      {
        subagent: Type.Integer({ minimum: 0 }),
        acp: Type.Integer({ minimum: 0 }),
        cli: Type.Integer({ minimum: 0 }),
        cron: Type.Integer({ minimum: 0 }),
      },
      { additionalProperties: false },
    ),
  },
  { additionalProperties: false },
);

const TaskRunDetailSchema = Type.Object(
  {
    id: NonEmptyString,
    runtime: TaskRuntimeSchema,
    sourceId: Type.Optional(NonEmptyString),
    sessionKey: NonEmptyString,
    ownerKey: NonEmptyString,
    scope: TaskScopeKindSchema,
    childSessionKey: Type.Optional(NonEmptyString),
    flowId: Type.Optional(NonEmptyString),
    parentTaskId: Type.Optional(NonEmptyString),
    agentId: Type.Optional(NonEmptyString),
    runId: Type.Optional(NonEmptyString),
    governanceRuntime: Type.Optional(AgentGovernanceRuntimeSnapshotSchema),
    label: Type.Optional(Type.String()),
    title: NonEmptyString,
    status: TaskStatusSchema,
    deliveryStatus: TaskDeliveryStatusSchema,
    notifyPolicy: TaskNotifyPolicySchema,
    createdAt: Type.Integer({ minimum: 0 }),
    startedAt: Type.Optional(Type.Integer({ minimum: 0 })),
    endedAt: Type.Optional(Type.Integer({ minimum: 0 })),
    lastEventAt: Type.Optional(Type.Integer({ minimum: 0 })),
    cleanupAfter: Type.Optional(Type.Integer({ minimum: 0 })),
    error: Type.Optional(Type.String()),
    progressSummary: Type.Optional(Type.String()),
    terminalSummary: Type.Optional(Type.String()),
    terminalOutcome: Type.Optional(TaskTerminalOutcomeSchema),
  },
  { additionalProperties: false },
);

const TaskFlowDetailSchema = Type.Object(
  {
    id: NonEmptyString,
    ownerKey: NonEmptyString,
    requesterOrigin: Type.Optional(DeliveryContextSchema),
    status: TaskFlowStatusSchema,
    notifyPolicy: TaskNotifyPolicySchema,
    goal: NonEmptyString,
    currentStep: Type.Optional(NonEmptyString),
    cancelRequestedAt: Type.Optional(Type.Integer({ minimum: 0 })),
    createdAt: Type.Integer({ minimum: 0 }),
    updatedAt: Type.Integer({ minimum: 0 }),
    endedAt: Type.Optional(Type.Integer({ minimum: 0 })),
    state: Type.Optional(Type.Unknown()),
    wait: Type.Optional(Type.Unknown()),
    managedAutonomy: Type.Optional(ManagedTaskFlowAutonomyRuntimeStateSchema),
    managedExecution: Type.Optional(ManagedTaskFlowExecutionSystemRuntimeSchema),
    blocked: Type.Optional(
      Type.Object(
        {
          taskId: Type.Optional(NonEmptyString),
          summary: Type.Optional(Type.String()),
        },
        { additionalProperties: false },
      ),
    ),
    tasks: Type.Array(TaskRunDetailSchema),
    taskSummary: TaskRunAggregateSummarySchema,
  },
  { additionalProperties: false },
);

const AutonomyLoopJobSnapshotSchema = Type.Object(
  {
    agentId: NonEmptyString,
    mode: Type.Literal("managed-flow"),
    job: CronJobSchema,
    workspaceDirs: Type.Optional(Type.Array(NonEmptyString)),
    primaryWorkspaceDir: Type.Optional(NonEmptyString),
  },
  { additionalProperties: false },
);

export const AutonomySeedTaskTemplateSchema = Type.Object(
  {
    runtime: TaskRuntimeSchema,
    label: NonEmptyString,
    task: NonEmptyString,
    status: Type.Union([Type.Literal("queued"), Type.Literal("running")]),
    progressSummary: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);

export const AutonomyLoopTemplateSchema = Type.Object(
  {
    mode: Type.Literal("managed-flow"),
    name: NonEmptyString,
    description: NonEmptyString,
    schedule: Type.Object(
      {
        kind: Type.Literal("every"),
        everyMs: Type.Integer({ minimum: 1 }),
      },
      { additionalProperties: false },
    ),
    sessionTarget: Type.Literal("isolated"),
    wakeMode: Type.Literal("now"),
    message: NonEmptyString,
  },
  { additionalProperties: false },
);

export const AutonomyBootstrapTemplateSchema = Type.Object(
  {
    controllerId: NonEmptyString,
    defaultGoal: NonEmptyString,
    defaultCurrentStep: NonEmptyString,
    recommendedGoals: Type.Array(NonEmptyString),
    seedTask: AutonomySeedTaskTemplateSchema,
    loop: AutonomyLoopTemplateSchema,
  },
  { additionalProperties: false },
);

export const AutonomyAgentProfileSchema = Type.Object(
  {
    id: NonEmptyString,
    name: Type.Optional(NonEmptyString),
    layer: Type.Optional(NonEmptyString),
    missionPrimary: Type.Optional(NonEmptyString),
    authorityLevel: Type.Optional(NonEmptyString),
    collaborators: Type.Array(NonEmptyString),
    reportsTo: Type.Array(NonEmptyString),
    mutationAllow: Type.Array(NonEmptyString),
    mutationDeny: Type.Array(NonEmptyString),
    networkDefault: Type.Optional(NonEmptyString),
    networkConditions: Type.Array(NonEmptyString),
    runtimeHooks: Type.Array(NonEmptyString),
    resourceBudget: Type.Optional(
      Type.Object(
        {
          tokens: Type.Optional(NonEmptyString),
          parallelism: Type.Optional(NonEmptyString),
          runtime: Type.Optional(NonEmptyString),
        },
        { additionalProperties: false },
      ),
    ),
    contract: AgentGovernanceRuntimeContractSchema,
    bootstrap: AutonomyBootstrapTemplateSchema,
  },
  { additionalProperties: false },
);

export const AutonomyFleetHistorySourceSchema = Type.Union([
  Type.Literal("manual"),
  Type.Literal("startup"),
  Type.Literal("supervisor"),
]);

export const AutonomyFleetHistoryModeSchema = Type.Union([
  Type.Literal("heal"),
  Type.Literal("reconcile"),
]);

export const AutonomyFleetHistoryTotalsSchema = Type.Object(
  {
    totalProfiles: Type.Integer({ minimum: 0 }),
    changed: Type.Integer({ minimum: 0 }),
    unchanged: Type.Integer({ minimum: 0 }),
    loopCreated: Type.Integer({ minimum: 0 }),
    loopUpdated: Type.Integer({ minimum: 0 }),
    flowStarted: Type.Integer({ minimum: 0 }),
    flowRestarted: Type.Integer({ minimum: 0 }),
  },
  { additionalProperties: false },
);

export const AutonomyFleetHistoryEntrySchema = Type.Object(
  {
    agentId: NonEmptyString,
    changed: Type.Boolean(),
    healthBefore: Type.Optional(
      Type.Union([
        Type.Literal("healthy"),
        Type.Literal("idle"),
        Type.Literal("drift"),
        Type.Literal("missing_loop"),
      ]),
    ),
    healthAfter: Type.Optional(
      Type.Union([
        Type.Literal("healthy"),
        Type.Literal("idle"),
        Type.Literal("drift"),
        Type.Literal("missing_loop"),
      ]),
    ),
    loopAction: Type.Optional(
      Type.Union([Type.Literal("none"), Type.Literal("created"), Type.Literal("updated")]),
    ),
    flowAction: Type.Optional(
      Type.Union([Type.Literal("none"), Type.Literal("started"), Type.Literal("restarted")]),
    ),
    workspaceDirs: Type.Optional(Type.Array(NonEmptyString)),
    primaryWorkspaceDir: Type.Optional(NonEmptyString),
    reasons: Type.Array(Type.String()),
    latestFlowIdBefore: Type.Optional(NonEmptyString),
    latestFlowIdAfter: Type.Optional(NonEmptyString),
    latestFlowStatusBefore: Type.Optional(NonEmptyString),
    latestFlowStatusAfter: Type.Optional(NonEmptyString),
    latestSeedTaskStatusBefore: Type.Optional(NonEmptyString),
    latestSeedTaskStatusAfter: Type.Optional(NonEmptyString),
    startedFlowId: Type.Optional(NonEmptyString),
    cancelledFlowId: Type.Optional(NonEmptyString),
  },
  { additionalProperties: false },
);

export const AutonomyFleetHistoryEventSchema = Type.Object(
  {
    eventId: NonEmptyString,
    ts: Type.Integer({ minimum: 0 }),
    sessionKey: NonEmptyString,
    mode: AutonomyFleetHistoryModeSchema,
    source: AutonomyFleetHistorySourceSchema,
    agentIds: Type.Array(NonEmptyString),
    workspaceDirs: Type.Optional(Type.Array(NonEmptyString)),
    primaryWorkspaceDir: Type.Optional(NonEmptyString),
    changed: Type.Boolean(),
    totals: AutonomyFleetHistoryTotalsSchema,
    entries: Type.Array(AutonomyFleetHistoryEntrySchema),
  },
  { additionalProperties: false },
);

export const AutonomyListParamsSchema = Type.Object(
  {
    sessionKey: Type.Optional(NonEmptyString),
  },
  { additionalProperties: false },
);

export const AutonomyOverviewParamsSchema = Type.Object(
  {
    sessionKey: Type.Optional(NonEmptyString),
    agentIds: Type.Optional(Type.Array(NonEmptyString, { minItems: 1 })),
    workspaceDirs: Type.Optional(Type.Array(NonEmptyString, { minItems: 1 })),
  },
  { additionalProperties: false },
);

export const AutonomyFleetStatusHealthSchema = Type.Union([
  Type.Literal("healthy"),
  Type.Literal("idle"),
  Type.Literal("drift"),
  Type.Literal("missing_loop"),
]);

export const AutonomyFleetStatusSuggestedActionSchema = Type.Union([
  Type.Literal("observe"),
  Type.Literal("start_flow"),
  Type.Literal("inspect_flow"),
  Type.Literal("reconcile_loop"),
]);

export const AutonomyFleetStatusEntrySchema = Type.Object(
  {
    agentId: NonEmptyString,
    profile: AutonomyAgentProfileSchema,
    latestFlow: Type.Optional(TaskFlowDetailSchema),
    latestSeedTask: Type.Optional(TaskRunDetailSchema),
    loopJob: Type.Optional(AutonomyLoopJobSnapshotSchema),
    workspaceDirs: Type.Optional(Type.Array(NonEmptyString)),
    primaryWorkspaceDir: Type.Optional(NonEmptyString),
    duplicateLoopCount: Type.Integer({ minimum: 0 }),
    expectedLoopEveryMs: Type.Integer({ minimum: 1 }),
    actualLoopEveryMs: Type.Optional(Type.Integer({ minimum: 1 })),
    loopCadenceAligned: Type.Boolean(),
    hasActiveFlow: Type.Boolean(),
    driftReasons: Type.Array(Type.String()),
    suggestedAction: AutonomyFleetStatusSuggestedActionSchema,
    health: AutonomyFleetStatusHealthSchema,
  },
  { additionalProperties: false },
);

export const AutonomyFleetStatusResultSchema = Type.Object(
  {
    entries: Type.Array(AutonomyFleetStatusEntrySchema),
    totals: Type.Object(
      {
        totalProfiles: Type.Integer({ minimum: 0 }),
        healthy: Type.Integer({ minimum: 0 }),
        idle: Type.Integer({ minimum: 0 }),
        drift: Type.Integer({ minimum: 0 }),
        missingLoop: Type.Integer({ minimum: 0 }),
        activeFlows: Type.Integer({ minimum: 0 }),
      },
      { additionalProperties: false },
    ),
  },
  { additionalProperties: false },
);

export const AutonomyHealParamsSchema = Type.Object(
  {
    sessionKey: Type.Optional(NonEmptyString),
    agentIds: Type.Optional(Type.Array(NonEmptyString, { minItems: 1 })),
    workspaceDirs: Type.Optional(Type.Array(NonEmptyString, { minItems: 1 })),
  },
  { additionalProperties: false },
);

export const AutonomyFleetHealLoopActionSchema = Type.Union([
  Type.Literal("none"),
  Type.Literal("created"),
  Type.Literal("updated"),
]);

export const AutonomyFleetHealFlowActionSchema = Type.Union([
  Type.Literal("none"),
  Type.Literal("started"),
  Type.Literal("restarted"),
]);

export const AutonomyFleetHealEntrySchema = Type.Object(
  {
    agentId: NonEmptyString,
    profile: AutonomyAgentProfileSchema,
    healthBefore: AutonomyFleetStatusHealthSchema,
    healthAfter: AutonomyFleetStatusHealthSchema,
    loopAction: AutonomyFleetHealLoopActionSchema,
    flowAction: AutonomyFleetHealFlowActionSchema,
    workspaceDirs: Type.Optional(Type.Array(NonEmptyString)),
    primaryWorkspaceDir: Type.Optional(NonEmptyString),
    latestFlowBefore: Type.Optional(TaskFlowDetailSchema),
    latestFlowAfter: Type.Optional(TaskFlowDetailSchema),
    latestSeedTaskBefore: Type.Optional(TaskRunDetailSchema),
    latestSeedTaskAfter: Type.Optional(TaskRunDetailSchema),
    loopBefore: Type.Optional(AutonomyLoopJobSnapshotSchema),
    loopAfter: Type.Optional(AutonomyLoopJobSnapshotSchema),
    cancelledFlowBeforeRestart: Type.Optional(TaskFlowDetailSchema),
    cancelledSeedTaskBeforeRestart: Type.Optional(TaskRunDetailSchema),
    startedFlow: Type.Optional(TaskFlowDetailSchema),
    startedSeedTask: Type.Optional(TaskRunDetailSchema),
    reasons: Type.Array(Type.String()),
  },
  { additionalProperties: false },
);

export const AutonomyFleetHealResultSchema = Type.Object(
  {
    entries: Type.Array(AutonomyFleetHealEntrySchema),
    totals: AutonomyFleetHistoryTotalsSchema,
    governanceProposals: Type.Optional(GovernanceProposalSynthesisResultSchema),
  },
  { additionalProperties: false },
);

export const AutonomySupervisorGovernanceModeSchema = Type.Union([
  Type.Literal("none"),
  Type.Literal("apply_safe"),
  Type.Literal("force_apply_all"),
]);

export const AutonomySuperviseParamsSchema = Type.Object(
  {
    sessionKey: Type.Optional(NonEmptyString),
    agentIds: Type.Optional(Type.Array(NonEmptyString, { minItems: 1 })),
    workspaceDirs: Type.Optional(Type.Array(NonEmptyString, { minItems: 1 })),
    teamId: Type.Optional(NonEmptyString),
    restartBlockedFlows: Type.Optional(Type.Boolean()),
    governanceMode: Type.Optional(AutonomySupervisorGovernanceModeSchema),
    decisionNote: Type.Optional(Type.String()),
    includeCapabilityInventory: Type.Optional(Type.Boolean()),
    includeGenesisPlan: Type.Optional(Type.Boolean()),
    recordHistory: Type.Optional(Type.Boolean()),
  },
  { additionalProperties: false },
);

export const AutonomyHistoryParamsSchema = Type.Object(
  {
    sessionKey: Type.Optional(NonEmptyString),
    agentIds: Type.Optional(Type.Array(NonEmptyString, { minItems: 1 })),
    workspaceDirs: Type.Optional(Type.Array(NonEmptyString, { minItems: 1 })),
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 200 })),
    mode: Type.Optional(AutonomyFleetHistoryModeSchema),
    source: Type.Optional(AutonomyFleetHistorySourceSchema),
  },
  { additionalProperties: false },
);

export const AutonomyFleetHistoryResultSchema = Type.Object(
  {
    events: Type.Array(AutonomyFleetHistoryEventSchema),
    total: Type.Integer({ minimum: 0 }),
    truncated: Type.Boolean(),
  },
  { additionalProperties: false },
);

export const AutonomyGovernanceProposalItemSchema = GovernanceProposalSynthesisItemSchema;

export const AutonomyGovernanceProposalsParamsSchema = Type.Object(
  {
    sessionKey: Type.Optional(NonEmptyString),
    agentIds: Type.Optional(Type.Array(NonEmptyString, { minItems: 1 })),
    workspaceDirs: Type.Optional(Type.Array(NonEmptyString, { minItems: 1 })),
  },
  { additionalProperties: false },
);

export const AutonomyGovernanceProposalsResultSchema = GovernanceProposalSynthesisResultSchema;

export const AutonomyGovernanceReconcileParamsSchema = Type.Object(
  {
    sessionKey: Type.Optional(NonEmptyString),
    agentIds: Type.Optional(Type.Array(NonEmptyString, { minItems: 1 })),
    workspaceDirs: Type.Optional(Type.Array(NonEmptyString, { minItems: 1 })),
    mode: Type.Optional(GovernanceProposalsReconcileModeSchema),
    decisionNote: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);

export const AutonomyGovernanceReconcileResultSchema =
  GovernanceProposalsReconcileResultSchema;

export const AutonomyCapabilityInventoryEntryActivationSchema = Type.Object(
  {
    enabled: Type.Boolean(),
    activated: Type.Boolean(),
    explicitlyEnabled: Type.Boolean(),
    source: Type.Union([
      Type.Literal("disabled"),
      Type.Literal("explicit"),
      Type.Literal("auto"),
      Type.Literal("default"),
    ]),
    reason: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);

export const AutonomyCapabilityInventoryEntrySchema = Type.Object(
  {
    id: NonEmptyString,
    kind: Type.Union([
      Type.Literal("skill"),
      Type.Literal("plugin"),
      Type.Literal("memory"),
      Type.Literal("strategy"),
      Type.Literal("algorithm"),
      Type.Literal("agent_blueprint"),
      Type.Literal("team_blueprint"),
    ]),
    status: Type.Union([
      Type.Literal("ready"),
      Type.Literal("attention"),
      Type.Literal("blocked"),
    ]),
    title: NonEmptyString,
    description: Type.Optional(Type.String()),
    layer: Type.Optional(NonEmptyString),
    ownerAgentId: Type.Optional(NonEmptyString),
    sourcePath: Type.Optional(NonEmptyString),
    workspaceDir: Type.Optional(NonEmptyString),
    origin: Type.Optional(NonEmptyString),
    activation: Type.Optional(AutonomyCapabilityInventoryEntryActivationSchema),
    coverage: Type.Array(NonEmptyString),
    dependencies: Type.Array(NonEmptyString),
    issues: Type.Array(Type.String()),
    installOptions: Type.Array(NonEmptyString),
  },
  { additionalProperties: false },
);

export const AutonomyCapabilityGapSchema = Type.Object(
  {
    id: NonEmptyString,
    severity: Type.Union([
      Type.Literal("critical"),
      Type.Literal("warning"),
      Type.Literal("info"),
    ]),
    title: NonEmptyString,
    detail: NonEmptyString,
    ownerAgentId: Type.Optional(NonEmptyString),
    relatedEntryIds: Type.Array(NonEmptyString),
    suggestedActions: Type.Array(NonEmptyString),
  },
  { additionalProperties: false },
);

export const AutonomyCapabilityInventorySummarySchema = Type.Object(
  {
    totalEntries: Type.Integer({ minimum: 0 }),
    skillCount: Type.Integer({ minimum: 0 }),
    skillReady: Type.Integer({ minimum: 0 }),
    skillAttention: Type.Integer({ minimum: 0 }),
    skillBlocked: Type.Integer({ minimum: 0 }),
    pluginCount: Type.Integer({ minimum: 0 }),
    pluginActivated: Type.Integer({ minimum: 0 }),
    pluginAttention: Type.Integer({ minimum: 0 }),
    pluginBlocked: Type.Integer({ minimum: 0 }),
    memoryCount: Type.Optional(Type.Integer({ minimum: 0 })),
    memoryReady: Type.Optional(Type.Integer({ minimum: 0 })),
    memoryAttention: Type.Optional(Type.Integer({ minimum: 0 })),
    memoryBlocked: Type.Optional(Type.Integer({ minimum: 0 })),
    strategyCount: Type.Optional(Type.Integer({ minimum: 0 })),
    strategyReady: Type.Optional(Type.Integer({ minimum: 0 })),
    strategyAttention: Type.Optional(Type.Integer({ minimum: 0 })),
    strategyBlocked: Type.Optional(Type.Integer({ minimum: 0 })),
    algorithmCount: Type.Optional(Type.Integer({ minimum: 0 })),
    algorithmReady: Type.Optional(Type.Integer({ minimum: 0 })),
    algorithmAttention: Type.Optional(Type.Integer({ minimum: 0 })),
    algorithmBlocked: Type.Optional(Type.Integer({ minimum: 0 })),
    agentBlueprintCount: Type.Integer({ minimum: 0 }),
    teamBlueprintCount: Type.Integer({ minimum: 0 }),
    autonomyProfileCount: Type.Integer({ minimum: 0 }),
    genesisMemberCount: Type.Integer({ minimum: 0 }),
    gapCount: Type.Integer({ minimum: 0 }),
    criticalGapCount: Type.Integer({ minimum: 0 }),
    warningGapCount: Type.Integer({ minimum: 0 }),
    infoGapCount: Type.Integer({ minimum: 0 }),
  },
  { additionalProperties: false },
);

export const AutonomyCapabilityInventoryParamsSchema = Type.Object(
  {
    sessionKey: Type.Optional(NonEmptyString),
    agentIds: Type.Optional(Type.Array(NonEmptyString, { minItems: 1 })),
    workspaceDirs: Type.Optional(Type.Array(NonEmptyString, { minItems: 1 })),
  },
  { additionalProperties: false },
);

export const AutonomyCapabilityInventoryResultSchema = Type.Object(
  {
    observedAt: Type.Integer({ minimum: 0 }),
    charterDir: NonEmptyString,
    workspaceDirs: Type.Array(NonEmptyString),
    requestedAgentIds: Type.Array(NonEmptyString),
    summary: AutonomyCapabilityInventorySummarySchema,
    entries: Type.Array(AutonomyCapabilityInventoryEntrySchema),
    gaps: Type.Array(AutonomyCapabilityGapSchema),
  },
  { additionalProperties: false },
);

export const AutonomyGenesisPlanStageSchema = Type.Object(
  {
    id: NonEmptyString,
    title: NonEmptyString,
    ownerAgentId: NonEmptyString,
    status: Type.Union([
      Type.Literal("ready"),
      Type.Literal("waiting"),
      Type.Literal("blocked"),
    ]),
    goal: NonEmptyString,
    dependsOn: Type.Array(NonEmptyString),
    inputRefs: Type.Array(NonEmptyString),
    outputRefs: Type.Array(NonEmptyString),
    actions: Type.Array(NonEmptyString),
    rationale: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);

export const AutonomyGenesisPlanParamsSchema = Type.Object(
  {
    sessionKey: Type.Optional(NonEmptyString),
    agentIds: Type.Optional(Type.Array(NonEmptyString, { minItems: 1 })),
    teamId: Type.Optional(NonEmptyString),
    workspaceDirs: Type.Optional(Type.Array(NonEmptyString, { minItems: 1 })),
  },
  { additionalProperties: false },
);

export const AutonomyGenesisPlanResultSchema = Type.Object(
  {
    observedAt: Type.Integer({ minimum: 0 }),
    charterDir: NonEmptyString,
    workspaceDirs: Type.Array(NonEmptyString),
    primaryWorkspaceDir: Type.Optional(NonEmptyString),
    requestedAgentIds: Type.Array(NonEmptyString),
    teamId: NonEmptyString,
    teamTitle: Type.Optional(NonEmptyString),
    mode: Type.Union([
      Type.Literal("repair"),
      Type.Literal("build"),
      Type.Literal("steady_state"),
    ]),
    blockers: Type.Array(NonEmptyString),
    focusGapIds: Type.Array(NonEmptyString),
    stages: Type.Array(AutonomyGenesisPlanStageSchema),
  },
  { additionalProperties: false },
);

export const AutonomySupervisorSummarySchema = Type.Object(
  {
    totalProfiles: Type.Integer({ minimum: 0 }),
    changedProfiles: Type.Integer({ minimum: 0 }),
    healthyProfiles: Type.Integer({ minimum: 0 }),
    driftProfiles: Type.Integer({ minimum: 0 }),
    missingLoopProfiles: Type.Integer({ minimum: 0 }),
    activeFlows: Type.Integer({ minimum: 0 }),
    governanceCreatedCount: Type.Integer({ minimum: 0 }),
    governanceAppliedCount: Type.Integer({ minimum: 0 }),
    governancePendingCount: Type.Integer({ minimum: 0 }),
    capabilityGapCount: Type.Integer({ minimum: 0 }),
    criticalCapabilityGapCount: Type.Integer({ minimum: 0 }),
    genesisStageCount: Type.Integer({ minimum: 0 }),
    genesisBlockedStageCount: Type.Integer({ minimum: 0 }),
    recommendedNextActions: Type.Array(Type.String()),
  },
  { additionalProperties: false },
);

export const AutonomySuperviseResultSchema = Type.Object(
  {
    observedAt: Type.Integer({ minimum: 0 }),
    governanceMode: AutonomySupervisorGovernanceModeSchema,
    overviewBefore: AutonomyFleetStatusResultSchema,
    healed: AutonomyFleetHealResultSchema,
    governanceReconciled: Type.Optional(AutonomyGovernanceReconcileResultSchema),
    capabilityInventory: Type.Optional(AutonomyCapabilityInventoryResultSchema),
    genesisPlan: Type.Optional(AutonomyGenesisPlanResultSchema),
    overviewAfter: AutonomyFleetStatusResultSchema,
    summary: AutonomySupervisorSummarySchema,
  },
  { additionalProperties: false },
);

export const GovernanceCapabilityInventoryEntryActivationSchema =
  AutonomyCapabilityInventoryEntryActivationSchema;

export const GovernanceCapabilityInventoryEntrySchema = AutonomyCapabilityInventoryEntrySchema;

export const GovernanceCapabilityGapSchema = AutonomyCapabilityGapSchema;

export const GovernanceCapabilityInventorySummarySchema =
  AutonomyCapabilityInventorySummarySchema;

export const GovernanceCapabilityInventoryParamsSchema = Type.Object(
  {
    agentIds: Type.Optional(Type.Array(NonEmptyString, { minItems: 1 })),
    workspaceDirs: Type.Optional(Type.Array(NonEmptyString, { minItems: 1 })),
  },
  { additionalProperties: false },
);

export const GovernanceCapabilityInventoryResultSchema = AutonomyCapabilityInventoryResultSchema;

export const GovernanceCapabilityAssetRecordSchema = Type.Object(
  {
    id: NonEmptyString,
    kind: Type.Union([
      Type.Literal("skill"),
      Type.Literal("plugin"),
      Type.Literal("memory"),
      Type.Literal("strategy"),
      Type.Literal("algorithm"),
    ]),
    status: Type.Union([
      Type.Literal("ready"),
      Type.Literal("attention"),
      Type.Literal("blocked"),
    ]),
    title: NonEmptyString,
    description: Type.Optional(NonEmptyString),
    layer: Type.Optional(NonEmptyString),
    ownerAgentId: Type.Optional(NonEmptyString),
    sourcePath: Type.Optional(NonEmptyString),
    workspaceDir: Type.Optional(NonEmptyString),
    origin: Type.Optional(NonEmptyString),
    activation: Type.Optional(GovernanceCapabilityInventoryEntryActivationSchema),
    coverage: Type.Array(NonEmptyString),
    dependencies: Type.Array(NonEmptyString),
    issues: Type.Array(NonEmptyString),
    installOptions: Type.Array(NonEmptyString),
  },
  { additionalProperties: false },
);

export const GovernanceCapabilityAssetRegistryFileSchema = Type.Object(
  {
    version: Type.Literal(1),
    registry: Type.Object(
      {
        id: Type.Literal("capability_asset_registry"),
        title: NonEmptyString,
        status: Type.Literal("active"),
        observedAt: Type.Integer({ minimum: 0 }),
      },
      { additionalProperties: false },
    ),
    assets: Type.Array(GovernanceCapabilityAssetRecordSchema),
  },
  { additionalProperties: false },
);

export const GovernanceCapabilityAssetRegistrySnapshotSchema = Type.Object(
  {
    charterDir: NonEmptyString,
    relativePath: NonEmptyString,
    filePath: NonEmptyString,
    exists: Type.Boolean(),
    parseError: Type.Optional(NonEmptyString),
    registry: Type.Optional(GovernanceCapabilityAssetRegistryFileSchema),
  },
  { additionalProperties: false },
);

export const GovernanceCapabilityAssetRegistryParamsSchema = Type.Object(
  {
    agentIds: Type.Optional(Type.Array(NonEmptyString, { minItems: 1 })),
    workspaceDirs: Type.Optional(Type.Array(NonEmptyString, { minItems: 1 })),
  },
  { additionalProperties: false },
);

export const GovernanceCapabilityAssetRegistryResultSchema = Type.Object(
  {
    observedAt: Type.Integer({ minimum: 0 }),
    charterDir: NonEmptyString,
    workspaceDirs: Type.Array(NonEmptyString),
    requestedAgentIds: Type.Array(NonEmptyString),
    currentAssetCount: Type.Integer({ minimum: 0 }),
    snapshot: GovernanceCapabilityAssetRegistrySnapshotSchema,
    desiredRegistry: GovernanceCapabilityAssetRegistryFileSchema,
    assetCount: Type.Integer({ minimum: 0 }),
    missingAssetIds: Type.Array(NonEmptyString),
    staleAssetIds: Type.Array(NonEmptyString),
    driftedAssetIds: Type.Array(NonEmptyString),
    hasChanges: Type.Boolean(),
  },
  { additionalProperties: false },
);

export const GovernanceGenesisPlanStageSchema = AutonomyGenesisPlanStageSchema;

export const GovernanceGenesisPlanParamsSchema = Type.Object(
  {
    agentIds: Type.Optional(Type.Array(NonEmptyString, { minItems: 1 })),
    teamId: Type.Optional(NonEmptyString),
    workspaceDirs: Type.Optional(Type.Array(NonEmptyString, { minItems: 1 })),
  },
  { additionalProperties: false },
);

export const GovernanceGenesisPlanResultSchema = AutonomyGenesisPlanResultSchema;

export const AutonomyListResultSchema = Type.Object(
  {
    sessionKey: NonEmptyString,
    profiles: Type.Array(AutonomyAgentProfileSchema),
  },
  { additionalProperties: false },
);

export const AutonomyShowResultSchema = Type.Object(
  {
    sessionKey: NonEmptyString,
    profile: AutonomyAgentProfileSchema,
    latestFlow: Type.Optional(TaskFlowDetailSchema),
    latestSeedTask: Type.Optional(TaskRunDetailSchema),
    loopJob: Type.Optional(AutonomyLoopJobSnapshotSchema),
  },
  { additionalProperties: false },
);

export const AutonomyOverviewResultSchema = Type.Object(
  {
    sessionKey: NonEmptyString,
    overview: AutonomyFleetStatusResultSchema,
  },
  { additionalProperties: false },
);

export const AutonomyCapabilityInventoryEnvelopeSchema = Type.Object(
  {
    sessionKey: NonEmptyString,
    capabilities: AutonomyCapabilityInventoryResultSchema,
  },
  { additionalProperties: false },
);

export const AutonomyGenesisPlanEnvelopeSchema = Type.Object(
  {
    sessionKey: NonEmptyString,
    genesisPlan: AutonomyGenesisPlanResultSchema,
  },
  { additionalProperties: false },
);

export const AutonomyHealResultEnvelopeSchema = Type.Object(
  {
    sessionKey: NonEmptyString,
    healed: AutonomyFleetHealResultSchema,
  },
  { additionalProperties: false },
);

export const AutonomySuperviseResultEnvelopeSchema = Type.Object(
  {
    sessionKey: NonEmptyString,
    supervised: AutonomySuperviseResultSchema,
  },
  { additionalProperties: false },
);

export const AutonomyHistoryResultEnvelopeSchema = Type.Object(
  {
    sessionKey: NonEmptyString,
    history: AutonomyFleetHistoryResultSchema,
  },
  { additionalProperties: false },
);

export const AutonomyGovernanceProposalsEnvelopeSchema = Type.Object(
  {
    sessionKey: NonEmptyString,
    governance: AutonomyGovernanceProposalsResultSchema,
  },
  { additionalProperties: false },
);

export const AutonomyGovernanceReconcileEnvelopeSchema = Type.Object(
  {
    sessionKey: NonEmptyString,
    governanceReconciled: AutonomyGovernanceReconcileResultSchema,
  },
  { additionalProperties: false },
);

export const AutonomySubmitSandboxReplayOutcomeSchema = Type.Object(
  {
    found: Type.Boolean(),
    applied: Type.Boolean(),
    reason: Type.Optional(Type.String()),
    flow: Type.Optional(TaskFlowDetailSchema),
    seedTask: Type.Optional(TaskRunDetailSchema),
    sandboxController: Type.Optional(SandboxUniverseControllerStateSchema),
    sandboxReplayRunner: Type.Optional(SandboxUniverseReplayRunnerStateSchema),
    decision: Type.Optional(SandboxUniversePromotionGateDecisionSchema),
  },
  { additionalProperties: false },
);

export const AutonomySubmitSandboxReplayResultSchema = Type.Object(
  {
    profile: AutonomyAgentProfileSchema,
    requestedFlowId: Type.Optional(NonEmptyString),
    targetFlowId: Type.Optional(NonEmptyString),
    outcome: AutonomySubmitSandboxReplayOutcomeSchema,
  },
  { additionalProperties: false },
);

export const AutonomySubmitSandboxReplayEnvelopeSchema = Type.Object(
  {
    sessionKey: NonEmptyString,
    submitted: AutonomySubmitSandboxReplayResultSchema,
  },
  { additionalProperties: false },
);

export const AutonomyShowParamsSchema = Type.Object(
  {
    agentId: NonEmptyString,
    sessionKey: Type.Optional(NonEmptyString),
  },
  { additionalProperties: false },
);

export const AutonomyStartParamsSchema = Type.Object(
  {
    agentId: NonEmptyString,
    sessionKey: Type.Optional(NonEmptyString),
    goal: Type.Optional(Type.String()),
    controllerId: Type.Optional(Type.String()),
    currentStep: Type.Optional(Type.String()),
    workspaceDirs: Type.Optional(Type.Array(NonEmptyString, { minItems: 1 })),
    notifyPolicy: Type.Optional(
      Type.Union([
        Type.Literal("done_only"),
        Type.Literal("state_changes"),
        Type.Literal("silent"),
      ]),
    ),
    status: Type.Optional(Type.Union([Type.Literal("queued"), Type.Literal("running")])),
    seedTaskEnabled: Type.Optional(Type.Boolean()),
    seedTaskRuntime: Type.Optional(
      Type.Union([
        Type.Literal("subagent"),
        Type.Literal("acp"),
        Type.Literal("cli"),
        Type.Literal("cron"),
      ]),
    ),
    seedTaskStatus: Type.Optional(Type.Union([Type.Literal("queued"), Type.Literal("running")])),
    seedTaskLabel: Type.Optional(Type.String()),
    seedTaskTask: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);

export const AutonomyCancelParamsSchema = Type.Object(
  {
    agentId: NonEmptyString,
    sessionKey: Type.Optional(NonEmptyString),
    flowId: Type.Optional(NonEmptyString),
  },
  { additionalProperties: false },
);

export const AutonomySubmitSandboxReplayParamsSchema = Type.Object(
  {
    agentId: NonEmptyString,
    sessionKey: Type.Optional(NonEmptyString),
    flowId: Type.Optional(NonEmptyString),
    replayPassed: Type.Boolean(),
    qaPassed: Type.Boolean(),
    auditPassed: Type.Optional(Type.Boolean()),
  },
  { additionalProperties: false },
);

export const AutonomyLoopShowParamsSchema = Type.Object(
  {
    agentId: NonEmptyString,
    sessionKey: Type.Optional(NonEmptyString),
  },
  { additionalProperties: false },
);

export const AutonomyLoopUpsertParamsSchema = Type.Object(
  {
    agentId: NonEmptyString,
    sessionKey: Type.Optional(NonEmptyString),
    everyMs: Type.Optional(Type.Integer({ minimum: 1 })),
    workspaceDirs: Type.Optional(Type.Array(NonEmptyString, { minItems: 1 })),
  },
  { additionalProperties: false },
);

export const AutonomyLoopReconcileParamsSchema = Type.Object(
  {
    sessionKey: Type.Optional(NonEmptyString),
    agentIds: Type.Optional(Type.Array(NonEmptyString, { minItems: 1 })),
    workspaceDirs: Type.Optional(Type.Array(NonEmptyString, { minItems: 1 })),
  },
  { additionalProperties: false },
);

export const AutonomyLoopRemoveParamsSchema = Type.Object(
  {
    agentId: NonEmptyString,
    sessionKey: Type.Optional(NonEmptyString),
    jobId: Type.Optional(NonEmptyString),
  },
  { additionalProperties: false },
);

export const ModelsListParamsSchema = Type.Object({}, { additionalProperties: false });

export const ModelsListResultSchema = Type.Object(
  {
    models: Type.Array(ModelChoiceSchema),
  },
  { additionalProperties: false },
);

export const SkillsStatusParamsSchema = Type.Object(
  {
    agentId: Type.Optional(NonEmptyString),
  },
  { additionalProperties: false },
);

export const SkillsBinsParamsSchema = Type.Object({}, { additionalProperties: false });

export const SkillsBinsResultSchema = Type.Object(
  {
    bins: Type.Array(NonEmptyString),
  },
  { additionalProperties: false },
);

export const SkillsInstallParamsSchema = Type.Union([
  Type.Object(
    {
      name: NonEmptyString,
      installId: NonEmptyString,
      dangerouslyForceUnsafeInstall: Type.Optional(Type.Boolean()),
      timeoutMs: Type.Optional(Type.Integer({ minimum: 1000 })),
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      source: Type.Literal("clawhub"),
      slug: NonEmptyString,
      version: Type.Optional(NonEmptyString),
      force: Type.Optional(Type.Boolean()),
      timeoutMs: Type.Optional(Type.Integer({ minimum: 1000 })),
    },
    { additionalProperties: false },
  ),
]);

export const SkillsUpdateParamsSchema = Type.Union([
  Type.Object(
    {
      skillKey: NonEmptyString,
      enabled: Type.Optional(Type.Boolean()),
      apiKey: Type.Optional(Type.String()),
      env: Type.Optional(Type.Record(NonEmptyString, Type.String())),
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      source: Type.Literal("clawhub"),
      slug: Type.Optional(NonEmptyString),
      all: Type.Optional(Type.Boolean()),
    },
    { additionalProperties: false },
  ),
]);

export const SkillsSearchParamsSchema = Type.Object(
  {
    query: Type.Optional(NonEmptyString),
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
  },
  { additionalProperties: false },
);

export const SkillsSearchResultSchema = Type.Object(
  {
    results: Type.Array(
      Type.Object(
        {
          score: Type.Number(),
          slug: NonEmptyString,
          displayName: NonEmptyString,
          summary: Type.Optional(Type.String()),
          version: Type.Optional(NonEmptyString),
          updatedAt: Type.Optional(Type.Integer()),
        },
        { additionalProperties: false },
      ),
    ),
  },
  { additionalProperties: false },
);

export const SkillsDetailParamsSchema = Type.Object(
  {
    slug: NonEmptyString,
  },
  { additionalProperties: false },
);

export const SkillsDetailResultSchema = Type.Object(
  {
    skill: Type.Union([
      Type.Object(
        {
          slug: NonEmptyString,
          displayName: NonEmptyString,
          summary: Type.Optional(Type.String()),
          tags: Type.Optional(Type.Record(NonEmptyString, Type.String())),
          createdAt: Type.Integer(),
          updatedAt: Type.Integer(),
        },
        { additionalProperties: false },
      ),
      Type.Null(),
    ]),
    latestVersion: Type.Optional(
      Type.Union([
        Type.Object(
          {
            version: NonEmptyString,
            createdAt: Type.Integer(),
            changelog: Type.Optional(Type.String()),
          },
          { additionalProperties: false },
        ),
        Type.Null(),
      ]),
    ),
    metadata: Type.Optional(
      Type.Union([
        Type.Object(
          {
            os: Type.Optional(Type.Union([Type.Array(Type.String()), Type.Null()])),
            systems: Type.Optional(Type.Union([Type.Array(Type.String()), Type.Null()])),
          },
          { additionalProperties: false },
        ),
        Type.Null(),
      ]),
    ),
    owner: Type.Optional(
      Type.Union([
        Type.Object(
          {
            handle: Type.Optional(Type.Union([NonEmptyString, Type.Null()])),
            displayName: Type.Optional(Type.Union([NonEmptyString, Type.Null()])),
            image: Type.Optional(Type.Union([Type.String(), Type.Null()])),
          },
          { additionalProperties: false },
        ),
        Type.Null(),
      ]),
    ),
  },
  { additionalProperties: false },
);

export const ToolsCatalogParamsSchema = Type.Object(
  {
    agentId: Type.Optional(NonEmptyString),
    includePlugins: Type.Optional(Type.Boolean()),
  },
  { additionalProperties: false },
);

export const ToolsEffectiveParamsSchema = Type.Object(
  {
    agentId: Type.Optional(NonEmptyString),
    sessionKey: NonEmptyString,
  },
  { additionalProperties: false },
);

export const ToolCatalogProfileSchema = Type.Object(
  {
    id: Type.Union([
      Type.Literal("minimal"),
      Type.Literal("coding"),
      Type.Literal("messaging"),
      Type.Literal("full"),
    ]),
    label: NonEmptyString,
  },
  { additionalProperties: false },
);

export const ToolCatalogEntrySchema = Type.Object(
  {
    id: NonEmptyString,
    label: NonEmptyString,
    description: Type.String(),
    source: Type.Union([Type.Literal("core"), Type.Literal("plugin")]),
    pluginId: Type.Optional(NonEmptyString),
    optional: Type.Optional(Type.Boolean()),
    defaultProfiles: Type.Array(
      Type.Union([
        Type.Literal("minimal"),
        Type.Literal("coding"),
        Type.Literal("messaging"),
        Type.Literal("full"),
      ]),
    ),
  },
  { additionalProperties: false },
);

export const ToolCatalogGroupSchema = Type.Object(
  {
    id: NonEmptyString,
    label: NonEmptyString,
    source: Type.Union([Type.Literal("core"), Type.Literal("plugin")]),
    pluginId: Type.Optional(NonEmptyString),
    tools: Type.Array(ToolCatalogEntrySchema),
  },
  { additionalProperties: false },
);

export const ToolsCatalogResultSchema = Type.Object(
  {
    agentId: NonEmptyString,
    profiles: Type.Array(ToolCatalogProfileSchema),
    governance: ToolGovernanceSummarySchema,
    governanceContract: Type.Optional(AgentGovernanceRuntimeContractSchema),
    groups: Type.Array(ToolCatalogGroupSchema),
  },
  { additionalProperties: false },
);

export const ToolsEffectiveEntrySchema = Type.Object(
  {
    id: NonEmptyString,
    label: NonEmptyString,
    description: Type.String(),
    rawDescription: Type.String(),
    source: Type.Union([Type.Literal("core"), Type.Literal("plugin"), Type.Literal("channel")]),
    pluginId: Type.Optional(NonEmptyString),
    channelId: Type.Optional(NonEmptyString),
  },
  { additionalProperties: false },
);

export const ToolsEffectiveGroupSchema = Type.Object(
  {
    id: Type.Union([Type.Literal("core"), Type.Literal("plugin"), Type.Literal("channel")]),
    label: NonEmptyString,
    source: Type.Union([Type.Literal("core"), Type.Literal("plugin"), Type.Literal("channel")]),
    tools: Type.Array(ToolsEffectiveEntrySchema),
  },
  { additionalProperties: false },
);

export const ToolsEffectiveResultSchema = Type.Object(
  {
    agentId: NonEmptyString,
    profile: NonEmptyString,
    governance: ToolGovernanceSummarySchema,
    governanceContract: Type.Optional(AgentGovernanceRuntimeContractSchema),
    groups: Type.Array(ToolsEffectiveGroupSchema),
  },
  { additionalProperties: false },
);
