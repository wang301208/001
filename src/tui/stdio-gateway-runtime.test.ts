import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createServer, type Server } from "node:http";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

type RpcFrame = {
  id?: string;
  jsonrpc?: string;
  method?: string;
  params?: {
    type?: string;
    payload?: unknown;
  };
  result?: unknown;
  error?: { code?: number; message?: string };
};

function repoRoot() {
  return process.cwd();
}

function pythonCommand() {
  return process.env.ASSISTANT_PYTHON?.trim() || (process.platform === "win32" ? "python" : "python3");
}

class PythonGatewayHarness {
  private proc: ChildProcessWithoutNullStreams | null = null;
  private buffer = "";
  private readonly frames: RpcFrame[] = [];
  private nextId = 0;

  constructor(private readonly stateDir: string) {}

  async start() {
    const root = repoRoot();
    this.proc = spawn(pythonCommand(), ["-m", "tui_gateway.entry"], {
      cwd: root,
      env: {
        ...process.env,
        PYTHONPATH: process.env.PYTHONPATH ? `${root}${path.delimiter}${process.env.PYTHONPATH}` : root,
        PYTHONIOENCODING: "utf-8",
        PYTHONUTF8: "1",
        ASSISTANT_STATE_DIR: this.stateDir,
      },
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });
    this.proc.stdout.setEncoding("utf8");
    this.proc.stdout.on("data", (chunk) => {
      this.buffer += chunk;
      let newline = this.buffer.indexOf("\n");
      while (newline >= 0) {
        const raw = this.buffer.slice(0, newline).trim();
        this.buffer = this.buffer.slice(newline + 1);
        if (raw) {
          this.frames.push(JSON.parse(raw) as RpcFrame);
        }
        newline = this.buffer.indexOf("\n");
      }
    });
    await this.waitFor((frame) => frame.method === "event" && frame.params?.type === "gateway.ready");
  }

  async request(method: string, params: unknown = {}) {
    if (!this.proc) {
      throw new Error("gateway not started");
    }
    const id = `r${++this.nextId}`;
    this.proc.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
    return await this.waitFor((frame) => frame.id === id);
  }

  stop() {
    if (this.proc && !this.proc.killed) {
      this.proc.kill();
    }
    this.proc = null;
  }

  private async waitFor(predicate: (frame: RpcFrame) => boolean): Promise<RpcFrame> {
    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline) {
      const index = this.frames.findIndex(predicate);
      if (index >= 0) {
        return this.frames.splice(index, 1)[0]!;
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error(`timed out waiting for stdio gateway frame; buffered=${this.buffer}`);
  }
}

describe("Python stdio gateway runtime", () => {
  const harnesses: PythonGatewayHarness[] = [];
  const servers: Server[] = [];
  let stateDir = "";

  beforeEach(async () => {
    stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "assistant-stdio-gateway-"));
  });

  afterEach(async () => {
    for (const harness of harnesses.splice(0)) {
      harness.stop();
    }
    for (const server of servers.splice(0)) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    if (stateDir) {
      await fs.rm(stateDir, { recursive: true, force: true });
    }
  });

  async function startHarness() {
    const harness = new PythonGatewayHarness(stateDir);
    harnesses.push(harness);
    await harness.start();
    return harness;
  }

  function messageText(message: unknown): string {
    if (!message || typeof message !== "object") {
      return "";
    }
    const content = (message as { content?: unknown }).content;
    if (typeof content === "string") {
      return content;
    }
    if (!Array.isArray(content)) {
      return "";
    }
    return content
      .map((part) =>
        part && typeof part === "object" && typeof (part as { text?: unknown }).text === "string"
          ? (part as { text: string }).text
          : "",
      )
      .filter(Boolean)
      .join("\n");
  }

  async function startOpenAiCompatibleProbe(responseText: string) {
    const requests: Array<{ url?: string; body: unknown; authorization?: string }> = [];
    const server = createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      req.on("end", () => {
        const raw = Buffer.concat(chunks).toString("utf8");
        requests.push({
          url: req.url,
          authorization: Array.isArray(req.headers.authorization)
            ? req.headers.authorization[0]
            : req.headers.authorization,
          body: raw ? JSON.parse(raw) : null,
        });
        res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
        res.end(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: responseText,
                },
              },
            ],
            usage: { prompt_tokens: 7, completion_tokens: 5, total_tokens: 12 },
          }),
        );
      });
    });
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("failed to start OpenAI-compatible probe");
    }
    return { baseUrl: `http://127.0.0.1:${address.port}/v1`, requests };
  }

  async function writeMcpProbeServer() {
    const scriptPath = path.join(stateDir, "mcp-probe-server.mjs");
    await fs.writeFile(
      scriptPath,
      `
import readline from "node:readline";

const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });

function send(frame) {
  process.stdout.write(JSON.stringify(frame) + "\\n");
}

rl.on("line", (line) => {
  const request = JSON.parse(line);
  if (request.method === "notifications/initialized") {
    return;
  }
  if (request.method === "initialize") {
    send({
      jsonrpc: "2.0",
      id: request.id,
      result: {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "probe", version: "1.0.0" },
      },
    });
    return;
  }
  if (request.method === "tools/list") {
    send({
      jsonrpc: "2.0",
      id: request.id,
      result: {
        tools: [
          {
            name: "echo",
            description: "Echo input text",
            inputSchema: {
              type: "object",
              properties: { text: { type: "string" } },
              required: ["text"],
            },
          },
        ],
      },
    });
    return;
  }
  if (request.method === "tools/call") {
    const text = request.params?.arguments?.text ?? "";
    send({
      jsonrpc: "2.0",
      id: request.id,
      result: {
        content: [{ type: "text", text: "echo:" + text }],
      },
    });
    return;
  }
  send({
    jsonrpc: "2.0",
    id: request.id,
    error: { code: -32601, message: "unknown method: " + request.method },
  });
});
`,
      "utf8",
    );
    return scriptPath;
  }

  function toolCount(catalog: unknown) {
    const groups = (catalog as { groups?: Array<{ tools?: unknown[] }> }).groups ?? [];
    return groups.reduce((count, group) => count + (Array.isArray(group.tools) ? group.tools.length : 0), 0);
  }

  it("exposes terminal backend discovery, tools, skills, cron, and experience RPCs", async () => {
    const harness = await startHarness();

    const methods = await harness.request("gateway.methods", {});
    const catalog = await harness.request("tools.catalog", { includePlugins: false });
    const effective = await harness.request("tools.effective", { sessionKey: "agent:main:main" });
    const skills = await harness.request("skills.status", {});
    const cron = await harness.request("cron.status", {});
    const experience = await harness.request("experience.summary", {});

    expect(methods.error).toBeUndefined();
    expect(catalog.error).toBeUndefined();
    expect(effective.error).toBeUndefined();
    expect(skills.error).toBeUndefined();
    expect(cron.error).toBeUndefined();
    expect(experience.error).toBeUndefined();
    expect((methods.result as { methods?: unknown[] }).methods?.length).toBeGreaterThan(10);
    expect((catalog.result as { groups?: unknown[] }).groups?.length).toBeGreaterThan(0);
    expect((effective.result as { groups?: unknown[] }).groups?.length).toBeGreaterThan(0);
    expect(skills.result).toMatchObject({ ok: true });
    expect(cron.result).toMatchObject({ ok: true });
    expect(experience.result).toHaveProperty("counts");
    expect(toolCount(catalog.result)).toBeGreaterThanOrEqual(40);
  });

  it("discovers and calls configured MCP stdio tools through the Python backend", async () => {
    const harness = await startHarness();
    const serverScript = await writeMcpProbeServer();

    const patched = await harness.request("config.patch", {
      raw: JSON.stringify({
        mcp: {
          servers: {
            probe: {
              command: process.execPath,
              args: [serverScript],
            },
          },
        },
      }),
    });
    const methods = await harness.request("gateway.methods", {});
    const listed = await harness.request("mcp.tools.list", {});
    const called = await harness.request("mcp.tools.call", {
      name: "probe__echo",
      arguments: { text: "hello" },
    });

    expect(patched.error).toBeUndefined();
    expect(methods.error).toBeUndefined();
    expect(listed.error).toBeUndefined();
    expect(called.error).toBeUndefined();
    expect((methods.result as { methods?: Array<{ name?: string }> }).methods?.map((method) => method.name)).toContain("mcp.tools.list");
    expect((methods.result as { methods?: Array<{ name?: string }> }).methods?.map((method) => method.name)).toContain("mcp.tools.call");
    expect((listed.result as { tools?: Array<{ name?: string; server?: string }> }).tools).toEqual([
      expect.objectContaining({ name: "probe__echo", server: "probe" }),
    ]);
    expect(called.result).toMatchObject({
      server: "probe",
      tool: "echo",
      result: { content: [{ type: "text", text: "echo:hello" }] },
    });
  });

  it("preserves UTF-8 chat history through stdin/stdout JSON-RPC", async () => {
    const harness = await startHarness();
    const message = "中文 roundtrip 修复 验证";

    const sent = await harness.request("chat.send", {
      sessionKey: "agent:main:utf8",
      message,
    });
    const history = await harness.request("chat.history", {
      sessionKey: "agent:main:utf8",
    });

    expect(sent.error).toBeUndefined();
    expect(history.error).toBeUndefined();
    const messages = (history.result as { messages?: unknown[] }).messages ?? [];
    expect(messages.map(messageText)).toEqual([message, message]);
  });

  it("calls the configured OpenAI-compatible remote model for chat.send", async () => {
    const harness = await startHarness();
    const probe = await startOpenAiCompatibleProbe("远程回复：已接入 LongCat");
    const userText = "在";

    const patched = await harness.request("config.patch", {
      raw: JSON.stringify({
        models: {
          providers: {
            longat: {
              baseUrl: probe.baseUrl,
              apiKey: "test-key",
              api: "openai-completions",
              models: [{ id: "LongCat-Flash-Lite", contextWindow: 128_000 }],
            },
          },
        },
        agents: {
          defaults: {
            model: { primary: "longat/LongCat-Flash-Lite" },
          },
        },
      }),
    });
    const sent = await harness.request("chat.send", {
      sessionKey: "agent:main:remote",
      message: userText,
    });
    const history = await harness.request("chat.history", {
      sessionKey: "agent:main:remote",
    });

    expect(patched.error).toBeUndefined();
    expect(sent.error).toBeUndefined();
    expect(history.error).toBeUndefined();
    expect(probe.requests).toHaveLength(1);
    expect(probe.requests[0]?.url).toBe("/v1/chat/completions");
    expect(probe.requests[0]?.authorization).toBe("Bearer test-key");
    expect(probe.requests[0]?.body).toMatchObject({
      model: "LongCat-Flash-Lite",
      messages: [{ role: "user", content: userText }],
    });
    const messages = (history.result as { messages?: unknown[] }).messages ?? [];
    expect(messages.map(messageText)).toEqual([userText, "远程回复：已接入 LongCat"]);
  });

  it("floors configured stdio context below 128k and reports the effective budget", async () => {
    const harness = await startHarness();
    const patched = await harness.request("config.patch", {
      raw: JSON.stringify({
        agents: {
          defaults: {
            contextTokens: 60,
            compaction: {
              enabled: true,
              reserveTokens: 20,
              keepRecentTokens: 20,
            },
          },
        },
      }),
    });
    expect(patched.error).toBeUndefined();

    const longMessage = "自动压缩验证 ".repeat(20);
    const sent = await harness.request("chat.send", {
      sessionKey: "agent:main:compact",
      message: longMessage,
    });
    const sessions = await harness.request("sessions.list", { agentId: "main" });

    expect(sent.error).toBeUndefined();
    expect(sessions.error).toBeUndefined();

    const session = (sessions.result as { sessions?: Array<Record<string, unknown>> }).sessions?.find(
      (entry) => entry.key === "agent:main:compact",
    );
    expect(session?.contextTokens).toBe(128_000);
    expect(session?.totalTokens).toBeGreaterThan(0);
    expect(session?.totalTokens).toBeLessThan(128_000);
    expect(session?.totalTokensFresh).toBe(true);
  });

  it("auto-compacts stdio chat history when the effective context budget is exceeded", async () => {
    const harness = await startHarness();
    const patched = await harness.request("config.patch", {
      raw: JSON.stringify({
        agents: {
          defaults: {
            contextTokens: 128_000,
            compaction: {
              enabled: true,
              reserveTokens: 64_000,
              keepRecentTokens: 8_000,
            },
          },
        },
      }),
    });
    expect(patched.error).toBeUndefined();

    const longMessage = "自动压缩验证 ".repeat(18_000);
    const first = await harness.request("chat.send", {
      sessionKey: "agent:main:compact-large",
      message: longMessage,
    });
    const second = await harness.request("chat.send", {
      sessionKey: "agent:main:compact-large",
      message: longMessage,
    });
    const sessions = await harness.request("sessions.list", { agentId: "main" });
    const history = await harness.request("chat.history", {
      sessionKey: "agent:main:compact-large",
    });

    expect(first.error).toBeUndefined();
    expect(second.error).toBeUndefined();
    expect(sessions.error).toBeUndefined();
    expect(history.error).toBeUndefined();

    const session = (sessions.result as { sessions?: Array<Record<string, unknown>> }).sessions?.find(
      (entry) => entry.key === "agent:main:compact-large",
    );
    expect(session?.contextTokens).toBe(128_000);
    expect(session?.compactionCount).toBeGreaterThanOrEqual(1);
    expect(session?.compactionCheckpointCount).toBeGreaterThanOrEqual(1);
    expect(session?.totalTokens).toBeLessThanOrEqual(128_000);
    expect(session?.totalTokensFresh).toBe(true);

    const messages = (history.result as { messages?: unknown[] }).messages ?? [];
    const compactionMessage = messages.find(
      (message) => (message as { role?: string }).role === "compactionSummary",
    ) as { summary?: string } | undefined;
    expect(compactionMessage?.summary).toContain("自动压缩摘要");
  });

  it("exposes runnable core RPCs used by terminal natural-language commands", async () => {
    const harness = await startHarness();

    const createdTask = await harness.request("business.tasks.create", {
      name: "中文任务",
      goal: "验证任务中心",
      duration: "long",
      priority: "high",
    });
    const listedTasks = await harness.request("business.tasks.list", { status: "running" });
    const governance = await harness.request("governance.overview", {});
    const autonomy = await harness.request("autonomy.overview", {});
    const batch = await harness.request("agents.parallel.start", {
      parentSessionKey: "agent:main:main",
      tasks: [
        { agentId: "main", goal: "inspect" },
        { agentId: "main", goal: "patch" },
      ],
    });
    const batchId = (batch.result as { batchId?: string }).batchId ?? "";
    const batchStatus = await harness.request("agents.parallel.status", { batchId });
    const batchList = await harness.request("agents.parallel.list", {});
    const steered = await harness.request("sessions.steer", {
      key: "agent:main:main",
      message: "redirect",
      idempotencyKey: "steer-1",
    });
    const config = await harness.request("config.get", {});
    const patched = await harness.request("config.patch", {
      raw: JSON.stringify({ models: { providers: { local: { models: ["tui-test"] } } } }),
    });
    const logs = await harness.request("logs.tail", { limit: 20 });
    const remoteModels = await harness.request("models.remoteList", {
      endpoint: "mock://local",
      api: "ollama",
      provider: "local",
    });
    const fileSet = await harness.request("agents.files.set", {
      agentId: "main",
      name: "MEMORY.md",
      content: "项目上下文",
    });
    const fileGet = await harness.request("agents.files.get", {
      agentId: "main",
      name: "MEMORY.md",
    });

    for (const frame of [
      createdTask,
      listedTasks,
      governance,
      autonomy,
      batch,
      batchStatus,
      batchList,
      steered,
      config,
      patched,
      logs,
      remoteModels,
      fileSet,
      fileGet,
    ]) {
      expect(frame.error).toBeUndefined();
    }
    expect((createdTask.result as { task?: { name?: string } }).task?.name).toBe("中文任务");
    expect((listedTasks.result as { tasks?: unknown[] }).tasks?.length).toBeGreaterThan(0);
    expect((governance.result as { overview?: unknown }).overview).toBeTruthy();
    expect((autonomy.result as { overview?: { totals?: { totalProfiles?: number } } }).overview?.totals?.totalProfiles).toBeGreaterThan(0);
    expect((batch.result as { counts?: { total?: number } }).counts?.total).toBe(2);
    expect((steered.result as { runId?: string }).runId).toBe("steer-1");
    expect((remoteModels.result as { models?: unknown[] }).models).toEqual([]);
    expect((fileGet.result as { file?: { content?: string } }).file?.content).toBe("项目上下文");
  });
});
