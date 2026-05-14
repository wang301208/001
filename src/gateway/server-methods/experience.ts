import {
  captureExperienceEvent,
  captureStrategicMemory,
  advanceStrategicMemoryPush,
  advanceSelfRoadmap,
  createSkillCandidate,
  exportSkillCandidateAsAgentSkill,
  getSelfModel,
  getSelfOverview,
  getSelfRoadmap,
  listSkillCandidates,
  listDueStrategicPushes,
  queryUserModelDialectic,
  recallSessionMemory,
  recommendReusableSkills,
  recordSkillUsage,
  searchExperience,
  summarizeExperience,
  updateUserModel,
  updateSelfModel,
} from "../../experience/experience-store.js";
import {
  validateExperienceCaptureParams,
  validateExperienceSearchParams,
  validateExperienceSessionRecallParams,
  validateExperienceSummaryParams,
  validateSelfModelGetParams,
  validateSelfModelUpdateParams,
  validateSelfOverviewParams,
  validateSelfRoadmapParams,
  validateSelfSkillsRecommendParams,
  validateSkillCandidatesCreateParams,
  validateSkillCandidatesExportAgentSkillParams,
  validateSkillCandidatesListParams,
  validateSkillUsageRecordParams,
  validateStrategyMemoryCaptureParams,
  validateStrategyMemoryAdvanceParams,
  validateStrategyMemoryDueParams,
  validateUserModelDialecticParams,
  validateUserModelUpdateParams,
} from "../protocol/index.js";
import type { GatewayRequestHandlers } from "./types.js";
import { assertValidParams } from "./validation.js";
import {
  getGatewayAutomationRuntimeState,
  getGatewayBackendAutomationHistory,
} from "../server-runtime-services.js";

export const experienceHandlers: GatewayRequestHandlers = {
  "experience.capture": ({ params, respond }) => {
    if (!assertValidParams(params, validateExperienceCaptureParams, "experience.capture", respond)) {
      return;
    }
    respond(true, { event: captureExperienceEvent(params) }, undefined);
  },
  "experience.search": ({ params, respond }) => {
    if (!assertValidParams(params, validateExperienceSearchParams, "experience.search", respond)) {
      return;
    }
    respond(true, searchExperience(params), undefined);
  },
  "experience.summary": ({ params, respond }) => {
    if (!assertValidParams(params, validateExperienceSummaryParams, "experience.summary", respond)) {
      return;
    }
    respond(true, summarizeExperience(params), undefined);
  },
  "experience.sessionRecall": ({ params, respond }) => {
    if (
      !assertValidParams(
        params,
        validateExperienceSessionRecallParams,
        "experience.sessionRecall",
        respond,
      )
    ) {
      return;
    }
    respond(true, recallSessionMemory(params), undefined);
  },
  "skill.candidates.list": ({ params, respond }) => {
    if (
      !assertValidParams(
        params,
        validateSkillCandidatesListParams,
        "skill.candidates.list",
        respond,
      )
    ) {
      return;
    }
    respond(true, { candidates: listSkillCandidates(params) }, undefined);
  },
  "skill.candidates.create": ({ params, respond }) => {
    if (
      !assertValidParams(
        params,
        validateSkillCandidatesCreateParams,
        "skill.candidates.create",
        respond,
      )
    ) {
      return;
    }
    respond(true, { candidate: createSkillCandidate(params) }, undefined);
  },
  "skill.usage.record": ({ params, respond }) => {
    if (
      !assertValidParams(params, validateSkillUsageRecordParams, "skill.usage.record", respond)
    ) {
      return;
    }
    respond(true, recordSkillUsage(params), undefined);
  },
  "skill.candidates.exportAgentSkill": ({ params, respond }) => {
    if (
      !assertValidParams(
        params,
        validateSkillCandidatesExportAgentSkillParams,
        "skill.candidates.exportAgentSkill",
        respond,
      )
    ) {
      return;
    }
    respond(true, exportSkillCandidateAsAgentSkill(params), undefined);
  },
  "strategy.memory.capture": ({ params, respond }) => {
    if (
      !assertValidParams(
        params,
        validateStrategyMemoryCaptureParams,
        "strategy.memory.capture",
        respond,
      )
    ) {
      return;
    }
    respond(true, { memory: captureStrategicMemory(params) }, undefined);
  },
  "strategy.memory.due": ({ params, respond }) => {
    if (
      !assertValidParams(params, validateStrategyMemoryDueParams, "strategy.memory.due", respond)
    ) {
      return;
    }
    respond(true, { pushes: listDueStrategicPushes(params) }, undefined);
  },
  "strategy.memory.advance": ({ params, respond }) => {
    if (
      !assertValidParams(
        params,
        validateStrategyMemoryAdvanceParams,
        "strategy.memory.advance",
        respond,
      )
    ) {
      return;
    }
    respond(true, { memory: advanceStrategicMemoryPush(params) }, undefined);
  },
  "self.model.get": ({ params, respond }) => {
    if (!assertValidParams(params, validateSelfModelGetParams, "self.model.get", respond)) {
      return;
    }
    respond(true, { selfModel: getSelfModel() }, undefined);
  },
  "self.model.update": ({ params, respond }) => {
    if (!assertValidParams(params, validateSelfModelUpdateParams, "self.model.update", respond)) {
      return;
    }
    respond(true, { selfModel: updateSelfModel(params) }, undefined);
  },
  "self.overview": ({ params, respond }) => {
    if (!assertValidParams(params, validateSelfOverviewParams, "self.overview", respond)) {
      return;
    }
    respond(
      true,
      {
        overview: {
          ...getSelfOverview(params),
          backendAutomation: {
            recentRuns: getGatewayBackendAutomationHistory({ limit: params.limit }),
            runtime: getGatewayAutomationRuntimeState(),
          },
        },
      },
      undefined,
    );
  },
  "self.roadmap": ({ params, respond }) => {
    if (!assertValidParams(params, validateSelfRoadmapParams, "self.roadmap", respond)) {
      return;
    }
    respond(true, { roadmap: getSelfRoadmap(params) }, undefined);
  },
  "self.roadmap.advance": ({ params, respond }) => {
    if (!assertValidParams(params, validateSelfRoadmapParams, "self.roadmap.advance", respond)) {
      return;
    }
    respond(true, advanceSelfRoadmap(params), undefined);
  },
  "self.skills.recommend": ({ params, respond }) => {
    if (!assertValidParams(params, validateSelfSkillsRecommendParams, "self.skills.recommend", respond)) {
      return;
    }
    respond(true, { recommendations: recommendReusableSkills(params) }, undefined);
  },
  "user.model.update": ({ params, respond }) => {
    if (!assertValidParams(params, validateUserModelUpdateParams, "user.model.update", respond)) {
      return;
    }
    respond(true, { userModel: updateUserModel(params) }, undefined);
  },
  "user.model.dialectic": ({ params, respond }) => {
    if (
      !assertValidParams(
        params,
        validateUserModelDialecticParams,
        "user.model.dialectic",
        respond,
      )
    ) {
      return;
    }
    respond(true, queryUserModelDialectic(params), undefined);
  },
};
