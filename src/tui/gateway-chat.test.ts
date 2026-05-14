import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  loadConfigMock as loadConfig,
  resolveConfigPathMock as resolveConfigPath,
  resolveGatewayPortMock as resolveGatewayPort,
  resolveStateDirMock as resolveStateDir,
} from "../gateway/gateway-connection.test-mocks.js";
import { captureEnv, withEnvAsync } from "../test-utils/env.js";

vi.mock("../config/config.js", async () => {
  const mocks = await import("../gateway/gateway-connection.test-mocks.js");
  return {
    loadConfig: mocks.loadConfigMock,
    resolveConfigPath: mocks.resolveConfigPathMock,
    resolveGatewayPort: mocks.resolveGatewayPortMock,
    resolveStateDir: mocks.resolveStateDirMock,
  };
});

vi.mock("../gateway/net.js", async () => {
  const mocks = await import("../gateway/gateway-connection.test-mocks.js");
  return {
    isLoopbackHost: mocks.isLoopbackHostMock,
    isSecureWebSocketUrl: mocks.isSecureWebSocketUrlMock,
    pickPrimaryLanIPv4: mocks.pickPrimaryLanIPv4Mock,
  };
});

vi.mock("./stdio-gateway-transport.js", () => {
  class StdioGatewayTransport {
    opts: unknown;
    onEvent?: unknown;
    onConnected?: unknown;
    onDisconnected?: unknown;
    onGap?: unknown;

    constructor(opts?: unknown) {
      this.opts = opts;
    }

    start() {}
    stop() {}
    request = vi.fn();
  }

  return { StdioGatewayTransport };
});

const { GatewayChatClient, resolveGatewayConnection } = await import("./gateway-chat.js");

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

type ModeExecProviderFixture = {
  tokenMarker: string;
  passwordMarker: string;
  providers: {
    tokenProvider: {
      source: "exec";
      command: string;
      args: string[];
      allowInsecurePath: true;
    };
    passwordProvider: {
      source: "exec";
      command: string;
      args: string[];
      allowInsecurePath: true;
    };
  };
};

async function withModeExecProviderFixture(
  label: string,
  run: (fixture: ModeExecProviderFixture) => Promise<void>,
) {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), `zhushou-tui-mode-${label}-`));
  const tokenMarker = path.join(tempDir, "token-provider-ran");
  const passwordMarker = path.join(tempDir, "password-provider-ran");
  const tokenExecProgram = [
    "const fs=require('node:fs');",
    `fs.writeFileSync(${JSON.stringify(tokenMarker)},'1');`,
    "process.stdout.write(JSON.stringify({ protocolVersion: 1, values: { TOKEN_SECRET: 'token-from-exec' } }));", // pragma: allowlist secret
  ].join("");
  const passwordExecProgram = [
    "const fs=require('node:fs');",
    `fs.writeFileSync(${JSON.stringify(passwordMarker)},'1');`,
    "process.stdout.write(JSON.stringify({ protocolVersion: 1, values: { PASSWORD_SECRET: 'password-from-exec' } }));", // pragma: allowlist secret
  ].join("");

  try {
    await run({
      tokenMarker,
      passwordMarker,
      providers: {
        tokenProvider: {
          source: "exec",
          command: process.execPath,
          args: ["-e", tokenExecProgram],
          allowInsecurePath: true,
        },
        passwordProvider: {
          source: "exec",
          command: process.execPath,
          args: ["-e", passwordExecProgram],
          allowInsecurePath: true,
        },
      },
    });
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

describe("resolveGatewayConnection", () => {
  let envSnapshot: ReturnType<typeof captureEnv>;

  beforeEach(() => {
    envSnapshot = captureEnv([
      "ZHUSHOU_GATEWAY_URL",
      "ZHUSHOU_GATEWAY_TOKEN",
      "ZHUSHOU_GATEWAY_PASSWORD",
    ]);
    loadConfig.mockReset();
    resolveGatewayPort.mockReset();
    resolveStateDir.mockReset();
    resolveConfigPath.mockReset();
    resolveGatewayPort.mockReturnValue(18789);
    resolveStateDir.mockImplementation(
      (env: NodeJS.ProcessEnv) => env.ZHUSHOU_STATE_DIR ?? "/tmp/zhushou",
    );
    resolveConfigPath.mockImplementation(
      (env: NodeJS.ProcessEnv, stateDir: string) =>
        env.ZHUSHOU_CONFIG_PATH ?? `${stateDir}/zhushou.json`,
    );
    delete process.env.ZHUSHOU_GATEWAY_URL;
    delete process.env.ZHUSHOU_GATEWAY_TOKEN;
    delete process.env.ZHUSHOU_GATEWAY_PASSWORD;
  });

  afterEach(() => {
    envSnapshot.restore();
  });

  it("throws when url override is missing explicit credentials", async () => {
    loadConfig.mockReturnValue({ gateway: { mode: "local" } });

    await expect(resolveGatewayConnection({ url: "wss://override.example/ws" })).rejects.toThrow(
      "explicit credentials",
    );
  });

  it.each([
    {
      label: "token",
      auth: { token: "explicit-token" },
      expected: { token: "explicit-token", password: undefined },
    },
    {
      label: "password",
      auth: { password: "explicit-password" },
      expected: { token: undefined, password: "explicit-password" },
    },
  ])("uses explicit $label when url override is set", async ({ auth, expected }) => {
    loadConfig.mockReturnValue({ gateway: { mode: "local" } });

    const result = await resolveGatewayConnection({
      url: "wss://override.example/ws",
      ...auth,
    });

    expect(result).toEqual({
      url: "wss://override.example/ws",
      ...expected,
      allowInsecureLocalOperatorUi: false,
    });
  });
  it("uses config auth token for local mode when both config and env tokens are set", async () => {
    loadConfig.mockReturnValue({ gateway: { mode: "local", auth: { token: "config-token" } } });

    await withEnvAsync({ ZHUSHOU_GATEWAY_TOKEN: "env-token" }, async () => {
      const result = await resolveGatewayConnection({});
      expect(result.token).toBe("config-token");
    });
  });

  it("falls back to ZHUSHOU_GATEWAY_TOKEN when config token is missing", async () => {
    loadConfig.mockReturnValue({ gateway: { mode: "local" } });

    await withEnvAsync({ ZHUSHOU_GATEWAY_TOKEN: "env-token" }, async () => {
      const result = await resolveGatewayConnection({});
      expect(result.token).toBe("env-token");
    });
  });

  it("uses local password auth when gateway.auth.mode is unset and password-only is configured", async () => {
    loadConfig.mockReturnValue({
      gateway: {
        mode: "local",
        auth: {
          password: "config-password", // pragma: allowlist secret
        },
      },
    });

    const result = await resolveGatewayConnection({});
    expect(result.password).toBe("config-password");
    expect(result.token).toBeUndefined();
  });

  it("fails when both local token and password are configured but gateway.auth.mode is unset", async () => {
    loadConfig.mockReturnValue({
      gateway: {
        mode: "local",
        auth: {
          token: "config-token",
          password: "config-password", // pragma: allowlist secret
        },
      },
    });

    await expect(resolveGatewayConnection({})).rejects.toThrow(
      "gateway.auth.mode is unset. Set gateway.auth.mode to token or password.",
    );
  });

  it("resolves env-template config auth token from referenced env var", async () => {
    loadConfig.mockReturnValue({
      secrets: {
        providers: {
          default: { source: "env" },
        },
      },
      gateway: {
        mode: "local",
        auth: { token: "${CUSTOM_GATEWAY_TOKEN}" },
      },
    });

    await withEnvAsync({ CUSTOM_GATEWAY_TOKEN: "custom-token" }, async () => {
      const result = await resolveGatewayConnection({});
      expect(result.token).toBe("custom-token");
    });
  });

  it("fails with guidance when env-template config auth token is unresolved", async () => {
    loadConfig.mockReturnValue({
      gateway: {
        mode: "local",
        auth: { token: "${MISSING_GATEWAY_TOKEN}" },
      },
    });

    await expect(resolveGatewayConnection({})).rejects.toThrow(
      "gateway.auth.token SecretRef is unresolved",
    );
  });

  it("prefers ZHUSHOU_GATEWAY_PASSWORD over remote password fallback", async () => {
    loadConfig.mockReturnValue({
      gateway: {
        mode: "remote",
        remote: { url: "wss://remote.example/ws", token: "remote-token", password: "remote-pass" }, // pragma: allowlist secret
      },
    });

    const gatewayPasswordEnv = "ZHUSHOU_GATEWAY_PASSWORD"; // pragma: allowlist secret
    const gatewayPassword = "env-pass"; // pragma: allowlist secret
    await withEnvAsync({ [gatewayPasswordEnv]: gatewayPassword }, async () => {
      const result = await resolveGatewayConnection({});
      expect(result.password).toBe(gatewayPassword);
    });
  });

  it.runIf(process.platform !== "win32")(
    "resolves file-backed SecretRef token for local mode",
    async () => {
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "zhushou-tui-file-secret-"));
      const secretFile = path.join(tempDir, "secrets.json");
      await fs.writeFile(secretFile, JSON.stringify({ gatewayToken: "file-secret-token" }), "utf8");
      await fs.chmod(secretFile, 0o600);

      loadConfig.mockReturnValue({
        secrets: {
          providers: {
            fileProvider: {
              source: "file",
              path: secretFile,
              mode: "json",
              allowInsecurePath: true,
            },
          },
        },
        gateway: {
          mode: "local",
          auth: {
            token: { source: "file", provider: "fileProvider", id: "/gatewayToken" },
          },
        },
      });

      try {
        const result = await resolveGatewayConnection({});
        expect(result.token).toBe("file-secret-token");
      } finally {
        await fs.rm(tempDir, { recursive: true, force: true });
      }
    },
  );

  it("resolves exec-backed SecretRef token for local mode", async () => {
    const execProgram = [
      "process.stdout.write(",
      "JSON.stringify({ protocolVersion: 1, values: { EXEC_GATEWAY_TOKEN: 'exec-secret-token' } })",
      ");",
    ].join("");

    loadConfig.mockReturnValue({
      secrets: {
        providers: {
          execProvider: {
            source: "exec",
            command: process.execPath,
            args: ["-e", execProgram],
            allowInsecurePath: true,
          },
        },
      },
      gateway: {
        mode: "local",
        auth: {
          token: { source: "exec", provider: "execProvider", id: "EXEC_GATEWAY_TOKEN" },
        },
      },
    });

    const result = await resolveGatewayConnection({});
    expect(result.token).toBe("exec-secret-token");
  });

  it("resolves only token SecretRef when gateway.auth.mode is token", async () => {
    await withModeExecProviderFixture(
      "token",
      async ({ tokenMarker, passwordMarker, providers }) => {
        loadConfig.mockReturnValue({
          secrets: {
            providers,
          },
          gateway: {
            mode: "local",
            auth: {
              mode: "token",
              token: { source: "exec", provider: "tokenProvider", id: "TOKEN_SECRET" },
              password: { source: "exec", provider: "passwordProvider", id: "PASSWORD_SECRET" },
            },
          },
        });

        const result = await resolveGatewayConnection({});
        expect(result.token).toBe("token-from-exec");
        expect(result.password).toBeUndefined();
        expect(await fileExists(tokenMarker)).toBe(true);
        expect(await fileExists(passwordMarker)).toBe(false);
      },
    );
  });

  it("resolves only password SecretRef when gateway.auth.mode is password", async () => {
    await withModeExecProviderFixture(
      "password",
      async ({ tokenMarker, passwordMarker, providers }) => {
        loadConfig.mockReturnValue({
          secrets: {
            providers,
          },
          gateway: {
            mode: "local",
            auth: {
              mode: "password",
              token: { source: "exec", provider: "tokenProvider", id: "TOKEN_SECRET" },
              password: { source: "exec", provider: "passwordProvider", id: "PASSWORD_SECRET" },
            },
          },
        });

        const result = await resolveGatewayConnection({});
        expect(result.password).toBe("password-from-exec");
        expect(result.token).toBeUndefined();
        expect(await fileExists(tokenMarker)).toBe(false);
        expect(await fileExists(passwordMarker)).toBe(true);
      },
    );
  });

  it("marks loopback local connections for insecure operator ui auth when enabled", async () => {
    loadConfig.mockReturnValue({
      gateway: {
        mode: "local",
        controlUi: {
          allowInsecureAuth: true,
        },
        auth: {
          mode: "token",
          token: "config-token",
        },
      },
    });

    const result = await resolveGatewayConnection({});
    expect(result.allowInsecureLocalOperatorUi).toBe(true);
  });

  it("preserves insecure local operator ui auth when a loopback url override is provided", async () => {
    loadConfig.mockReturnValue({
      gateway: {
        mode: "local",
        controlUi: {
          allowInsecureAuth: true,
        },
        auth: {
          mode: "token",
          token: "config-token",
        },
      },
    });

    const result = await resolveGatewayConnection({
      url: "ws://127.0.0.1:18791",
      token: "override-token",
    });
    expect(result.allowInsecureLocalOperatorUi).toBe(true);
    expect(result.token).toBe("override-token");
  });
});

describe("GatewayChatClient", () => {
  it("uses the embedded stdio gateway by default", async () => {
    const client = await GatewayChatClient.connect({});

    expect(client.connection).toEqual({
      kind: "stdio",
      display: "stdio://local-gateway",
    });
    expect(
      (client as unknown as { transport: { constructor: { name: string } } }).transport.constructor
        .name,
    ).toBe("StdioGatewayTransport");
  });

  it("keeps explicit --url connections on the WebSocket transport", async () => {
    loadConfig.mockReturnValue({ gateway: { mode: "local" } });

    const client = await GatewayChatClient.connect({
      url: "wss://override.example/ws",
      token: "override-token",
    });

    expect(client.connection).toEqual({
      kind: "websocket",
      url: "wss://override.example/ws",
      token: "override-token",
      password: undefined,
      allowInsecureLocalOperatorUi: false,
    });
    expect(
      (client as unknown as { transport: { opts: { url?: string; token?: string } } }).transport
        .opts,
    ).toMatchObject({
      url: "wss://override.example/ws",
      token: "override-token",
    });
  });

  it("identifies the TUI as a tui client and skips device identity on insecure local ui paths", () => {
    const client = new GatewayChatClient({
      kind: "websocket",
      url: "ws://127.0.0.1:18789",
      token: "test-token",
      allowInsecureLocalOperatorUi: true,
    });

    expect(
      (client as unknown as { transport: { opts: { clientName?: string; mode?: string } } })
        .transport.opts.clientName,
    ).toBe("zhushou-tui");
    expect(
      (client as unknown as { transport: { opts: { clientName?: string; mode?: string } } })
        .transport.opts.mode,
    ).toBe("ui");
    expect(
      (client as unknown as { transport: { opts: { deviceIdentity?: unknown } } }).transport.opts
        .deviceIdentity,
    ).toBeUndefined();
  });

  it("wraps backend tool inventory RPC methods for TUI commands", async () => {
    const client = await GatewayChatClient.connect({});
    const transport = (client as unknown as { transport: { request: ReturnType<typeof vi.fn> } })
      .transport;
    transport.request.mockResolvedValueOnce({ groups: [] });
    transport.request.mockResolvedValueOnce({ groups: [] });

    await client.getToolsCatalog({ agentId: "main", includePlugins: true });
    await client.getEffectiveTools({ sessionKey: "agent:main:main", agentId: "main" });

    expect(transport.request).toHaveBeenNthCalledWith(1, "tools.catalog", {
      agentId: "main",
      includePlugins: true,
    });
    expect(transport.request).toHaveBeenNthCalledWith(2, "tools.effective", {
      sessionKey: "agent:main:main",
      agentId: "main",
    });
  });

  it("wraps arbitrary gateway RPC calls for natural language command coverage", async () => {
    const client = await GatewayChatClient.connect({});
    const transport = (client as unknown as { transport: { request: ReturnType<typeof vi.fn> } })
      .transport;
    transport.request.mockResolvedValueOnce({ ok: true });

    await client.callGatewayMethod("business.tasks.list", { status: "running" });

    expect(transport.request).toHaveBeenCalledWith("business.tasks.list", { status: "running" });
  });

  it("wraps sessions.steer for terminal run redirection", async () => {
    const client = await GatewayChatClient.connect({});
    const transport = (client as unknown as { transport: { request: ReturnType<typeof vi.fn> } })
      .transport;
    transport.request.mockResolvedValueOnce({ runId: "run-steer-1", interruptedActiveRun: true });

    await expect(
      client.steerSession({
        sessionKey: "agent:main:main",
        message: "change course",
        thinking: "high",
        timeoutMs: 123,
        runId: "run-steer-1",
      }),
    ).resolves.toEqual({ runId: "run-steer-1", interruptedActiveRun: true });

    expect(transport.request).toHaveBeenCalledWith("sessions.steer", {
      key: "agent:main:main",
      message: "change course",
      thinking: "high",
      timeoutMs: 123,
      idempotencyKey: "run-steer-1",
    });
  });

  it("wraps gateway method discovery for natural language command coverage", async () => {
    const client = await GatewayChatClient.connect({});
    const transport = (client as unknown as { transport: { request: ReturnType<typeof vi.fn> } })
      .transport;
    transport.request.mockResolvedValueOnce({ count: 1, methods: [{ name: "status" }] });

    await client.listGatewayMethods({ query: "status" });

    expect(transport.request).toHaveBeenCalledWith("gateway.methods", { query: "status" });
  });

  it("wraps gateway method contract discovery for natural language command coverage", async () => {
    const client = await GatewayChatClient.connect({});
    const transport = (client as unknown as { transport: { request: ReturnType<typeof vi.fn> } })
      .transport;
    transport.request.mockResolvedValueOnce({ method: { name: "status" } });

    await client.describeGatewayMethod("status");

    expect(transport.request).toHaveBeenCalledWith("gateway.method.describe", { method: "status" });
  });

  it("wraps experience and self-model RPCs for terminal commands", async () => {
    const client = await GatewayChatClient.connect({});
    const transport = (client as unknown as { transport: { request: ReturnType<typeof vi.fn> } })
      .transport;
    transport.request
      .mockResolvedValueOnce({ event: { id: "exp_1" } })
      .mockResolvedValueOnce({ query: "deploy", results: [] })
      .mockResolvedValueOnce({ query: "deploy", backend: "sqlite-fts5", summary: "deploy", hits: [] })
      .mockResolvedValueOnce({ counts: { events: 1 } })
      .mockResolvedValueOnce({ candidates: [] })
      .mockResolvedValueOnce({ candidate: { id: "skill_candidate_1" } })
      .mockResolvedValueOnce({ usage: { id: "usage_1" }, candidate: { id: "skill_candidate_1" } })
      .mockResolvedValueOnce({ name: "deploy-guard", skillPath: "/tmp/SKILL.md" })
      .mockResolvedValueOnce({ memory: { id: "strategy_1" } })
      .mockResolvedValueOnce({ pushes: [] })
      .mockResolvedValueOnce({ memory: { id: "strategy_1" } })
      .mockResolvedValueOnce({ selfModel: { strengths: [] } })
      .mockResolvedValueOnce({ selfModel: { strengths: ["gateway"] } })
      .mockResolvedValueOnce({ userModel: { preferences: ["concise"] } })
      .mockResolvedValueOnce({ answer: "concise", hypotheses: [] });

    await client.captureExperience({ kind: "lesson", summary: "deploy lesson" });
    await client.searchExperience({ query: "deploy" });
    await client.recallSessionMemory({ query: "deploy" });
    await client.getExperienceSummary();
    await client.listSkillCandidates({ status: "proposed" });
    await client.createSkillCandidate({
      title: "Deploy guard",
      trigger: "deploy failed",
      steps: ["inspect logs"],
    });
    await client.recordSkillUsage({
      candidateId: "skill_candidate_1",
      outcome: "worked",
      observations: ["add smoke check"],
    });
    await client.exportSkillCandidate({ candidateId: "skill_candidate_1" });
    await client.captureStrategicMemory({ title: "Skill harvest", objective: "Create skills" });
    await client.listDueStrategicPushes({});
    await client.advanceStrategicMemory({ id: "strategy_1" });
    await client.getSelfModel({});
    await client.updateSelfModel({ strengths: ["gateway"] });
    await client.updateUserModel({ preferences: ["concise"] });
    await client.queryUserModel({ query: "communication" });

    expect(transport.request).toHaveBeenNthCalledWith(1, "experience.capture", {
      kind: "lesson",
      summary: "deploy lesson",
    });
    expect(transport.request).toHaveBeenNthCalledWith(2, "experience.search", {
      query: "deploy",
    });
    expect(transport.request).toHaveBeenNthCalledWith(3, "experience.sessionRecall", {
      query: "deploy",
    });
    expect(transport.request).toHaveBeenNthCalledWith(4, "experience.summary", {});
    expect(transport.request).toHaveBeenNthCalledWith(5, "skill.candidates.list", {
      status: "proposed",
    });
    expect(transport.request).toHaveBeenNthCalledWith(6, "skill.candidates.create", {
      title: "Deploy guard",
      trigger: "deploy failed",
      steps: ["inspect logs"],
    });
    expect(transport.request).toHaveBeenNthCalledWith(7, "skill.usage.record", {
      candidateId: "skill_candidate_1",
      outcome: "worked",
      observations: ["add smoke check"],
    });
    expect(transport.request).toHaveBeenNthCalledWith(8, "skill.candidates.exportAgentSkill", {
      candidateId: "skill_candidate_1",
    });
    expect(transport.request).toHaveBeenNthCalledWith(9, "strategy.memory.capture", {
      title: "Skill harvest",
      objective: "Create skills",
    });
    expect(transport.request).toHaveBeenNthCalledWith(10, "strategy.memory.due", {});
    expect(transport.request).toHaveBeenNthCalledWith(11, "strategy.memory.advance", {
      id: "strategy_1",
    });
    expect(transport.request).toHaveBeenNthCalledWith(12, "self.model.get", {});
    expect(transport.request).toHaveBeenNthCalledWith(13, "self.model.update", {
      strengths: ["gateway"],
    });
    expect(transport.request).toHaveBeenNthCalledWith(14, "user.model.update", {
      preferences: ["concise"],
    });
    expect(transport.request).toHaveBeenNthCalledWith(15, "user.model.dialectic", {
      query: "communication",
    });
  });

  it("wraps backend operations that the terminal exposes as first-class commands", async () => {
    const client = await GatewayChatClient.connect({});
    const transport = (client as unknown as { transport: { request: ReturnType<typeof vi.fn> } })
      .transport;
    transport.request
      .mockResolvedValueOnce({ tasks: [] })
      .mockResolvedValueOnce({ task: { id: "task_1" } })
      .mockResolvedValueOnce({ task: { id: "task_1", status: "completed" } })
      .mockResolvedValueOnce({ ok: true, id: "task_1" })
      .mockResolvedValueOnce({ raw: "{}", config: {}, path: "/tmp/zhushou.json" })
      .mockResolvedValueOnce({ ok: true, changedPaths: ["models"] })
      .mockResolvedValueOnce({ lines: ["log"], cursor: 1, size: 1 })
      .mockResolvedValueOnce({ models: [{ id: "llama3", name: "llama3", provider: "ollama" }] })
      .mockResolvedValueOnce({ ok: true, entries: [] })
      .mockResolvedValueOnce({ results: [] })
      .mockResolvedValueOnce({ files: [] })
      .mockResolvedValueOnce({ file: { name: "MEMORY.md", content: "memory" } })
      .mockResolvedValueOnce({ file: { name: "MEMORY.md", content: "memory" } })
      .mockResolvedValueOnce({ tools: [{ name: "probe__echo" }] })
      .mockResolvedValueOnce({ result: { content: [{ type: "text", text: "ok" }] } });

    await client.listBusinessTasks({ status: "running" });
    await client.createBusinessTask({
      name: "Build API",
      goal: "Connect backend",
      duration: "short",
      priority: "high",
    });
    await client.updateBusinessTask({ id: "task_1", status: "completed" });
    await client.deleteBusinessTask({ id: "task_1" });
    await client.getConfig();
    await client.patchConfig({ raw: "{\"models\":{}}" });
    await client.tailLogs({ limit: 5 });
    await client.listRemoteModels({ api: "ollama", endpoint: "mock://local", provider: "local" });
    await client.getSkillsStatus();
    await client.searchSkills({ query: "deploy" });
    await client.listAgentFiles({ agentId: "main" });
    await client.getAgentFile({ agentId: "main", name: "MEMORY.md" });
    await client.setAgentFile({ agentId: "main", name: "MEMORY.md", content: "memory" });
    await client.listMcpTools({});
    await client.callMcpTool({ name: "probe__echo", arguments: { text: "hi" } });

    expect(transport.request).toHaveBeenNthCalledWith(1, "business.tasks.list", {
      status: "running",
    });
    expect(transport.request).toHaveBeenNthCalledWith(2, "business.tasks.create", {
      name: "Build API",
      goal: "Connect backend",
      duration: "short",
      priority: "high",
    });
    expect(transport.request).toHaveBeenNthCalledWith(3, "business.tasks.update", {
      id: "task_1",
      status: "completed",
    });
    expect(transport.request).toHaveBeenNthCalledWith(4, "business.tasks.delete", {
      id: "task_1",
    });
    expect(transport.request).toHaveBeenNthCalledWith(5, "config.get", {});
    expect(transport.request).toHaveBeenNthCalledWith(6, "config.patch", {
      raw: "{\"models\":{}}",
    });
    expect(transport.request).toHaveBeenNthCalledWith(7, "logs.tail", { limit: 5 });
    expect(transport.request).toHaveBeenNthCalledWith(8, "models.remoteList", {
      api: "ollama",
      endpoint: "mock://local",
      provider: "local",
    });
    expect(transport.request).toHaveBeenNthCalledWith(9, "skills.status", {});
    expect(transport.request).toHaveBeenNthCalledWith(10, "skills.search", {
      query: "deploy",
    });
    expect(transport.request).toHaveBeenNthCalledWith(11, "agents.files.list", {
      agentId: "main",
    });
    expect(transport.request).toHaveBeenNthCalledWith(12, "agents.files.get", {
      agentId: "main",
      name: "MEMORY.md",
    });
    expect(transport.request).toHaveBeenNthCalledWith(13, "agents.files.set", {
      agentId: "main",
      name: "MEMORY.md",
      content: "memory",
    });
    expect(transport.request).toHaveBeenNthCalledWith(14, "mcp.tools.list", {});
    expect(transport.request).toHaveBeenNthCalledWith(15, "mcp.tools.call", {
      name: "probe__echo",
      arguments: { text: "hi" },
    });
  });
});
