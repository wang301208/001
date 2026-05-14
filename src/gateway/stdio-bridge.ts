import process from "node:process";
import { createInterface } from "node:readline";
import { randomUUID } from "node:crypto";
import type { ChannelId } from "../channels/plugins/index.js";
import type { ZhushouConfig } from "../config/types.zhushou.js";
import { enableConsoleCapture, routeLogsToStderr } from "../logging/console.js";
import type { createSubsystemLogger } from "../logging/subsystem.js";
import type { RuntimeEnv } from "../runtime.js";
import { VERSION } from "../version.js";
import {
  GATEWAY_CLIENT_CAPS,
  GATEWAY_CLIENT_MODES,
  GATEWAY_CLIENT_NAMES,
} from "./protocol/client-info.js";
import type { ErrorShape, RequestFrame } from "./protocol/index.js";
import type {
  GatewayClient,
  GatewayRequestContext,
  GatewayRequestOptions,
  GatewayRequestHandlers,
} from "./server-methods/types.js";
import type { GatewayServerLiveState } from "./server-live-state.js";
import type { SharedGatewaySessionGenerationState } from "./server-shared-auth-generation.js";

type JsonRpcRequest = {
  id?: unknown;
  jsonrpc?: unknown;
  method?: unknown;
  params?: unknown;
};

type JsonRpcError = {
  code: number;
  message: string;
  details?: unknown;
};

type JsonRpcResponse =
  | {
      id?: unknown;
      jsonrpc: "2.0";
      result: unknown;
    }
  | {
      id?: unknown;
      jsonrpc: "2.0";
      error: JsonRpcError;
    };

type StdioGatewayRuntime = {
  context: GatewayRequestContext;
  extraHandlers: GatewayRequestHandlers;
  methods: string[];
  runtimeStatus: {
    events: string[];
    queueDepth: () => number;
  };
  stop: () => Promise<void>;
};

type InvokeGatewayRequest = (opts: GatewayRequestOptions) => Promise<void>;
type SubsystemLogger = ReturnType<typeof createSubsystemLogger>;

const PROTOCOL_VERSION = 3 as const;
const CLI_DEFAULT_OPERATOR_SCOPES = [
  "operator.admin",
  "operator.read",
  "operator.write",
  "operator.approvals",
  "operator.pairing",
  "operator.talk.secrets",
] satisfies string[];

function debug(message: string): void {
  if (process.env.ZHUSHOU_STDIO_GATEWAY_DEBUG === "1") {
    process.stderr.write(`[stdio-gateway] ${message}\n`);
  }
}

function writeFrame(frame: unknown): void {
  process.stdout.write(`${JSON.stringify(frame)}\n`);
}

function emitEvent(type: string, payload: unknown = {}, seq?: number): void {
  writeFrame({
    jsonrpc: "2.0",
    method: "event",
    params: {
      type,
      payload,
      ...(seq === undefined ? {} : { seq }),
    },
  });
}

function jsonRpcError(message: string, code = -32000, details?: unknown): JsonRpcError {
  return {
    code,
    message,
    ...(details === undefined ? {} : { details }),
  };
}

function mapGatewayError(error: ErrorShape): JsonRpcError {
  return jsonRpcError(error.message, -32000, {
    code: error.code,
    ...(error.details === undefined ? {} : { details: error.details }),
    ...(error.retryable === undefined ? {} : { retryable: error.retryable }),
    ...(error.retryAfterMs === undefined ? {} : { retryAfterMs: error.retryAfterMs }),
  });
}

function createStdioClient(): GatewayClient {
  return {
    connId: "stdio-tui",
    clientIp: "127.0.0.1",
    connect: {
      minProtocol: PROTOCOL_VERSION,
      maxProtocol: PROTOCOL_VERSION,
      client: {
        id: GATEWAY_CLIENT_NAMES.TUI,
        displayName: "zhushou-tui",
        version: VERSION,
        platform: process.platform,
        mode: GATEWAY_CLIENT_MODES.UI,
        instanceId: randomUUID(),
      },
      caps: [GATEWAY_CLIENT_CAPS.TOOL_EVENTS],
      role: "operator",
      scopes: CLI_DEFAULT_OPERATOR_SCOPES,
    },
    internal: {
      allowModelOverride: true,
    },
  };
}

function toRequestFrame(request: JsonRpcRequest, id: string, method: string): RequestFrame {
  return {
    type: "req",
    id,
    method,
    ...(request.params === undefined ? {} : { params: request.params }),
  };
}

export async function handleGatewayStdioRequest(params: {
  request: JsonRpcRequest;
  context: GatewayRequestContext;
  invokeGatewayRequest?: InvokeGatewayRequest;
}): Promise<JsonRpcResponse> {
  const id = typeof params.request.id === "string" ? params.request.id : "";
  if (!id) {
    return {
      jsonrpc: "2.0",
      error: jsonRpcError("request id must be a string", -32600),
    };
  }
  if (params.request.jsonrpc !== "2.0") {
    return {
      id,
      jsonrpc: "2.0",
      error: jsonRpcError("jsonrpc must be 2.0", -32600),
    };
  }
  const method = typeof params.request.method === "string" ? params.request.method.trim() : "";
  if (!method) {
    return {
      id,
      jsonrpc: "2.0",
      error: jsonRpcError("method must be a non-empty string", -32600),
    };
  }

  let settled = false;
  let response: JsonRpcResponse | undefined;
  const respond: GatewayRequestOptions["respond"] = (ok, payload, error, meta) => {
    if (settled) {
      return;
    }
    settled = true;
    if (ok) {
      response = { id, jsonrpc: "2.0", result: meta ? { payload, meta } : payload };
      return;
    }
    response = {
      id,
      jsonrpc: "2.0",
      error: error ? mapGatewayError(error) : jsonRpcError("gateway request failed"),
    };
  };

  try {
    const invokeGatewayRequest =
      params.invokeGatewayRequest ??
      (await import("./server-methods.js")).handleGatewayRequest;
    await invokeGatewayRequest({
      req: toRequestFrame(params.request, id, method),
      client: createStdioClient(),
      isWebchatConnect: () => false,
      respond,
      context: params.context,
    });
  } catch (err) {
    return {
      id,
      jsonrpc: "2.0",
      error: jsonRpcError(err instanceof Error ? err.message : String(err)),
    };
  }

  return response ?? {
    id,
    jsonrpc: "2.0",
    error: jsonRpcError(`gateway method did not respond: ${method}`),
  };
}

function makeChannelLogs(params: {
  listChannelPlugins: typeof import("../channels/plugins/index.js").listChannelPlugins;
  logChannels: SubsystemLogger;
}) {
  return Object.fromEntries(
    params.listChannelPlugins().map((plugin) => [plugin.id, params.logChannels.child(plugin.id)]),
  ) as Record<ChannelId, SubsystemLogger>;
}

function makeChannelRuntimeEnvs(
  channelLogs: Record<ChannelId, SubsystemLogger>,
  runtimeForLogger: (logger: SubsystemLogger) => RuntimeEnv,
) {
  return Object.fromEntries(
    Object.entries(channelLogs).map(([id, logger]) => [id, runtimeForLogger(logger)]),
  ) as unknown as Record<ChannelId, RuntimeEnv>;
}

async function startStdioGatewayRuntime(): Promise<StdioGatewayRuntime> {
  debug("loading runtime modules");
  const [
    { getActiveEmbeddedRunCount },
    { listChannelPlugins },
    { createDefaultDeps },
    { applyConfigOverrides, getRuntimeConfig, loadConfig },
    { clearAgentRunContext },
    { isDiagnosticsEnabled },
    { startDiagnosticHeartbeat, stopDiagnosticHeartbeat },
    { createSubsystemLogger, runtimeForLogger },
    { createPluginRuntime },
    { getTotalQueueSize },
    { getActiveSecretsRuntimeSnapshot },
    { getInspectableTaskRegistrySummary, stopTaskRegistryMaintenance },
    { runSetupWizard },
    { createGatewayAuxHandlers },
    { createChannelManager },
    { buildGatewayCronService },
    { applyGatewayLaneConcurrency },
    { createGatewayServerLiveState },
    { GATEWAY_EVENTS, listGatewayMethods },
    { loadGatewayModelCatalog },
    { createGatewayNodeSessionRuntime },
    { setFallbackGatewayContextResolver },
    { createGatewayRequestContext },
    { activateGatewayScheduledServices, startGatewayRuntimeServices },
    { createChatRunState, createToolEventRecipientRegistry },
    { createGatewayBroadcaster },
    { startGatewayEventSubscriptions },
    { resolveSessionKeyForRun },
    { enforceSharedGatewaySessionGenerationForConfigWrite },
    { createRuntimeSecretsActivator },
    { prepareGatewayPluginBootstrap },
    {
      getHealthCache,
      getHealthVersion,
      incrementPresenceVersion,
      refreshGatewayHealthSnapshot,
    },
    { resolveSharedGatewaySessionGeneration },
  ] = await Promise.all([
    import("../agents/pi-embedded-runner/runs.js"),
    import("../channels/plugins/index.js"),
    import("../cli/deps.js"),
    import("../config/config.js"),
    import("../infra/agent-events.js"),
    import("../infra/diagnostic-events.js"),
    import("../logging/diagnostic.js"),
    import("../logging/subsystem.js"),
    import("../plugins/runtime/index.js"),
    import("../process/command-queue.js"),
    import("../secrets/runtime.js"),
    import("../tasks/task-registry.maintenance.js"),
    import("../wizard/setup.js"),
    import("./server-aux-handlers.js"),
    import("./server-channels.js"),
    import("./server-cron.js"),
    import("./server-lanes.js"),
    import("./server-live-state.js"),
    import("./server-methods-list.js"),
    import("./server-model-catalog.js"),
    import("./server-node-session-runtime.js"),
    import("./server-plugins.js"),
    import("./server-request-context.js"),
    import("./server-runtime-services.js"),
    import("./server-chat.js"),
    import("./server-broadcast.js"),
    import("./server-runtime-subscriptions.js"),
    import("./server-session-key.js"),
    import("./server-shared-auth-generation.js"),
    import("./server-startup-config.js"),
    import("./server-startup-plugins.js"),
    import("./server/health-state.js"),
    import("./server/ws-shared-generation.js"),
  ]);
  let cachedChannelRuntime: ReturnType<typeof createPluginRuntime>["channel"] | null = null;
  const getChannelRuntime = () => {
    cachedChannelRuntime ??= createPluginRuntime().channel;
    return cachedChannelRuntime;
  };
  const log = createSubsystemLogger("stdio-gateway");
  const logHealth = log.child("health");
  const logCron = log.child("cron");
  const logChannels = log.child("channels");
  const logSecrets = log.child("secrets");
  debug("starting in-process node gateway runtime");
  const minimalTestGateway = false;
  debug("runtime modules loaded");

  const emitSecretsStateEvent = (code: string, message: string, _cfg: ZhushouConfig) => {
    emitEvent("system-event", {
      text: `[${code}] ${message}`,
      ts: Date.now(),
    });
  };
  const activateRuntimeSecrets = createRuntimeSecretsActivator({
    logSecrets,
    emitStateEvent: emitSecretsStateEvent,
  });

  debug("loading stdio runtime config");
  const startupRuntimeConfig = loadConfig();
  debug("stdio runtime config loaded");
  const authlessRuntimeConfig = applyConfigOverrides({
    ...startupRuntimeConfig,
    gateway: {
      ...startupRuntimeConfig.gateway,
      auth: { mode: "none" as const },
    },
  });
  debug("activating stdio runtime secrets");
  const cfgAtStart = (
    await activateRuntimeSecrets(authlessRuntimeConfig, {
      reason: "startup",
      activate: true,
    })
  ).config;
  debug("stdio runtime secrets activated");

  if (isDiagnosticsEnabled(cfgAtStart)) {
    debug("starting diagnostic heartbeat");
    startDiagnosticHeartbeat(undefined, { getConfig: getRuntimeConfig });
  }
  debug("applying lane concurrency");
  applyGatewayLaneConcurrency(cfgAtStart);

  debug("preparing plugin bootstrap");
  const pluginBootstrap = await prepareGatewayPluginBootstrap({
    cfgAtStart,
    startupRuntimeConfig,
    minimalTestGateway,
    skipStartupMaintenance: true,
    skipPluginLoad: true,
    skipPluginDiscovery: true,
    log,
  });
  debug("plugin bootstrap prepared");

  const activeMethods = Array.from(
    new Set([
      ...pluginBootstrap.baseGatewayMethods,
      ...listGatewayMethods(),
      ...listChannelPlugins().flatMap((plugin) => plugin.gatewayMethods ?? []),
    ]),
  );
  const deps = createDefaultDeps();
  debug("default deps created");
  const clients = new Set<{
    connId: string;
    connect: GatewayClient["connect"];
    socket: { bufferedAmount: number; send: (frame: string) => void; close: () => void };
  }>();
  const eventSeq = { value: 0 };
  const broadcast = (event: string, payload: unknown, opts?: { dropIfSlow?: boolean }) => {
    void opts;
    emitEvent(event, payload, ++eventSeq.value);
  };
  const broadcastToConnIds = (
    event: string,
    payload: unknown,
    connIds: ReadonlySet<string>,
    opts?: { dropIfSlow?: boolean },
  ) => {
    void opts;
    if (connIds.size > 0) {
      emitEvent(event, payload, ++eventSeq.value);
    }
  };
  const gatewayBroadcaster = createGatewayBroadcaster({ clients: clients as never });
  void gatewayBroadcaster;

  const chatRunState = createChatRunState();
  const agentRunSeq = new Map<string, number>();
  const dedupe = new Map();
  const chatAbortControllers = new Map();
  const toolEventRecipients = createToolEventRecipientRegistry();
  const channelLogs = makeChannelLogs({ listChannelPlugins, logChannels });
  debug("creating channel manager");
  const channelManager = createChannelManager({
    loadConfig,
    channelLogs,
    channelRuntimeEnvs: makeChannelRuntimeEnvs(channelLogs, runtimeForLogger),
    resolveChannelRuntime: getChannelRuntime,
  });
  debug("channel manager created");
  const nodeSessionRuntime = createGatewayNodeSessionRuntime({ broadcast });
  debug("node session runtime created");
  const initialHookClientIpConfig = {
    trustedProxies: cfgAtStart.gateway?.trustedProxies,
    allowRealIpFallback: cfgAtStart.gateway?.allowRealIpFallback === true,
  };

  const runtimeState: GatewayServerLiveState = createGatewayServerLiveState({
    hooksConfig: null,
    hookClientIpConfig: initialHookClientIpConfig,
    cronState: buildGatewayCronService({
      cfg: cfgAtStart,
      deps,
      broadcast,
    }),
    gatewayMethods: activeMethods,
  });
  deps.cron = runtimeState.cronState.cron;
  debug("gateway live state created");

  debug("starting runtime services");
  const runtimeServices = startGatewayRuntimeServices({
    minimalTestGateway,
    cfgAtStart,
    channelManager,
    log,
  });
  debug("runtime services started");
  Object.assign(runtimeState, runtimeServices);
  Object.assign(
    runtimeState,
    startGatewayEventSubscriptions({
      minimalTestGateway,
      broadcast,
      broadcastToConnIds,
      nodeSendToSession: nodeSessionRuntime.nodeSendToSession,
      agentRunSeq,
      chatRunState,
      resolveSessionKeyForRun,
      clearAgentRunContext,
      toolEventRecipients,
      sessionEventSubscribers: nodeSessionRuntime.sessionEventSubscribers,
      sessionMessageSubscribers: nodeSessionRuntime.sessionMessageSubscribers,
      chatAbortControllers,
    }),
  );
  debug("event subscriptions started");

  const sharedGatewaySessionGenerationState: SharedGatewaySessionGenerationState = {
    current: resolveSharedGatewaySessionGeneration({
      mode: "none",
      allowTailscale: false,
    }),
    required: null,
  };
  const resolveSharedGatewaySessionGenerationForConfig = (config: ZhushouConfig) =>
    resolveSharedGatewaySessionGeneration({
      mode: "none",
      allowTailscale: false,
      ...config.gateway?.auth,
    } as never);
  const resolveRuntimeSnapshotGeneration = () => {
    const active = getActiveSecretsRuntimeSnapshot();
    return resolveSharedGatewaySessionGenerationForConfig(active?.config ?? loadConfig());
  };
  const { execApprovalManager, pluginApprovalManager, extraHandlers } = createGatewayAuxHandlers({
    log,
    activateRuntimeSecrets,
    sharedGatewaySessionGenerationState,
    resolveSharedGatewaySessionGenerationForConfig,
    clients,
  });
  void extraHandlers;
  debug("aux handlers created");

  debug("creating request context");
  const gatewayRequestContext = createGatewayRequestContext({
    deps,
    runtimeState,
    execApprovalManager,
    pluginApprovalManager,
    loadGatewayModelCatalog,
    getHealthCache,
    refreshHealthSnapshot: refreshGatewayHealthSnapshot,
    logHealth,
    logGateway: log,
    incrementPresenceVersion,
    getHealthVersion,
    broadcast,
    broadcastToConnIds,
    nodeSendToSession: nodeSessionRuntime.nodeSendToSession,
    nodeSendToAllSubscribed: nodeSessionRuntime.nodeSendToAllSubscribed,
    nodeSubscribe: nodeSessionRuntime.nodeSubscribe,
    nodeUnsubscribe: nodeSessionRuntime.nodeUnsubscribe,
    nodeUnsubscribeAll: nodeSessionRuntime.nodeUnsubscribeAll,
    hasConnectedMobileNode: nodeSessionRuntime.hasMobileNodeConnected,
    clients,
    enforceSharedGatewayAuthGenerationForConfigWrite: (nextConfig) => {
      enforceSharedGatewaySessionGenerationForConfigWrite({
        state: sharedGatewaySessionGenerationState,
        nextConfig,
        resolveRuntimeSnapshotGeneration,
        clients,
      });
    },
    nodeRegistry: nodeSessionRuntime.nodeRegistry,
    agentRunSeq,
    chatAbortControllers,
    chatAbortedRuns: chatRunState.abortedRuns,
    chatRunBuffers: chatRunState.buffers,
    chatDeltaSentAt: chatRunState.deltaSentAt,
    chatDeltaLastBroadcastLen: chatRunState.deltaLastBroadcastLen,
    addChatRun: chatRunState.registry.add,
    removeChatRun: chatRunState.registry.remove,
    subscribeSessionEvents: nodeSessionRuntime.sessionEventSubscribers.subscribe,
    unsubscribeSessionEvents: nodeSessionRuntime.sessionEventSubscribers.unsubscribe,
    subscribeSessionMessageEvents: nodeSessionRuntime.sessionMessageSubscribers.subscribe,
    unsubscribeSessionMessageEvents: nodeSessionRuntime.sessionMessageSubscribers.unsubscribe,
    unsubscribeAllSessionEvents: (connId) => {
      nodeSessionRuntime.sessionEventSubscribers.unsubscribe(connId);
      nodeSessionRuntime.sessionMessageSubscribers.unsubscribeAll(connId);
    },
    getSessionEventSubscriberConnIds: nodeSessionRuntime.sessionEventSubscribers.getAll,
    registerToolEventRecipient: toolEventRecipients.add,
    dedupe,
    wizardSessions: new Map(),
    findRunningWizard: () => null,
    purgeWizardSession: () => {},
    getRuntimeSnapshot: channelManager.getRuntimeSnapshot,
    startChannel: channelManager.startChannel,
    stopChannel: channelManager.stopChannel,
    markChannelLoggedOut: channelManager.markChannelLoggedOut,
    wizardRunner: runSetupWizard,
    broadcastVoiceWakeChanged: nodeSessionRuntime.broadcastVoiceWakeChanged,
    unavailableGatewayMethods: new Set(),
  });
  setFallbackGatewayContextResolver(() => gatewayRequestContext);
  debug("request context created");

  debug("activating scheduled services");
  const activated = activateGatewayScheduledServices({
    minimalTestGateway,
    cfgAtStart,
    cron: runtimeState.cronState.cron,
    getCron: () => runtimeState.cronState.cron,
    logCron,
    log,
  });
  runtimeState.heartbeatRunner = activated.heartbeatRunner;
  debug("scheduled services activated");

  const stop = async () => {
    runtimeState.heartbeatRunner.stop();
    runtimeState.channelHealthMonitor?.stop();
    runtimeState.stopModelPricingRefresh();
    runtimeState.agentUnsub?.();
    runtimeState.heartbeatUnsub?.();
    runtimeState.transcriptUnsub?.();
    runtimeState.lifecycleUnsub?.();
    runtimeState.cronState.cron.stop();
    stopTaskRegistryMaintenance();
    stopDiagnosticHeartbeat();
  };

  return {
    context: gatewayRequestContext,
    extraHandlers,
    methods: activeMethods,
    stop,
    runtimeStatus: {
      events: GATEWAY_EVENTS,
      queueDepth: () =>
        getTotalQueueSize() +
        getActiveEmbeddedRunCount() +
        getInspectableTaskRegistrySummary().active,
    },
  };
}

async function handleRequest(runtime: StdioGatewayRuntime, request: JsonRpcRequest): Promise<void> {
  const response = await handleGatewayStdioRequest({
    request,
    context: runtime.context,
    invokeGatewayRequest: async (opts) =>
      await (await import("./server-methods.js")).handleGatewayRequest({
        ...opts,
        extraHandlers: runtime.extraHandlers,
      }),
  });
  writeFrame(response);
}

export async function runGatewayStdioBridge(): Promise<void> {
  routeLogsToStderr();
  enableConsoleCapture();
  emitEvent("gateway.starting", {
    url: "stdio://node-gateway",
    bridge: "node",
    transport: "stdio",
    phase: "loading-runtime",
  });
  const runtime = await startStdioGatewayRuntime();
  emitEvent("gateway.ready", {
    url: "stdio://node-gateway",
    bridge: "node",
    transport: "stdio",
    methods: runtime.methods,
    events: runtime.runtimeStatus.events,
    automation: {
      cron: true,
      heartbeat: true,
      autonomy: true,
      backendAutomation: true,
      queueDepth: runtime.runtimeStatus.queueDepth(),
    },
  });

  const rl = createInterface({ input: process.stdin });
  const shutdown = async () => {
    rl.close();
    await runtime.stop();
  };
  process.once("SIGINT", () => void shutdown().finally(() => process.exit(130)));
  process.once("SIGTERM", () => void shutdown().finally(() => process.exit(143)));

  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    try {
      const parsed = JSON.parse(trimmed) as JsonRpcRequest;
      void handleRequest(runtime, parsed).catch((err) => {
        writeFrame({
          jsonrpc: "2.0",
          id: typeof parsed.id === "string" ? parsed.id : undefined,
          error: jsonRpcError(err instanceof Error ? err.message : String(err)),
        });
      });
    } catch (err) {
      writeFrame({
        jsonrpc: "2.0",
        error: jsonRpcError(err instanceof Error ? err.message : String(err), -32700),
      });
    }
  }
  await shutdown();
}
