import { resolveRequiredOperatorScopeForMethod } from "../method-scopes.js";
import {
  ErrorCodes,
  errorShape,
  formatValidationErrors,
  ProtocolSchemas,
  type GatewayMethodDescribeResult,
  type GatewayMethodsResult,
  validateGatewayMethodDescribeParams,
  validateGatewayMethodsParams,
} from "../protocol/index.js";
import { listGatewayMethods } from "../server-methods-list.js";
import type { GatewayRequestHandlers } from "./types.js";

function resolveMethodCategory(method: string): string {
  const [category] = method.split(/[.:]/);
  return category || method;
}

function buildGatewayMethodsResult(query?: string): GatewayMethodsResult {
  const normalizedQuery = query?.trim().toLowerCase() ?? "";
  const methods = listGatewayMethods()
    .map((name) => ({
      name,
      category: resolveMethodCategory(name),
      scope: resolveRequiredOperatorScopeForMethod(name),
    }))
    .filter((method) => {
      if (!normalizedQuery) {
        return true;
      }
      return [method.name, method.category, method.scope]
        .filter((value): value is string => typeof value === "string")
        .some((value) => value.toLowerCase().includes(normalizedQuery));
    });

  return {
    count: methods.length,
    ...(normalizedQuery ? { query: query?.trim() } : {}),
    methods,
  };
}

const METHOD_SCHEMA_NAMES: Record<
  string,
  { params?: keyof typeof ProtocolSchemas; result?: keyof typeof ProtocolSchemas; example?: unknown }
> = {
  "agents.list": { params: "AgentsListParams", result: "AgentsListResult" },
  "agents.parallel.start": {
    params: "AgentsParallelStartParams",
    result: "AgentsParallelBatchResult",
    example: {
      parentSessionKey: "agent:main:main",
      concurrency: 3,
      tasks: [
        { agentId: "researcher", goal: "Inspect constraints" },
        { agentId: "developer", goal: "Implement patch" },
      ],
    },
  },
  "agents.parallel.status": {
    params: "AgentsParallelStatusParams",
    result: "AgentsParallelBatchResult",
    example: { batchId: "parallel_example" },
  },
  "agents.parallel.list": {
    params: "AgentsParallelListParams",
    result: "AgentsParallelListResult",
    example: { limit: 10 },
  },
  "agents.parallel.cancel": {
    params: "AgentsParallelCancelParams",
    result: "AgentsParallelBatchResult",
    example: { batchId: "parallel_example" },
  },
  "autonomy.overview": { params: "AutonomyOverviewParams", result: "AutonomyOverviewResult" },
  "business.tasks.list": {
    example: { status: "running", limit: 20 },
  },
  "channels.status": { params: "ChannelsStatusParams", result: "ChannelsStatusResult" },
  "commands.list": { params: "CommandsListParams", result: "CommandsListResult" },
  "config.get": { params: "ConfigGetParams" },
  "config.schema.lookup": {
    params: "ConfigSchemaLookupParams",
    result: "ConfigSchemaLookupResult",
    example: { path: "gateway" },
  },
  "cron.list": { params: "CronListParams" },
  "cron.status": { params: "CronStatusParams" },
  "gateway.method.describe": {
    params: "GatewayMethodDescribeParams",
    result: "GatewayMethodDescribeResult",
    example: { method: "business.tasks.list" },
  },
  "gateway.methods": {
    params: "GatewayMethodsParams",
    result: "GatewayMethodsResult",
    example: { query: "business" },
  },
  "experience.capture": {
    params: "ExperienceCaptureParams",
    result: "ExperienceCaptureResult",
    example: {
      kind: "lesson",
      summary: "Remote model probing should wait for explicit endpoint input.",
      source: "tui",
      tags: ["models"],
    },
  },
  "experience.search": {
    params: "ExperienceSearchParams",
    result: "ExperienceSearchResult",
    example: { query: "remote model", limit: 10 },
  },
  "experience.summary": {
    params: "ExperienceSummaryParams",
    result: "ExperienceSummaryResult",
    example: { limit: 10 },
  },
  "skill.candidates.list": {
    params: "SkillCandidatesListParams",
    result: "SkillCandidatesListResult",
    example: { status: "proposed", limit: 10 },
  },
  "skill.candidates.create": {
    params: "SkillCandidatesCreateParams",
    result: "SkillCandidatesCreateResult",
    example: {
      title: "Remote model setup guard",
      trigger: "When configuring a remote provider endpoint",
      steps: ["Validate endpoint", "Probe provider-specific model API", "Persist result"],
    },
  },
  "self.model.get": {
    params: "SelfModelGetParams",
    result: "SelfModelGetResult",
  },
  "self.model.update": {
    params: "SelfModelUpdateParams",
    result: "SelfModelUpdateResult",
    example: { learnedPatterns: ["Prefer durable memory for repeated fixes"] },
  },
  "governance.overview": { params: "GovernanceOverviewParams", result: "GovernanceOverviewResult" },
  "logs.tail": { params: "LogsTailParams", result: "LogsTailResult", example: { limit: 100 } },
  "models.list": { params: "ModelsListParams", result: "ModelsListResult" },
  "models.remoteList": {
    params: "ModelsRemoteListParams",
    result: "ModelsRemoteListResult",
    example: { endpoint: "http://127.0.0.1:11434", api: "ollama" },
  },
  "sessions.list": {
    params: "SessionsListParams",
    example: { limit: 20, includeDerivedTitles: true, includeLastMessage: true },
  },
  "skills.search": {
    params: "SkillsSearchParams",
    result: "SkillsSearchResult",
    example: { query: "browser", limit: 10 },
  },
  "skills.status": { params: "SkillsStatusParams" },
  "tools.catalog": {
    params: "ToolsCatalogParams",
    result: "ToolsCatalogResult",
    example: { includePlugins: true },
  },
  "tools.effective": {
    params: "ToolsEffectiveParams",
    result: "ToolsEffectiveResult",
    example: { sessionKey: "agent:main:main", agentId: "main" },
  },
};

function businessTaskParamsSchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      status: {
        type: "string",
        enum: ["pending", "running", "completed", "failed", "cancelled"],
      },
      limit: { type: "integer", minimum: 1 },
    },
  };
}

function resolveExampleParams(method: string): unknown {
  const configured = METHOD_SCHEMA_NAMES[method]?.example;
  if (configured !== undefined) {
    return configured;
  }
  return {};
}

function resolveParamsSchema(method: string): unknown {
  if (method === "business.tasks.list") {
    return businessTaskParamsSchema();
  }
  const schemaName = METHOD_SCHEMA_NAMES[method]?.params;
  return schemaName ? ProtocolSchemas[schemaName] : undefined;
}

function resolveResultSchema(method: string): unknown {
  const schemaName = METHOD_SCHEMA_NAMES[method]?.result;
  return schemaName ? ProtocolSchemas[schemaName] : undefined;
}

function buildCallTemplate(method: string, exampleParams: unknown): string {
  if (
    exampleParams &&
    typeof exampleParams === "object" &&
    !Array.isArray(exampleParams) &&
    Object.keys(exampleParams).length > 0
  ) {
    return `/gateway-call ${method} ${JSON.stringify(exampleParams, null, 2)}`;
  }
  return `/gateway-call ${method}`;
}

function buildGatewayMethodDescribeResult(method: string): GatewayMethodDescribeResult | null {
  if (!listGatewayMethods().includes(method)) {
    return null;
  }
  const methodEntry = {
    name: method,
    category: resolveMethodCategory(method),
    scope: resolveRequiredOperatorScopeForMethod(method),
  };
  const exampleParams = resolveExampleParams(method);
  return {
    method: methodEntry,
    paramsSchema: resolveParamsSchema(method),
    resultSchema: resolveResultSchema(method),
    exampleParams,
    callTemplate: buildCallTemplate(method, exampleParams),
  };
}

export const gatewayMethodsHandlers: GatewayRequestHandlers = {
  "gateway.methods": ({ params, respond }) => {
    if (!validateGatewayMethodsParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid gateway.methods params: ${formatValidationErrors(validateGatewayMethodsParams.errors)}`,
        ),
      );
      return;
    }
    respond(true, buildGatewayMethodsResult(params.query), undefined);
  },
  "gateway.method.describe": ({ params, respond }) => {
    if (!validateGatewayMethodDescribeParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid gateway.method.describe params: ${formatValidationErrors(validateGatewayMethodDescribeParams.errors)}`,
        ),
      );
      return;
    }
    const result = buildGatewayMethodDescribeResult(params.method);
    if (!result) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, `unknown gateway method: ${params.method}`),
      );
      return;
    }
    respond(true, result, undefined);
  },
};
