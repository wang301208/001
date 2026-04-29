import type { TSchema } from "@sinclair/typebox";
import {
  AgentEventSchema,
  AgentIdentityParamsSchema,
  AgentIdentityResultSchema,
  AgentParamsSchema,
  AgentWaitParamsSchema,
  MessageActionParamsSchema,
  PollParamsSchema,
  SendParamsSchema,
  WakeParamsSchema,
} from "./agent.js";
import {
  AutonomyAgentProfileSchema,
  AutonomyBootstrapTemplateSchema,
  AutonomyCapabilityGapSchema,
  AutonomyCapabilityInventoryEnvelopeSchema,
  AutonomyCapabilityInventoryEntryActivationSchema,
  AutonomyCapabilityInventoryEntrySchema,
  AutonomyCapabilityInventoryParamsSchema,
  AutonomyCapabilityInventoryResultSchema,
  AutonomyGovernanceProposalsEnvelopeSchema,
  AutonomyCapabilityInventorySummarySchema,
  AutonomyCancelParamsSchema,
  AutonomyFleetHealEntrySchema,
  AutonomyFleetHealFlowActionSchema,
  AutonomyFleetHealLoopActionSchema,
  AutonomyFleetHealResultSchema,
  AutonomyGenesisPlanEnvelopeSchema,
  AutonomyFleetHistoryEntrySchema,
  AutonomyFleetHistoryEventSchema,
  AutonomyFleetHistoryResultSchema,
  AutonomyGovernanceReconcileEnvelopeSchema,
  AutonomyFleetHistoryModeSchema,
  AutonomyFleetHistorySourceSchema,
  AutonomyFleetHistoryTotalsSchema,
  AutonomyHealResultEnvelopeSchema,
  AutonomyHistoryResultEnvelopeSchema,
  AutonomyListResultSchema,
  AutonomyFleetStatusEntrySchema,
  AutonomyFleetStatusHealthSchema,
  AutonomyFleetStatusResultSchema,
  AutonomyFleetStatusSuggestedActionSchema,
  AutonomyGovernanceProposalItemSchema,
  AutonomyGovernanceProposalsParamsSchema,
  AutonomyGovernanceProposalsResultSchema,
  AutonomyGovernanceReconcileParamsSchema,
  AutonomyGovernanceReconcileResultSchema,
  AutonomyGenesisPlanParamsSchema,
  AutonomyGenesisPlanResultSchema,
  AutonomyGenesisPlanStageSchema,
  AutonomyHealParamsSchema,
  AutonomySuperviseParamsSchema,
  AutonomySupervisorGovernanceModeSchema,
  AutonomySupervisorSummarySchema,
  AutonomySuperviseResultSchema,
  AutonomyHistoryParamsSchema,
  AutonomyListParamsSchema,
  AutonomyOverviewParamsSchema,
  AutonomyOverviewResultSchema,
  AutonomyLoopRemoveParamsSchema,
  AutonomyLoopReconcileParamsSchema,
  AutonomyLoopShowParamsSchema,
  AutonomyLoopTemplateSchema,
  AutonomyLoopUpsertParamsSchema,
  AutonomySeedTaskTemplateSchema,
  AutonomyShowParamsSchema,
  AutonomyShowResultSchema,
  AutonomyStartParamsSchema,
  AutonomySubmitSandboxReplayEnvelopeSchema,
  AutonomySubmitSandboxReplayParamsSchema,
  AutonomySubmitSandboxReplayResultSchema,
  AutonomySuperviseResultEnvelopeSchema,
  AgentGovernanceRuntimeContractSchema,
  AgentSummarySchema,
  AgentGovernanceRuntimeSnapshotSchema,
  GovernanceAgentParamsSchema,
  GovernanceAgentResultSchema,
  GovernanceTeamMemberRecordSchema,
  GovernanceTeamParamsSchema,
  GovernanceTeamResultSchema,
  GovernanceCapabilityGapSchema,
  GovernanceCapabilityInventoryEntryActivationSchema,
  GovernanceCapabilityInventoryEntrySchema,
  GovernanceCapabilityInventoryParamsSchema,
  GovernanceCapabilityInventoryResultSchema,
  GovernanceCapabilityInventorySummarySchema,
  GovernanceCapabilityAssetRecordSchema,
  GovernanceCapabilityAssetRegistryFileSchema,
  GovernanceCapabilityAssetRegistrySnapshotSchema,
  GovernanceCapabilityAssetRegistryParamsSchema,
  GovernanceCapabilityAssetRegistryResultSchema,
  GovernanceGenesisPlanParamsSchema,
  GovernanceGenesisPlanResultSchema,
  GovernanceGenesisPlanStageSchema,
  GovernanceOverviewParamsSchema,
  GovernanceOverviewResultSchema,
  GovernanceProposalApplyRecordSchema,
  GovernanceProposalBatchEntrySchema,
  GovernanceProposalBatchSelectionSchema,
  GovernanceProposalReconcileEntrySchema,
  GovernanceProposalLedgerSchema,
  GovernanceProposalOperationSchema,
  GovernanceProposalRecordSchema,
  GovernanceProposalReviewRecordSchema,
  GovernanceProposalSummarySchema,
  GovernanceProposalsApplyParamsSchema,
  GovernanceProposalsApplyManyParamsSchema,
  GovernanceProposalsApplyManyResultSchema,
  GovernanceProposalsApplyResultSchema,
  GovernanceProposalsCreateParamsSchema,
  GovernanceProposalsCreateResultSchema,
  GovernanceProposalsListParamsSchema,
  GovernanceProposalsListResultSchema,
  GovernanceProposalsReconcileModeSchema,
  GovernanceProposalsReconcileParamsSchema,
  GovernanceProposalsReconcileResultSchema,
  GovernanceProposalsSynthesizeParamsSchema,
  GovernanceProposalsSynthesizeResultSchema,
  GovernanceProposalsRevertParamsSchema,
  GovernanceProposalsRevertManyParamsSchema,
  GovernanceProposalsRevertManyResultSchema,
  GovernanceProposalsRevertResultSchema,
  GovernanceProposalsReviewParamsSchema,
  GovernanceProposalsReviewManyParamsSchema,
  GovernanceProposalsReviewManyResultSchema,
  GovernanceProposalsReviewResultSchema,
  AgentsCreateParamsSchema,
  AgentsCreateResultSchema,
  AgentsDeleteParamsSchema,
  AgentsDeleteResultSchema,
  AgentsFileEntrySchema,
  AgentsFilesGetParamsSchema,
  AgentsFilesGetResultSchema,
  AgentsFilesListParamsSchema,
  AgentsFilesListResultSchema,
  AgentsFilesSetParamsSchema,
  AgentsFilesSetResultSchema,
  AgentsListParamsSchema,
  AgentsListResultSchema,
  AgentsUpdateParamsSchema,
  AgentsUpdateResultSchema,
  ModelChoiceSchema,
  ModelsListParamsSchema,
  ModelsListResultSchema,
  SkillsBinsParamsSchema,
  SkillsBinsResultSchema,
  SkillsDetailParamsSchema,
  SkillsDetailResultSchema,
  SkillsInstallParamsSchema,
  SkillsSearchParamsSchema,
  SkillsSearchResultSchema,
  SkillsStatusParamsSchema,
  SkillsUpdateParamsSchema,
  ToolCatalogEntrySchema,
  ToolCatalogGroupSchema,
  ToolGovernanceSummarySchema,
  ToolCatalogProfileSchema,
  ToolsCatalogParamsSchema,
  ToolsCatalogResultSchema,
  ToolsEffectiveEntrySchema,
  ToolsEffectiveGroupSchema,
  ToolsEffectiveParamsSchema,
  ToolsEffectiveResultSchema,
  SandboxUniversePromotionGateDecisionSchema,
} from "./agents-models-skills.js";
import {
  ChannelsLogoutParamsSchema,
  TalkConfigParamsSchema,
  TalkConfigResultSchema,
  TalkSpeakParamsSchema,
  TalkSpeakResultSchema,
  ChannelsStatusParamsSchema,
  ChannelsStatusResultSchema,
  TalkModeParamsSchema,
  WebLoginStartParamsSchema,
  WebLoginWaitParamsSchema,
} from "./channels.js";
import {
  CommandEntrySchema,
  CommandsListParamsSchema,
  CommandsListResultSchema,
} from "./commands.js";
import {
  ConfigApplyParamsSchema,
  ConfigGetParamsSchema,
  ConfigPatchParamsSchema,
  ConfigSchemaLookupParamsSchema,
  ConfigSchemaLookupResultSchema,
  ConfigSchemaParamsSchema,
  ConfigSchemaResponseSchema,
  ConfigSetParamsSchema,
  UpdateRunParamsSchema,
} from "./config.js";
import {
  CronAddParamsSchema,
  CronJobSchema,
  CronListParamsSchema,
  CronRemoveParamsSchema,
  CronRunLogEntrySchema,
  CronRunParamsSchema,
  CronRunsParamsSchema,
  CronStatusParamsSchema,
  CronUpdateParamsSchema,
} from "./cron.js";
import {
  DevicePairApproveParamsSchema,
  DevicePairListParamsSchema,
  DevicePairRemoveParamsSchema,
  DevicePairRejectParamsSchema,
  DevicePairRequestedEventSchema,
  DevicePairResolvedEventSchema,
  DeviceTokenRevokeParamsSchema,
  DeviceTokenRotateParamsSchema,
} from "./devices.js";
import {
  ExecApprovalsGetParamsSchema,
  ExecApprovalsNodeGetParamsSchema,
  ExecApprovalsNodeSetParamsSchema,
  ExecApprovalsSetParamsSchema,
  ExecApprovalsSnapshotSchema,
  ExecApprovalGetParamsSchema,
  ExecApprovalRequestParamsSchema,
  ExecApprovalResolveParamsSchema,
} from "./exec-approvals.js";
import {
  ConnectParamsSchema,
  ErrorShapeSchema,
  EventFrameSchema,
  GatewayFrameSchema,
  HelloOkSchema,
  RequestFrameSchema,
  ResponseFrameSchema,
  ShutdownEventSchema,
  TickEventSchema,
} from "./frames.js";
import {
  ChatAbortParamsSchema,
  ChatEventSchema,
  ChatHistoryParamsSchema,
  ChatInjectParamsSchema,
  ChatSendParamsSchema,
  LogsTailParamsSchema,
  LogsTailResultSchema,
} from "./logs-chat.js";
import {
  NodeDescribeParamsSchema,
  NodeEventParamsSchema,
  NodePendingDrainParamsSchema,
  NodePendingDrainResultSchema,
  NodePendingEnqueueParamsSchema,
  NodePendingEnqueueResultSchema,
  NodeInvokeParamsSchema,
  NodeInvokeResultParamsSchema,
  NodeInvokeRequestEventSchema,
  NodeListParamsSchema,
  NodePendingAckParamsSchema,
  NodePairApproveParamsSchema,
  NodePairListParamsSchema,
  NodePairRejectParamsSchema,
  NodePairRequestParamsSchema,
  NodePairVerifyParamsSchema,
  NodeRenameParamsSchema,
} from "./nodes.js";
import {
  PluginApprovalRequestParamsSchema,
  PluginApprovalResolveParamsSchema,
} from "./plugin-approvals.js";
import { PushTestParamsSchema, PushTestResultSchema } from "./push.js";
import {
  SecretsReloadParamsSchema,
  SecretsResolveAssignmentSchema,
  SecretsResolveParamsSchema,
  SecretsResolveResultSchema,
} from "./secrets.js";
import {
  SessionsAbortParamsSchema,
  SessionsCompactParamsSchema,
  SessionsCompactionBranchParamsSchema,
  SessionsCompactionBranchResultSchema,
  SessionsCompactionGetParamsSchema,
  SessionsCompactionGetResultSchema,
  SessionsCompactionListParamsSchema,
  SessionsCompactionListResultSchema,
  SessionsCompactionRestoreParamsSchema,
  SessionsCompactionRestoreResultSchema,
  SessionCompactionCheckpointSchema,
  SessionsCreateParamsSchema,
  SessionsDeleteParamsSchema,
  SessionsListParamsSchema,
  SessionsMessagesSubscribeParamsSchema,
  SessionsMessagesUnsubscribeParamsSchema,
  SessionsPatchParamsSchema,
  SessionsPreviewParamsSchema,
  SessionsResetParamsSchema,
  SessionsResolveParamsSchema,
  SessionsSendParamsSchema,
  SessionsUsageParamsSchema,
} from "./sessions.js";
import { PresenceEntrySchema, SnapshotSchema, StateVersionSchema } from "./snapshot.js";
import {
  WizardCancelParamsSchema,
  WizardNextParamsSchema,
  WizardNextResultSchema,
  WizardStartParamsSchema,
  WizardStartResultSchema,
  WizardStatusParamsSchema,
  WizardStatusResultSchema,
  WizardStepSchema,
} from "./wizard.js";

type ProtocolSchemaMap = {
  ConnectParams: typeof ConnectParamsSchema;
  HelloOk: typeof HelloOkSchema;
  RequestFrame: typeof RequestFrameSchema;
  ResponseFrame: typeof ResponseFrameSchema;
  EventFrame: typeof EventFrameSchema;
  GatewayFrame: typeof GatewayFrameSchema;
  PresenceEntry: typeof PresenceEntrySchema;
  StateVersion: typeof StateVersionSchema;
  Snapshot: typeof SnapshotSchema;
  ErrorShape: typeof ErrorShapeSchema;
  AgentEvent: typeof AgentEventSchema;
  MessageActionParams: typeof MessageActionParamsSchema;
  SendParams: typeof SendParamsSchema;
  PollParams: typeof PollParamsSchema;
  AgentParams: typeof AgentParamsSchema;
  AgentIdentityParams: typeof AgentIdentityParamsSchema;
  AgentIdentityResult: typeof AgentIdentityResultSchema;
  AgentWaitParams: typeof AgentWaitParamsSchema;
  WakeParams: typeof WakeParamsSchema;
  NodePairRequestParams: typeof NodePairRequestParamsSchema;
  NodePairListParams: typeof NodePairListParamsSchema;
  NodePairApproveParams: typeof NodePairApproveParamsSchema;
  NodePairRejectParams: typeof NodePairRejectParamsSchema;
  NodePairVerifyParams: typeof NodePairVerifyParamsSchema;
  NodeRenameParams: typeof NodeRenameParamsSchema;
  NodeListParams: typeof NodeListParamsSchema;
  NodePendingAckParams: typeof NodePendingAckParamsSchema;
  NodeDescribeParams: typeof NodeDescribeParamsSchema;
  NodeInvokeParams: typeof NodeInvokeParamsSchema;
  NodeInvokeResultParams: typeof NodeInvokeResultParamsSchema;
  NodeEventParams: typeof NodeEventParamsSchema;
  NodePendingDrainParams: typeof NodePendingDrainParamsSchema;
  NodePendingDrainResult: typeof NodePendingDrainResultSchema;
  NodePendingEnqueueParams: typeof NodePendingEnqueueParamsSchema;
  NodePendingEnqueueResult: typeof NodePendingEnqueueResultSchema;
  NodeInvokeRequestEvent: typeof NodeInvokeRequestEventSchema;
  PushTestParams: typeof PushTestParamsSchema;
  PushTestResult: typeof PushTestResultSchema;
  SecretsReloadParams: typeof SecretsReloadParamsSchema;
  SecretsResolveParams: typeof SecretsResolveParamsSchema;
  SecretsResolveAssignment: typeof SecretsResolveAssignmentSchema;
  SecretsResolveResult: typeof SecretsResolveResultSchema;
  SessionsListParams: typeof SessionsListParamsSchema;
  SessionsPreviewParams: typeof SessionsPreviewParamsSchema;
  SessionsResolveParams: typeof SessionsResolveParamsSchema;
  SessionCompactionCheckpoint: typeof SessionCompactionCheckpointSchema;
  SessionsCompactionListParams: typeof SessionsCompactionListParamsSchema;
  SessionsCompactionGetParams: typeof SessionsCompactionGetParamsSchema;
  SessionsCompactionBranchParams: typeof SessionsCompactionBranchParamsSchema;
  SessionsCompactionRestoreParams: typeof SessionsCompactionRestoreParamsSchema;
  SessionsCompactionListResult: typeof SessionsCompactionListResultSchema;
  SessionsCompactionGetResult: typeof SessionsCompactionGetResultSchema;
  SessionsCompactionBranchResult: typeof SessionsCompactionBranchResultSchema;
  SessionsCompactionRestoreResult: typeof SessionsCompactionRestoreResultSchema;
  SessionsCreateParams: typeof SessionsCreateParamsSchema;
  SessionsSendParams: typeof SessionsSendParamsSchema;
  SessionsMessagesSubscribeParams: typeof SessionsMessagesSubscribeParamsSchema;
  SessionsMessagesUnsubscribeParams: typeof SessionsMessagesUnsubscribeParamsSchema;
  SessionsAbortParams: typeof SessionsAbortParamsSchema;
  SessionsPatchParams: typeof SessionsPatchParamsSchema;
  SessionsResetParams: typeof SessionsResetParamsSchema;
  SessionsDeleteParams: typeof SessionsDeleteParamsSchema;
  SessionsCompactParams: typeof SessionsCompactParamsSchema;
  SessionsUsageParams: typeof SessionsUsageParamsSchema;
  ConfigGetParams: typeof ConfigGetParamsSchema;
  ConfigSetParams: typeof ConfigSetParamsSchema;
  ConfigApplyParams: typeof ConfigApplyParamsSchema;
  ConfigPatchParams: typeof ConfigPatchParamsSchema;
  ConfigSchemaParams: typeof ConfigSchemaParamsSchema;
  ConfigSchemaLookupParams: typeof ConfigSchemaLookupParamsSchema;
  ConfigSchemaResponse: typeof ConfigSchemaResponseSchema;
  ConfigSchemaLookupResult: typeof ConfigSchemaLookupResultSchema;
  WizardStartParams: typeof WizardStartParamsSchema;
  WizardNextParams: typeof WizardNextParamsSchema;
  WizardCancelParams: typeof WizardCancelParamsSchema;
  WizardStatusParams: typeof WizardStatusParamsSchema;
  WizardStep: typeof WizardStepSchema;
  WizardNextResult: typeof WizardNextResultSchema;
  WizardStartResult: typeof WizardStartResultSchema;
  WizardStatusResult: typeof WizardStatusResultSchema;
  TalkModeParams: typeof TalkModeParamsSchema;
  TalkConfigParams: typeof TalkConfigParamsSchema;
  TalkConfigResult: typeof TalkConfigResultSchema;
  TalkSpeakParams: typeof TalkSpeakParamsSchema;
  TalkSpeakResult: typeof TalkSpeakResultSchema;
  ChannelsStatusParams: typeof ChannelsStatusParamsSchema;
  ChannelsStatusResult: typeof ChannelsStatusResultSchema;
  ChannelsLogoutParams: typeof ChannelsLogoutParamsSchema;
  WebLoginStartParams: typeof WebLoginStartParamsSchema;
  WebLoginWaitParams: typeof WebLoginWaitParamsSchema;
  AgentSummary: typeof AgentSummarySchema;
  AgentGovernanceRuntimeContract: typeof AgentGovernanceRuntimeContractSchema;
  AgentGovernanceRuntimeSnapshot: typeof AgentGovernanceRuntimeSnapshotSchema;
  GovernanceOverviewParams: typeof GovernanceOverviewParamsSchema;
  GovernanceOverviewResult: typeof GovernanceOverviewResultSchema;
  GovernanceAgentParams: typeof GovernanceAgentParamsSchema;
  GovernanceAgentResult: typeof GovernanceAgentResultSchema;
  GovernanceTeamMemberRecord: typeof GovernanceTeamMemberRecordSchema;
  GovernanceTeamParams: typeof GovernanceTeamParamsSchema;
  GovernanceTeamResult: typeof GovernanceTeamResultSchema;
  GovernanceCapabilityInventoryEntryActivation: typeof GovernanceCapabilityInventoryEntryActivationSchema;
  GovernanceCapabilityInventoryEntry: typeof GovernanceCapabilityInventoryEntrySchema;
  GovernanceCapabilityGap: typeof GovernanceCapabilityGapSchema;
  GovernanceCapabilityInventorySummary: typeof GovernanceCapabilityInventorySummarySchema;
  GovernanceCapabilityInventoryParams: typeof GovernanceCapabilityInventoryParamsSchema;
  GovernanceCapabilityInventoryResult: typeof GovernanceCapabilityInventoryResultSchema;
  GovernanceCapabilityAssetRecord: typeof GovernanceCapabilityAssetRecordSchema;
  GovernanceCapabilityAssetRegistryFile: typeof GovernanceCapabilityAssetRegistryFileSchema;
  GovernanceCapabilityAssetRegistrySnapshot: typeof GovernanceCapabilityAssetRegistrySnapshotSchema;
  GovernanceCapabilityAssetRegistryParams: typeof GovernanceCapabilityAssetRegistryParamsSchema;
  GovernanceCapabilityAssetRegistryResult: typeof GovernanceCapabilityAssetRegistryResultSchema;
  GovernanceGenesisPlanStage: typeof GovernanceGenesisPlanStageSchema;
  GovernanceGenesisPlanParams: typeof GovernanceGenesisPlanParamsSchema;
  GovernanceGenesisPlanResult: typeof GovernanceGenesisPlanResultSchema;
  GovernanceProposalOperation: typeof GovernanceProposalOperationSchema;
  GovernanceProposalReviewRecord: typeof GovernanceProposalReviewRecordSchema;
  GovernanceProposalApplyRecord: typeof GovernanceProposalApplyRecordSchema;
  GovernanceProposalBatchSelection: typeof GovernanceProposalBatchSelectionSchema;
  GovernanceProposalBatchEntry: typeof GovernanceProposalBatchEntrySchema;
  GovernanceProposalReconcileEntry: typeof GovernanceProposalReconcileEntrySchema;
  GovernanceProposalRecord: typeof GovernanceProposalRecordSchema;
  GovernanceProposalSummary: typeof GovernanceProposalSummarySchema;
  GovernanceProposalLedger: typeof GovernanceProposalLedgerSchema;
  GovernanceProposalsListParams: typeof GovernanceProposalsListParamsSchema;
  GovernanceProposalsListResult: typeof GovernanceProposalsListResultSchema;
  GovernanceProposalsReconcileMode: typeof GovernanceProposalsReconcileModeSchema;
  GovernanceProposalsReconcileParams: typeof GovernanceProposalsReconcileParamsSchema;
  GovernanceProposalsReconcileResult: typeof GovernanceProposalsReconcileResultSchema;
  GovernanceProposalsSynthesizeParams: typeof GovernanceProposalsSynthesizeParamsSchema;
  GovernanceProposalsSynthesizeResult: typeof GovernanceProposalsSynthesizeResultSchema;
  GovernanceProposalsCreateParams: typeof GovernanceProposalsCreateParamsSchema;
  GovernanceProposalsCreateResult: typeof GovernanceProposalsCreateResultSchema;
  GovernanceProposalsReviewParams: typeof GovernanceProposalsReviewParamsSchema;
  GovernanceProposalsReviewResult: typeof GovernanceProposalsReviewResultSchema;
  GovernanceProposalsReviewManyParams: typeof GovernanceProposalsReviewManyParamsSchema;
  GovernanceProposalsReviewManyResult: typeof GovernanceProposalsReviewManyResultSchema;
  GovernanceProposalsApplyParams: typeof GovernanceProposalsApplyParamsSchema;
  GovernanceProposalsApplyResult: typeof GovernanceProposalsApplyResultSchema;
  GovernanceProposalsApplyManyParams: typeof GovernanceProposalsApplyManyParamsSchema;
  GovernanceProposalsApplyManyResult: typeof GovernanceProposalsApplyManyResultSchema;
  GovernanceProposalsRevertParams: typeof GovernanceProposalsRevertParamsSchema;
  GovernanceProposalsRevertResult: typeof GovernanceProposalsRevertResultSchema;
  GovernanceProposalsRevertManyParams: typeof GovernanceProposalsRevertManyParamsSchema;
  GovernanceProposalsRevertManyResult: typeof GovernanceProposalsRevertManyResultSchema;
  AgentsCreateParams: typeof AgentsCreateParamsSchema;
  AgentsCreateResult: typeof AgentsCreateResultSchema;
  AgentsUpdateParams: typeof AgentsUpdateParamsSchema;
  AgentsUpdateResult: typeof AgentsUpdateResultSchema;
  AgentsDeleteParams: typeof AgentsDeleteParamsSchema;
  AgentsDeleteResult: typeof AgentsDeleteResultSchema;
  AgentsFileEntry: typeof AgentsFileEntrySchema;
  AgentsFilesListParams: typeof AgentsFilesListParamsSchema;
  AgentsFilesListResult: typeof AgentsFilesListResultSchema;
  AgentsFilesGetParams: typeof AgentsFilesGetParamsSchema;
  AgentsFilesGetResult: typeof AgentsFilesGetResultSchema;
  AgentsFilesSetParams: typeof AgentsFilesSetParamsSchema;
  AgentsFilesSetResult: typeof AgentsFilesSetResultSchema;
  AgentsListParams: typeof AgentsListParamsSchema;
  AgentsListResult: typeof AgentsListResultSchema;
  ModelChoice: typeof ModelChoiceSchema;
  ModelsListParams: typeof ModelsListParamsSchema;
  ModelsListResult: typeof ModelsListResultSchema;
  CommandEntry: typeof CommandEntrySchema;
  CommandsListParams: typeof CommandsListParamsSchema;
  CommandsListResult: typeof CommandsListResultSchema;
  SkillsStatusParams: typeof SkillsStatusParamsSchema;
  ToolsCatalogParams: typeof ToolsCatalogParamsSchema;
  ToolCatalogProfile: typeof ToolCatalogProfileSchema;
  ToolCatalogEntry: typeof ToolCatalogEntrySchema;
  ToolCatalogGroup: typeof ToolCatalogGroupSchema;
  ToolGovernanceSummary: typeof ToolGovernanceSummarySchema;
  ToolsCatalogResult: typeof ToolsCatalogResultSchema;
  ToolsEffectiveParams: typeof ToolsEffectiveParamsSchema;
  ToolsEffectiveEntry: typeof ToolsEffectiveEntrySchema;
  ToolsEffectiveGroup: typeof ToolsEffectiveGroupSchema;
  ToolsEffectiveResult: typeof ToolsEffectiveResultSchema;
  SkillsBinsParams: typeof SkillsBinsParamsSchema;
  SkillsBinsResult: typeof SkillsBinsResultSchema;
  SkillsSearchParams: typeof SkillsSearchParamsSchema;
  SkillsSearchResult: typeof SkillsSearchResultSchema;
  SkillsDetailParams: typeof SkillsDetailParamsSchema;
  SkillsDetailResult: typeof SkillsDetailResultSchema;
  SkillsInstallParams: typeof SkillsInstallParamsSchema;
  SkillsUpdateParams: typeof SkillsUpdateParamsSchema;
  CronJob: typeof CronJobSchema;
  CronListParams: typeof CronListParamsSchema;
  CronStatusParams: typeof CronStatusParamsSchema;
  CronAddParams: typeof CronAddParamsSchema;
  CronUpdateParams: typeof CronUpdateParamsSchema;
  CronRemoveParams: typeof CronRemoveParamsSchema;
  CronRunParams: typeof CronRunParamsSchema;
  CronRunsParams: typeof CronRunsParamsSchema;
  CronRunLogEntry: typeof CronRunLogEntrySchema;
  LogsTailParams: typeof LogsTailParamsSchema;
  LogsTailResult: typeof LogsTailResultSchema;
  ExecApprovalsGetParams: typeof ExecApprovalsGetParamsSchema;
  ExecApprovalsSetParams: typeof ExecApprovalsSetParamsSchema;
  ExecApprovalsNodeGetParams: typeof ExecApprovalsNodeGetParamsSchema;
  ExecApprovalsNodeSetParams: typeof ExecApprovalsNodeSetParamsSchema;
  ExecApprovalsSnapshot: typeof ExecApprovalsSnapshotSchema;
  ExecApprovalGetParams: typeof ExecApprovalGetParamsSchema;
  ExecApprovalRequestParams: typeof ExecApprovalRequestParamsSchema;
  ExecApprovalResolveParams: typeof ExecApprovalResolveParamsSchema;
  PluginApprovalRequestParams: typeof PluginApprovalRequestParamsSchema;
  PluginApprovalResolveParams: typeof PluginApprovalResolveParamsSchema;
  DevicePairListParams: typeof DevicePairListParamsSchema;
  DevicePairApproveParams: typeof DevicePairApproveParamsSchema;
  DevicePairRejectParams: typeof DevicePairRejectParamsSchema;
  DevicePairRemoveParams: typeof DevicePairRemoveParamsSchema;
  DeviceTokenRotateParams: typeof DeviceTokenRotateParamsSchema;
  DeviceTokenRevokeParams: typeof DeviceTokenRevokeParamsSchema;
  DevicePairRequestedEvent: typeof DevicePairRequestedEventSchema;
  DevicePairResolvedEvent: typeof DevicePairResolvedEventSchema;
  ChatHistoryParams: typeof ChatHistoryParamsSchema;
  ChatSendParams: typeof ChatSendParamsSchema;
  ChatAbortParams: typeof ChatAbortParamsSchema;
  ChatInjectParams: typeof ChatInjectParamsSchema;
  ChatEvent: typeof ChatEventSchema;
  UpdateRunParams: typeof UpdateRunParamsSchema;
  TickEvent: typeof TickEventSchema;
  ShutdownEvent: typeof ShutdownEventSchema;
  AutonomySeedTaskTemplate: typeof AutonomySeedTaskTemplateSchema;
  AutonomyLoopTemplate: typeof AutonomyLoopTemplateSchema;
  AutonomyBootstrapTemplate: typeof AutonomyBootstrapTemplateSchema;
  AutonomyAgentProfile: typeof AutonomyAgentProfileSchema;
  AutonomyFleetHistorySource: typeof AutonomyFleetHistorySourceSchema;
  AutonomyFleetHistoryMode: typeof AutonomyFleetHistoryModeSchema;
  AutonomyFleetHistoryTotals: typeof AutonomyFleetHistoryTotalsSchema;
  AutonomyFleetHistoryEntry: typeof AutonomyFleetHistoryEntrySchema;
  AutonomyFleetHistoryEvent: typeof AutonomyFleetHistoryEventSchema;
  AutonomyListParams: typeof AutonomyListParamsSchema;
  AutonomyListResult: typeof AutonomyListResultSchema;
  AutonomyOverviewParams: typeof AutonomyOverviewParamsSchema;
  AutonomyOverviewResult: typeof AutonomyOverviewResultSchema;
  AutonomyCapabilityInventoryEnvelope: typeof AutonomyCapabilityInventoryEnvelopeSchema;
  AutonomyCapabilityInventoryEntryActivation: typeof AutonomyCapabilityInventoryEntryActivationSchema;
  AutonomyCapabilityInventoryEntry: typeof AutonomyCapabilityInventoryEntrySchema;
  AutonomyCapabilityGap: typeof AutonomyCapabilityGapSchema;
  AutonomyCapabilityInventorySummary: typeof AutonomyCapabilityInventorySummarySchema;
  AutonomyCapabilityInventoryParams: typeof AutonomyCapabilityInventoryParamsSchema;
  AutonomyCapabilityInventoryResult: typeof AutonomyCapabilityInventoryResultSchema;
  AutonomyFleetStatusHealth: typeof AutonomyFleetStatusHealthSchema;
  AutonomyFleetStatusSuggestedAction: typeof AutonomyFleetStatusSuggestedActionSchema;
  AutonomyFleetStatusEntry: typeof AutonomyFleetStatusEntrySchema;
  AutonomyFleetStatusResult: typeof AutonomyFleetStatusResultSchema;
  AutonomyGenesisPlanStage: typeof AutonomyGenesisPlanStageSchema;
  AutonomyGenesisPlanParams: typeof AutonomyGenesisPlanParamsSchema;
  AutonomyGenesisPlanResult: typeof AutonomyGenesisPlanResultSchema;
  AutonomyGenesisPlanEnvelope: typeof AutonomyGenesisPlanEnvelopeSchema;
  AutonomyHealParams: typeof AutonomyHealParamsSchema;
  AutonomyHealResultEnvelope: typeof AutonomyHealResultEnvelopeSchema;
  AutonomyFleetHealLoopAction: typeof AutonomyFleetHealLoopActionSchema;
  AutonomyFleetHealFlowAction: typeof AutonomyFleetHealFlowActionSchema;
  AutonomyFleetHealEntry: typeof AutonomyFleetHealEntrySchema;
  AutonomyFleetHealResult: typeof AutonomyFleetHealResultSchema;
  AutonomySupervisorGovernanceMode: typeof AutonomySupervisorGovernanceModeSchema;
  AutonomySupervisorSummary: typeof AutonomySupervisorSummarySchema;
  AutonomySuperviseParams: typeof AutonomySuperviseParamsSchema;
  AutonomySuperviseResult: typeof AutonomySuperviseResultSchema;
  AutonomySuperviseResultEnvelope: typeof AutonomySuperviseResultEnvelopeSchema;
  AutonomyHistoryParams: typeof AutonomyHistoryParamsSchema;
  AutonomyFleetHistoryResult: typeof AutonomyFleetHistoryResultSchema;
  AutonomyHistoryResultEnvelope: typeof AutonomyHistoryResultEnvelopeSchema;
  AutonomyGovernanceProposalItem: typeof AutonomyGovernanceProposalItemSchema;
  AutonomyGovernanceProposalsParams: typeof AutonomyGovernanceProposalsParamsSchema;
  AutonomyGovernanceProposalsResult: typeof AutonomyGovernanceProposalsResultSchema;
  AutonomyGovernanceProposalsEnvelope: typeof AutonomyGovernanceProposalsEnvelopeSchema;
  AutonomyGovernanceReconcileParams: typeof AutonomyGovernanceReconcileParamsSchema;
  AutonomyGovernanceReconcileResult: typeof AutonomyGovernanceReconcileResultSchema;
  AutonomyGovernanceReconcileEnvelope: typeof AutonomyGovernanceReconcileEnvelopeSchema;
  AutonomyShowParams: typeof AutonomyShowParamsSchema;
  AutonomyShowResult: typeof AutonomyShowResultSchema;
  AutonomyStartParams: typeof AutonomyStartParamsSchema;
  AutonomySubmitSandboxReplayParams: typeof AutonomySubmitSandboxReplayParamsSchema;
  AutonomySubmitSandboxReplayResult: typeof AutonomySubmitSandboxReplayResultSchema;
  AutonomySubmitSandboxReplayEnvelope: typeof AutonomySubmitSandboxReplayEnvelopeSchema;
  AutonomyCancelParams: typeof AutonomyCancelParamsSchema;
  AutonomyLoopShowParams: typeof AutonomyLoopShowParamsSchema;
  AutonomyLoopUpsertParams: typeof AutonomyLoopUpsertParamsSchema;
  AutonomyLoopRemoveParams: typeof AutonomyLoopRemoveParamsSchema;
  AutonomyLoopReconcileParams: typeof AutonomyLoopReconcileParamsSchema;
  SandboxUniversePromotionGateDecision: typeof SandboxUniversePromotionGateDecisionSchema;
};

const protocolSchemas: ProtocolSchemaMap = {
  ConnectParams: ConnectParamsSchema,
  HelloOk: HelloOkSchema,
  RequestFrame: RequestFrameSchema,
  ResponseFrame: ResponseFrameSchema,
  EventFrame: EventFrameSchema,
  GatewayFrame: GatewayFrameSchema,
  PresenceEntry: PresenceEntrySchema,
  StateVersion: StateVersionSchema,
  Snapshot: SnapshotSchema,
  ErrorShape: ErrorShapeSchema,
  AgentEvent: AgentEventSchema,
  MessageActionParams: MessageActionParamsSchema,
  SendParams: SendParamsSchema,
  PollParams: PollParamsSchema,
  AgentParams: AgentParamsSchema,
  AgentIdentityParams: AgentIdentityParamsSchema,
  AgentIdentityResult: AgentIdentityResultSchema,
  AgentWaitParams: AgentWaitParamsSchema,
  WakeParams: WakeParamsSchema,
  NodePairRequestParams: NodePairRequestParamsSchema,
  NodePairListParams: NodePairListParamsSchema,
  NodePairApproveParams: NodePairApproveParamsSchema,
  NodePairRejectParams: NodePairRejectParamsSchema,
  NodePairVerifyParams: NodePairVerifyParamsSchema,
  NodeRenameParams: NodeRenameParamsSchema,
  NodeListParams: NodeListParamsSchema,
  NodePendingAckParams: NodePendingAckParamsSchema,
  NodeDescribeParams: NodeDescribeParamsSchema,
  NodeInvokeParams: NodeInvokeParamsSchema,
  NodeInvokeResultParams: NodeInvokeResultParamsSchema,
  NodeEventParams: NodeEventParamsSchema,
  NodePendingDrainParams: NodePendingDrainParamsSchema,
  NodePendingDrainResult: NodePendingDrainResultSchema,
  NodePendingEnqueueParams: NodePendingEnqueueParamsSchema,
  NodePendingEnqueueResult: NodePendingEnqueueResultSchema,
  NodeInvokeRequestEvent: NodeInvokeRequestEventSchema,
  PushTestParams: PushTestParamsSchema,
  PushTestResult: PushTestResultSchema,
  SecretsReloadParams: SecretsReloadParamsSchema,
  SecretsResolveParams: SecretsResolveParamsSchema,
  SecretsResolveAssignment: SecretsResolveAssignmentSchema,
  SecretsResolveResult: SecretsResolveResultSchema,
  SessionsListParams: SessionsListParamsSchema,
  SessionsPreviewParams: SessionsPreviewParamsSchema,
  SessionsResolveParams: SessionsResolveParamsSchema,
  SessionCompactionCheckpoint: SessionCompactionCheckpointSchema,
  SessionsCompactionListParams: SessionsCompactionListParamsSchema,
  SessionsCompactionGetParams: SessionsCompactionGetParamsSchema,
  SessionsCompactionBranchParams: SessionsCompactionBranchParamsSchema,
  SessionsCompactionRestoreParams: SessionsCompactionRestoreParamsSchema,
  SessionsCompactionListResult: SessionsCompactionListResultSchema,
  SessionsCompactionGetResult: SessionsCompactionGetResultSchema,
  SessionsCompactionBranchResult: SessionsCompactionBranchResultSchema,
  SessionsCompactionRestoreResult: SessionsCompactionRestoreResultSchema,
  SessionsCreateParams: SessionsCreateParamsSchema,
  SessionsSendParams: SessionsSendParamsSchema,
  SessionsMessagesSubscribeParams: SessionsMessagesSubscribeParamsSchema,
  SessionsMessagesUnsubscribeParams: SessionsMessagesUnsubscribeParamsSchema,
  SessionsAbortParams: SessionsAbortParamsSchema,
  SessionsPatchParams: SessionsPatchParamsSchema,
  SessionsResetParams: SessionsResetParamsSchema,
  SessionsDeleteParams: SessionsDeleteParamsSchema,
  SessionsCompactParams: SessionsCompactParamsSchema,
  SessionsUsageParams: SessionsUsageParamsSchema,
  ConfigGetParams: ConfigGetParamsSchema,
  ConfigSetParams: ConfigSetParamsSchema,
  ConfigApplyParams: ConfigApplyParamsSchema,
  ConfigPatchParams: ConfigPatchParamsSchema,
  ConfigSchemaParams: ConfigSchemaParamsSchema,
  ConfigSchemaLookupParams: ConfigSchemaLookupParamsSchema,
  ConfigSchemaResponse: ConfigSchemaResponseSchema,
  ConfigSchemaLookupResult: ConfigSchemaLookupResultSchema,
  WizardStartParams: WizardStartParamsSchema,
  WizardNextParams: WizardNextParamsSchema,
  WizardCancelParams: WizardCancelParamsSchema,
  WizardStatusParams: WizardStatusParamsSchema,
  WizardStep: WizardStepSchema,
  WizardNextResult: WizardNextResultSchema,
  WizardStartResult: WizardStartResultSchema,
  WizardStatusResult: WizardStatusResultSchema,
  TalkModeParams: TalkModeParamsSchema,
  TalkConfigParams: TalkConfigParamsSchema,
  TalkConfigResult: TalkConfigResultSchema,
  TalkSpeakParams: TalkSpeakParamsSchema,
  TalkSpeakResult: TalkSpeakResultSchema,
  ChannelsStatusParams: ChannelsStatusParamsSchema,
  ChannelsStatusResult: ChannelsStatusResultSchema,
  ChannelsLogoutParams: ChannelsLogoutParamsSchema,
  WebLoginStartParams: WebLoginStartParamsSchema,
  WebLoginWaitParams: WebLoginWaitParamsSchema,
  AgentSummary: AgentSummarySchema,
  AgentGovernanceRuntimeContract: AgentGovernanceRuntimeContractSchema,
  AgentGovernanceRuntimeSnapshot: AgentGovernanceRuntimeSnapshotSchema,
  GovernanceOverviewParams: GovernanceOverviewParamsSchema,
  GovernanceOverviewResult: GovernanceOverviewResultSchema,
  GovernanceAgentParams: GovernanceAgentParamsSchema,
  GovernanceAgentResult: GovernanceAgentResultSchema,
  GovernanceTeamMemberRecord: GovernanceTeamMemberRecordSchema,
  GovernanceTeamParams: GovernanceTeamParamsSchema,
  GovernanceTeamResult: GovernanceTeamResultSchema,
  GovernanceCapabilityInventoryEntryActivation:
    GovernanceCapabilityInventoryEntryActivationSchema,
  GovernanceCapabilityInventoryEntry: GovernanceCapabilityInventoryEntrySchema,
  GovernanceCapabilityGap: GovernanceCapabilityGapSchema,
  GovernanceCapabilityInventorySummary: GovernanceCapabilityInventorySummarySchema,
  GovernanceCapabilityInventoryParams: GovernanceCapabilityInventoryParamsSchema,
  GovernanceCapabilityInventoryResult: GovernanceCapabilityInventoryResultSchema,
  GovernanceCapabilityAssetRecord: GovernanceCapabilityAssetRecordSchema,
  GovernanceCapabilityAssetRegistryFile: GovernanceCapabilityAssetRegistryFileSchema,
  GovernanceCapabilityAssetRegistrySnapshot: GovernanceCapabilityAssetRegistrySnapshotSchema,
  GovernanceCapabilityAssetRegistryParams: GovernanceCapabilityAssetRegistryParamsSchema,
  GovernanceCapabilityAssetRegistryResult: GovernanceCapabilityAssetRegistryResultSchema,
  GovernanceGenesisPlanStage: GovernanceGenesisPlanStageSchema,
  GovernanceGenesisPlanParams: GovernanceGenesisPlanParamsSchema,
  GovernanceGenesisPlanResult: GovernanceGenesisPlanResultSchema,
  GovernanceProposalOperation: GovernanceProposalOperationSchema,
  GovernanceProposalReviewRecord: GovernanceProposalReviewRecordSchema,
  GovernanceProposalApplyRecord: GovernanceProposalApplyRecordSchema,
  GovernanceProposalBatchSelection: GovernanceProposalBatchSelectionSchema,
  GovernanceProposalBatchEntry: GovernanceProposalBatchEntrySchema,
  GovernanceProposalReconcileEntry: GovernanceProposalReconcileEntrySchema,
  GovernanceProposalRecord: GovernanceProposalRecordSchema,
  GovernanceProposalSummary: GovernanceProposalSummarySchema,
  GovernanceProposalLedger: GovernanceProposalLedgerSchema,
  GovernanceProposalsListParams: GovernanceProposalsListParamsSchema,
  GovernanceProposalsListResult: GovernanceProposalsListResultSchema,
  GovernanceProposalsReconcileMode: GovernanceProposalsReconcileModeSchema,
  GovernanceProposalsReconcileParams: GovernanceProposalsReconcileParamsSchema,
  GovernanceProposalsReconcileResult: GovernanceProposalsReconcileResultSchema,
  GovernanceProposalsSynthesizeParams: GovernanceProposalsSynthesizeParamsSchema,
  GovernanceProposalsSynthesizeResult: GovernanceProposalsSynthesizeResultSchema,
  GovernanceProposalsCreateParams: GovernanceProposalsCreateParamsSchema,
  GovernanceProposalsCreateResult: GovernanceProposalsCreateResultSchema,
  GovernanceProposalsReviewParams: GovernanceProposalsReviewParamsSchema,
  GovernanceProposalsReviewResult: GovernanceProposalsReviewResultSchema,
  GovernanceProposalsReviewManyParams: GovernanceProposalsReviewManyParamsSchema,
  GovernanceProposalsReviewManyResult: GovernanceProposalsReviewManyResultSchema,
  GovernanceProposalsApplyParams: GovernanceProposalsApplyParamsSchema,
  GovernanceProposalsApplyResult: GovernanceProposalsApplyResultSchema,
  GovernanceProposalsApplyManyParams: GovernanceProposalsApplyManyParamsSchema,
  GovernanceProposalsApplyManyResult: GovernanceProposalsApplyManyResultSchema,
  GovernanceProposalsRevertParams: GovernanceProposalsRevertParamsSchema,
  GovernanceProposalsRevertResult: GovernanceProposalsRevertResultSchema,
  GovernanceProposalsRevertManyParams: GovernanceProposalsRevertManyParamsSchema,
  GovernanceProposalsRevertManyResult: GovernanceProposalsRevertManyResultSchema,
  AgentsCreateParams: AgentsCreateParamsSchema,
  AgentsCreateResult: AgentsCreateResultSchema,
  AgentsUpdateParams: AgentsUpdateParamsSchema,
  AgentsUpdateResult: AgentsUpdateResultSchema,
  AgentsDeleteParams: AgentsDeleteParamsSchema,
  AgentsDeleteResult: AgentsDeleteResultSchema,
  AgentsFileEntry: AgentsFileEntrySchema,
  AgentsFilesListParams: AgentsFilesListParamsSchema,
  AgentsFilesListResult: AgentsFilesListResultSchema,
  AgentsFilesGetParams: AgentsFilesGetParamsSchema,
  AgentsFilesGetResult: AgentsFilesGetResultSchema,
  AgentsFilesSetParams: AgentsFilesSetParamsSchema,
  AgentsFilesSetResult: AgentsFilesSetResultSchema,
  AgentsListParams: AgentsListParamsSchema,
  AgentsListResult: AgentsListResultSchema,
  ModelChoice: ModelChoiceSchema,
  ModelsListParams: ModelsListParamsSchema,
  ModelsListResult: ModelsListResultSchema,
  CommandEntry: CommandEntrySchema,
  CommandsListParams: CommandsListParamsSchema,
  CommandsListResult: CommandsListResultSchema,
  SkillsStatusParams: SkillsStatusParamsSchema,
  ToolsCatalogParams: ToolsCatalogParamsSchema,
  ToolCatalogProfile: ToolCatalogProfileSchema,
  ToolCatalogEntry: ToolCatalogEntrySchema,
  ToolCatalogGroup: ToolCatalogGroupSchema,
  ToolGovernanceSummary: ToolGovernanceSummarySchema,
  ToolsCatalogResult: ToolsCatalogResultSchema,
  ToolsEffectiveParams: ToolsEffectiveParamsSchema,
  ToolsEffectiveEntry: ToolsEffectiveEntrySchema,
  ToolsEffectiveGroup: ToolsEffectiveGroupSchema,
  ToolsEffectiveResult: ToolsEffectiveResultSchema,
  SkillsBinsParams: SkillsBinsParamsSchema,
  SkillsBinsResult: SkillsBinsResultSchema,
  SkillsSearchParams: SkillsSearchParamsSchema,
  SkillsSearchResult: SkillsSearchResultSchema,
  SkillsDetailParams: SkillsDetailParamsSchema,
  SkillsDetailResult: SkillsDetailResultSchema,
  SkillsInstallParams: SkillsInstallParamsSchema,
  SkillsUpdateParams: SkillsUpdateParamsSchema,
  CronJob: CronJobSchema,
  CronListParams: CronListParamsSchema,
  CronStatusParams: CronStatusParamsSchema,
  CronAddParams: CronAddParamsSchema,
  CronUpdateParams: CronUpdateParamsSchema,
  CronRemoveParams: CronRemoveParamsSchema,
  CronRunParams: CronRunParamsSchema,
  CronRunsParams: CronRunsParamsSchema,
  CronRunLogEntry: CronRunLogEntrySchema,
  LogsTailParams: LogsTailParamsSchema,
  LogsTailResult: LogsTailResultSchema,
  ExecApprovalsGetParams: ExecApprovalsGetParamsSchema,
  ExecApprovalsSetParams: ExecApprovalsSetParamsSchema,
  ExecApprovalsNodeGetParams: ExecApprovalsNodeGetParamsSchema,
  ExecApprovalsNodeSetParams: ExecApprovalsNodeSetParamsSchema,
  ExecApprovalsSnapshot: ExecApprovalsSnapshotSchema,
  ExecApprovalGetParams: ExecApprovalGetParamsSchema,
  ExecApprovalRequestParams: ExecApprovalRequestParamsSchema,
  ExecApprovalResolveParams: ExecApprovalResolveParamsSchema,
  PluginApprovalRequestParams: PluginApprovalRequestParamsSchema,
  PluginApprovalResolveParams: PluginApprovalResolveParamsSchema,
  DevicePairListParams: DevicePairListParamsSchema,
  DevicePairApproveParams: DevicePairApproveParamsSchema,
  DevicePairRejectParams: DevicePairRejectParamsSchema,
  DevicePairRemoveParams: DevicePairRemoveParamsSchema,
  DeviceTokenRotateParams: DeviceTokenRotateParamsSchema,
  DeviceTokenRevokeParams: DeviceTokenRevokeParamsSchema,
  DevicePairRequestedEvent: DevicePairRequestedEventSchema,
  DevicePairResolvedEvent: DevicePairResolvedEventSchema,
  ChatHistoryParams: ChatHistoryParamsSchema,
  ChatSendParams: ChatSendParamsSchema,
  ChatAbortParams: ChatAbortParamsSchema,
  ChatInjectParams: ChatInjectParamsSchema,
  ChatEvent: ChatEventSchema,
  UpdateRunParams: UpdateRunParamsSchema,
  TickEvent: TickEventSchema,
  ShutdownEvent: ShutdownEventSchema,
  AutonomySeedTaskTemplate: AutonomySeedTaskTemplateSchema,
  AutonomyLoopTemplate: AutonomyLoopTemplateSchema,
  AutonomyBootstrapTemplate: AutonomyBootstrapTemplateSchema,
  AutonomyAgentProfile: AutonomyAgentProfileSchema,
  AutonomyFleetHistorySource: AutonomyFleetHistorySourceSchema,
  AutonomyFleetHistoryMode: AutonomyFleetHistoryModeSchema,
  AutonomyFleetHistoryTotals: AutonomyFleetHistoryTotalsSchema,
  AutonomyFleetHistoryEntry: AutonomyFleetHistoryEntrySchema,
  AutonomyFleetHistoryEvent: AutonomyFleetHistoryEventSchema,
  AutonomyListParams: AutonomyListParamsSchema,
  AutonomyListResult: AutonomyListResultSchema,
  AutonomyOverviewParams: AutonomyOverviewParamsSchema,
  AutonomyOverviewResult: AutonomyOverviewResultSchema,
  AutonomyCapabilityInventoryEnvelope: AutonomyCapabilityInventoryEnvelopeSchema,
  AutonomyCapabilityInventoryEntryActivation: AutonomyCapabilityInventoryEntryActivationSchema,
  AutonomyCapabilityInventoryEntry: AutonomyCapabilityInventoryEntrySchema,
  AutonomyCapabilityGap: AutonomyCapabilityGapSchema,
  AutonomyCapabilityInventorySummary: AutonomyCapabilityInventorySummarySchema,
  AutonomyCapabilityInventoryParams: AutonomyCapabilityInventoryParamsSchema,
  AutonomyCapabilityInventoryResult: AutonomyCapabilityInventoryResultSchema,
  AutonomyFleetStatusHealth: AutonomyFleetStatusHealthSchema,
  AutonomyFleetStatusSuggestedAction: AutonomyFleetStatusSuggestedActionSchema,
  AutonomyFleetStatusEntry: AutonomyFleetStatusEntrySchema,
  AutonomyFleetStatusResult: AutonomyFleetStatusResultSchema,
  AutonomyGenesisPlanStage: AutonomyGenesisPlanStageSchema,
  AutonomyGenesisPlanParams: AutonomyGenesisPlanParamsSchema,
  AutonomyGenesisPlanResult: AutonomyGenesisPlanResultSchema,
  AutonomyGenesisPlanEnvelope: AutonomyGenesisPlanEnvelopeSchema,
  AutonomyHealParams: AutonomyHealParamsSchema,
  AutonomyHealResultEnvelope: AutonomyHealResultEnvelopeSchema,
  AutonomyFleetHealLoopAction: AutonomyFleetHealLoopActionSchema,
  AutonomyFleetHealFlowAction: AutonomyFleetHealFlowActionSchema,
  AutonomyFleetHealEntry: AutonomyFleetHealEntrySchema,
  AutonomyFleetHealResult: AutonomyFleetHealResultSchema,
  AutonomySupervisorGovernanceMode: AutonomySupervisorGovernanceModeSchema,
  AutonomySupervisorSummary: AutonomySupervisorSummarySchema,
  AutonomySuperviseParams: AutonomySuperviseParamsSchema,
  AutonomySuperviseResult: AutonomySuperviseResultSchema,
  AutonomySuperviseResultEnvelope: AutonomySuperviseResultEnvelopeSchema,
  AutonomyHistoryParams: AutonomyHistoryParamsSchema,
  AutonomyFleetHistoryResult: AutonomyFleetHistoryResultSchema,
  AutonomyHistoryResultEnvelope: AutonomyHistoryResultEnvelopeSchema,
  AutonomyGovernanceProposalItem: AutonomyGovernanceProposalItemSchema,
  AutonomyGovernanceProposalsParams: AutonomyGovernanceProposalsParamsSchema,
  AutonomyGovernanceProposalsResult: AutonomyGovernanceProposalsResultSchema,
  AutonomyGovernanceProposalsEnvelope: AutonomyGovernanceProposalsEnvelopeSchema,
  AutonomyGovernanceReconcileParams: AutonomyGovernanceReconcileParamsSchema,
  AutonomyGovernanceReconcileResult: AutonomyGovernanceReconcileResultSchema,
  AutonomyGovernanceReconcileEnvelope: AutonomyGovernanceReconcileEnvelopeSchema,
  AutonomyShowParams: AutonomyShowParamsSchema,
  AutonomyShowResult: AutonomyShowResultSchema,
  AutonomyStartParams: AutonomyStartParamsSchema,
  AutonomySubmitSandboxReplayParams: AutonomySubmitSandboxReplayParamsSchema,
  AutonomySubmitSandboxReplayResult: AutonomySubmitSandboxReplayResultSchema,
  AutonomySubmitSandboxReplayEnvelope: AutonomySubmitSandboxReplayEnvelopeSchema,
  AutonomyCancelParams: AutonomyCancelParamsSchema,
  AutonomyLoopShowParams: AutonomyLoopShowParamsSchema,
  AutonomyLoopUpsertParams: AutonomyLoopUpsertParamsSchema,
  AutonomyLoopRemoveParams: AutonomyLoopRemoveParamsSchema,
  AutonomyLoopReconcileParams: AutonomyLoopReconcileParamsSchema,
  SandboxUniversePromotionGateDecision: SandboxUniversePromotionGateDecisionSchema,
} satisfies Record<string, TSchema>;

export type ProtocolSchemaName = keyof ProtocolSchemaMap;

export const ProtocolSchemas: ProtocolSchemaMap = protocolSchemas;

export const PROTOCOL_VERSION = 3 as const;
