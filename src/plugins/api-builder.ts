import type { ZhushouConfig } from "../config/types.zhushou.js";
import type { PluginRuntime } from "./runtime/types.js";
import type { ZhushouPluginApi, PluginLogger } from "./types.js";

export type BuildPluginApiParams = {
  id: string;
  name: string;
  version?: string;
  description?: string;
  source: string;
  rootDir?: string;
  registrationMode: ZhushouPluginApi["registrationMode"];
  config: ZhushouConfig;
  pluginConfig?: Record<string, unknown>;
  runtime: PluginRuntime;
  logger: PluginLogger;
  resolvePath: (input: string) => string;
  handlers?: Partial<
    Pick<
      ZhushouPluginApi,
      | "registerTool"
      | "registerHook"
      | "registerHttpRoute"
      | "registerChannel"
      | "registerGatewayMethod"
      | "registerCli"
      | "registerReload"
      | "registerNodeHostCommand"
      | "registerSecurityAuditCollector"
      | "registerService"
      | "registerCliBackend"
      | "registerTextTransforms"
      | "registerConfigMigration"
      | "registerAutoEnableProbe"
      | "registerProvider"
      | "registerSpeechProvider"
      | "registerRealtimeTranscriptionProvider"
      | "registerRealtimeVoiceProvider"
      | "registerMediaUnderstandingProvider"
      | "registerImageGenerationProvider"
      | "registerVideoGenerationProvider"
      | "registerMusicGenerationProvider"
      | "registerWebFetchProvider"
      | "registerWebSearchProvider"
      | "registerInteractiveHandler"
      | "onConversationBindingResolved"
      | "registerCommand"
      | "registerContextEngine"
      | "registerCompactionProvider"
      | "registerAgentHarness"
      | "registerMemoryCapability"
      | "registerMemoryPromptSection"
      | "registerMemoryPromptSupplement"
      | "registerMemoryCorpusSupplement"
      | "registerMemoryFlushPlan"
      | "registerMemoryRuntime"
      | "registerMemoryEmbeddingProvider"
      | "on"
    >
  >;
};

const noopRegisterTool: ZhushouPluginApi["registerTool"] = () => {};
const noopRegisterHook: ZhushouPluginApi["registerHook"] = () => {};
const noopRegisterHttpRoute: ZhushouPluginApi["registerHttpRoute"] = () => {};
const noopRegisterChannel: ZhushouPluginApi["registerChannel"] = () => {};
const noopRegisterGatewayMethod: ZhushouPluginApi["registerGatewayMethod"] = () => {};
const noopRegisterCli: ZhushouPluginApi["registerCli"] = () => {};
const noopRegisterReload: ZhushouPluginApi["registerReload"] = () => {};
const noopRegisterNodeHostCommand: ZhushouPluginApi["registerNodeHostCommand"] = () => {};
const noopRegisterSecurityAuditCollector: ZhushouPluginApi["registerSecurityAuditCollector"] =
  () => {};
const noopRegisterService: ZhushouPluginApi["registerService"] = () => {};
const noopRegisterCliBackend: ZhushouPluginApi["registerCliBackend"] = () => {};
const noopRegisterTextTransforms: ZhushouPluginApi["registerTextTransforms"] = () => {};
const noopRegisterConfigMigration: ZhushouPluginApi["registerConfigMigration"] = () => {};
const noopRegisterAutoEnableProbe: ZhushouPluginApi["registerAutoEnableProbe"] = () => {};
const noopRegisterProvider: ZhushouPluginApi["registerProvider"] = () => {};
const noopRegisterSpeechProvider: ZhushouPluginApi["registerSpeechProvider"] = () => {};
const noopRegisterRealtimeTranscriptionProvider: ZhushouPluginApi["registerRealtimeTranscriptionProvider"] =
  () => {};
const noopRegisterRealtimeVoiceProvider: ZhushouPluginApi["registerRealtimeVoiceProvider"] =
  () => {};
const noopRegisterMediaUnderstandingProvider: ZhushouPluginApi["registerMediaUnderstandingProvider"] =
  () => {};
const noopRegisterImageGenerationProvider: ZhushouPluginApi["registerImageGenerationProvider"] =
  () => {};
const noopRegisterVideoGenerationProvider: ZhushouPluginApi["registerVideoGenerationProvider"] =
  () => {};
const noopRegisterMusicGenerationProvider: ZhushouPluginApi["registerMusicGenerationProvider"] =
  () => {};
const noopRegisterWebFetchProvider: ZhushouPluginApi["registerWebFetchProvider"] = () => {};
const noopRegisterWebSearchProvider: ZhushouPluginApi["registerWebSearchProvider"] = () => {};
const noopRegisterInteractiveHandler: ZhushouPluginApi["registerInteractiveHandler"] = () => {};
const noopOnConversationBindingResolved: ZhushouPluginApi["onConversationBindingResolved"] =
  () => {};
const noopRegisterCommand: ZhushouPluginApi["registerCommand"] = () => {};
const noopRegisterContextEngine: ZhushouPluginApi["registerContextEngine"] = () => {};
const noopRegisterCompactionProvider: ZhushouPluginApi["registerCompactionProvider"] = () => {};
const noopRegisterAgentHarness: ZhushouPluginApi["registerAgentHarness"] = () => {};
const noopRegisterMemoryCapability: ZhushouPluginApi["registerMemoryCapability"] = () => {};
const noopRegisterMemoryPromptSection: ZhushouPluginApi["registerMemoryPromptSection"] = () => {};
const noopRegisterMemoryPromptSupplement: ZhushouPluginApi["registerMemoryPromptSupplement"] =
  () => {};
const noopRegisterMemoryCorpusSupplement: ZhushouPluginApi["registerMemoryCorpusSupplement"] =
  () => {};
const noopRegisterMemoryFlushPlan: ZhushouPluginApi["registerMemoryFlushPlan"] = () => {};
const noopRegisterMemoryRuntime: ZhushouPluginApi["registerMemoryRuntime"] = () => {};
const noopRegisterMemoryEmbeddingProvider: ZhushouPluginApi["registerMemoryEmbeddingProvider"] =
  () => {};
const noopOn: ZhushouPluginApi["on"] = () => {};

export function buildPluginApi(params: BuildPluginApiParams): ZhushouPluginApi {
  const handlers = params.handlers ?? {};
  return {
    id: params.id,
    name: params.name,
    version: params.version,
    description: params.description,
    source: params.source,
    rootDir: params.rootDir,
    registrationMode: params.registrationMode,
    config: params.config,
    pluginConfig: params.pluginConfig,
    runtime: params.runtime,
    logger: params.logger,
    registerTool: handlers.registerTool ?? noopRegisterTool,
    registerHook: handlers.registerHook ?? noopRegisterHook,
    registerHttpRoute: handlers.registerHttpRoute ?? noopRegisterHttpRoute,
    registerChannel: handlers.registerChannel ?? noopRegisterChannel,
    registerGatewayMethod: handlers.registerGatewayMethod ?? noopRegisterGatewayMethod,
    registerCli: handlers.registerCli ?? noopRegisterCli,
    registerReload: handlers.registerReload ?? noopRegisterReload,
    registerNodeHostCommand: handlers.registerNodeHostCommand ?? noopRegisterNodeHostCommand,
    registerSecurityAuditCollector:
      handlers.registerSecurityAuditCollector ?? noopRegisterSecurityAuditCollector,
    registerService: handlers.registerService ?? noopRegisterService,
    registerCliBackend: handlers.registerCliBackend ?? noopRegisterCliBackend,
    registerTextTransforms: handlers.registerTextTransforms ?? noopRegisterTextTransforms,
    registerConfigMigration: handlers.registerConfigMigration ?? noopRegisterConfigMigration,
    registerAutoEnableProbe: handlers.registerAutoEnableProbe ?? noopRegisterAutoEnableProbe,
    registerProvider: handlers.registerProvider ?? noopRegisterProvider,
    registerSpeechProvider: handlers.registerSpeechProvider ?? noopRegisterSpeechProvider,
    registerRealtimeTranscriptionProvider:
      handlers.registerRealtimeTranscriptionProvider ?? noopRegisterRealtimeTranscriptionProvider,
    registerRealtimeVoiceProvider:
      handlers.registerRealtimeVoiceProvider ?? noopRegisterRealtimeVoiceProvider,
    registerMediaUnderstandingProvider:
      handlers.registerMediaUnderstandingProvider ?? noopRegisterMediaUnderstandingProvider,
    registerImageGenerationProvider:
      handlers.registerImageGenerationProvider ?? noopRegisterImageGenerationProvider,
    registerVideoGenerationProvider:
      handlers.registerVideoGenerationProvider ?? noopRegisterVideoGenerationProvider,
    registerMusicGenerationProvider:
      handlers.registerMusicGenerationProvider ?? noopRegisterMusicGenerationProvider,
    registerWebFetchProvider: handlers.registerWebFetchProvider ?? noopRegisterWebFetchProvider,
    registerWebSearchProvider: handlers.registerWebSearchProvider ?? noopRegisterWebSearchProvider,
    registerInteractiveHandler:
      handlers.registerInteractiveHandler ?? noopRegisterInteractiveHandler,
    onConversationBindingResolved:
      handlers.onConversationBindingResolved ?? noopOnConversationBindingResolved,
    registerCommand: handlers.registerCommand ?? noopRegisterCommand,
    registerContextEngine: handlers.registerContextEngine ?? noopRegisterContextEngine,
    registerCompactionProvider:
      handlers.registerCompactionProvider ?? noopRegisterCompactionProvider,
    registerAgentHarness: handlers.registerAgentHarness ?? noopRegisterAgentHarness,
    registerMemoryCapability: handlers.registerMemoryCapability ?? noopRegisterMemoryCapability,
    registerMemoryPromptSection:
      handlers.registerMemoryPromptSection ?? noopRegisterMemoryPromptSection,
    registerMemoryPromptSupplement:
      handlers.registerMemoryPromptSupplement ?? noopRegisterMemoryPromptSupplement,
    registerMemoryCorpusSupplement:
      handlers.registerMemoryCorpusSupplement ?? noopRegisterMemoryCorpusSupplement,
    registerMemoryFlushPlan: handlers.registerMemoryFlushPlan ?? noopRegisterMemoryFlushPlan,
    registerMemoryRuntime: handlers.registerMemoryRuntime ?? noopRegisterMemoryRuntime,
    registerMemoryEmbeddingProvider:
      handlers.registerMemoryEmbeddingProvider ?? noopRegisterMemoryEmbeddingProvider,
    resolvePath: params.resolvePath,
    on: handlers.on ?? noopOn,
  };
}
