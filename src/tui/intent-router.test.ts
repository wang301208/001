import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildTaskExecutionMessage,
  resolveAssistantIntentInput,
} from "./intent-router.js";

function expectAction(input: string, action: Record<string, unknown>) {
  expect(resolveAssistantIntentInput(input)).toMatchObject({
    kind: "action",
    action,
  });
}

describe("resolveAssistantIntentInput", () => {
  it("keeps ordinary knowledge questions as chat", () => {
    expect(resolveAssistantIntentInput("什么是自动压缩上下文？")).toEqual({
      kind: "message",
      intent: "chat",
      message: "什么是自动压缩上下文？",
      reason: "chat-question",
      confidence: 0.7,
    });
  });

  it("routes project operation requests to task execution", () => {
    const route = resolveAssistantIntentInput("请检查项目测试并修复失败项");

    expect(route).toMatchObject({
      kind: "message",
      intent: "task",
      reason: "task-execution",
      confidence: 0.82,
    });
    expect(route?.kind === "message" ? route.message : "").toContain("[意图: 执行任务]");
    expect(route?.kind === "message" ? route.message : "").toContain("请检查项目测试并修复失败项");
  });

  it("routes explicit tool and gateway requests to structured actions", () => {
    expect(resolveAssistantIntentInput("用 web_search 工具搜索最新 Node.js LTS")).toEqual({
      kind: "action",
      intent: "tool",
      action: {
        type: "tool.invoke",
        toolName: "web_search",
        goal: "搜索最新 Node.js LTS",
      },
      reason: "tool-invocation",
      confidence: 0.92,
    });

    expect(resolveAssistantIntentInput('调用接口 business.tasks.list {"status":"running"}')).toEqual({
      kind: "action",
      intent: "rpc",
      action: {
        type: "gateway.call",
        method: "business.tasks.list",
        params: { status: "running" },
        rawParams: '{"status":"running"}',
      },
      reason: "gateway-call",
      confidence: 0.95,
    });
  });

  it("routes common Chinese feature requests to structured TUI actions", () => {
    const cases: Array<[string, Record<string, unknown>]> = [
      ["打开设置", { type: "tui.operation", operation: "settings" }],
      ["查看状态", { type: "tui.operation", operation: "status" }],
      ["模型列表", { type: "tui.operation", operation: "models" }],
      ["使用模型 longat/LongCat-Flash-Lite", { type: "tui.operation", operation: "model", args: "longat/LongCat-Flash-Lite" }],
      ["列出工具", { type: "tui.operation", operation: "tools-effective" }],
      ["查找工具 浏览器", { type: "tui.operation", operation: "tools", args: "浏览器" }],
      ["列出技能", { type: "tui.operation", operation: "skills" }],
      ["搜索技能 部署", { type: "tui.operation", operation: "skill-search", args: "部署" }],
      ["列出 MCP 工具", { type: "tui.operation", operation: "mcp-tools" }],
      ["查看日志", { type: "tui.operation", operation: "logs" }],
      ["查看配置", { type: "tui.operation", operation: "config" }],
      ["列出接口", { type: "tui.operation", operation: "gateway-methods" }],
      ["查看接口 business.tasks.list", { type: "tui.operation", operation: "gateway-method", args: "business.tasks.list" }],
      ["代理列表", { type: "tui.operation", operation: "agents" }],
      ["切换代理 coder", { type: "tui.operation", operation: "agent", args: "coder" }],
      ["会话列表", { type: "tui.operation", operation: "sessions" }],
      ["新建会话", { type: "tui.operation", operation: "new" }],
      ["重置会话", { type: "tui.operation", operation: "reset" }],
      ["停止当前任务", { type: "tui.operation", operation: "abort" }],
      ["开始语音", { type: "tui.operation", operation: "voice" }],
    ];

    for (const [input, action] of cases) {
      expectAction(input, action);
    }
  });

  it("routes governance, autonomy, cron, and raw RPC shortcuts to gateway actions", () => {
    expectAction("查看治理状态", { type: "gateway.call", method: "governance.overview" });
    expectAction("查看自治状态", { type: "gateway.call", method: "autonomy.overview" });
    expectAction("查看定时任务", { type: "gateway.call", method: "cron.list", params: {}, rawParams: "{}" });
    expectAction("查看定时任务运行记录", { type: "gateway.call", method: "cron.runs", params: {}, rawParams: "{}" });
    expectAction("运行定时任务 job_1", {
      type: "gateway.call",
      method: "cron.run",
      params: { id: "job_1" },
      rawParams: '{"id":"job_1"}',
    });
    expectAction("删除定时任务 job_1", {
      type: "gateway.call",
      method: "cron.remove",
      params: { id: "job_1" },
      rawParams: '{"id":"job_1"}',
    });
    expectAction("请求RPC config.schema.lookup {\"path\":\"models\"}", {
      type: "gateway.call",
      method: "config.schema.lookup",
      params: { path: "models" },
      rawParams: '{"path":"models"}',
    });
  });

  it("routes business, memory, skill, strategy, and user-model operations as structured actions", () => {
    const cases: Array<[string, Record<string, unknown>]> = [
      ["创建任务 修复模型 | 修复远程模型调用 | long | high", { type: "tui.operation", operation: "task-create", args: "修复模型 | 修复远程模型调用 | long | high" }],
      ["更新任务 task_1 completed 100", { type: "tui.operation", operation: "task-update", args: "task_1 | completed | 100" }],
      ["删除任务 task_1", { type: "tui.operation", operation: "task-delete", args: "task_1" }],
      ["补丁配置 {\"session\":{\"scope\":\"global\"}}", { type: "tui.operation", operation: "config-patch", args: "{\"session\":{\"scope\":\"global\"}}" }],
      ["探测远程模型 openai-completions https://api.example.com/v1 custom sk-test", { type: "tui.operation", operation: "remote-models", args: "openai-completions https://api.example.com/v1 custom sk-test" }],
      ["列出代理文件", { type: "tui.operation", operation: "agent-files" }],
      ["读取代理文件 MEMORY.md", { type: "tui.operation", operation: "agent-file", args: "MEMORY.md" }],
      ["写入代理文件 MEMORY.md | 记住终端优先", { type: "tui.operation", operation: "agent-file-set", args: "MEMORY.md | 记住终端优先" }],
      ["搜索过去对话 部署失败", { type: "tui.operation", operation: "experience-search", args: "部署失败" }],
      ["记录经验 远程模型修复完成", { type: "tui.operation", operation: "experience-capture", args: "远程模型修复完成" }],
      ["回忆会话 部署失败", { type: "tui.operation", operation: "session-recall", args: "部署失败" }],
      ["经验摘要", { type: "tui.operation", operation: "experience-summary" }],
      ["查看自我模型", { type: "tui.operation", operation: "self-model" }],
      ["列出技能候选", { type: "tui.operation", operation: "skill-candidates" }],
      ["创建技能候选 部署修复 | 部署失败 | 检查日志, 修复配置", { type: "tui.operation", operation: "skill-candidate-create", args: "部署修复 | 部署失败 | 检查日志, 修复配置" }],
      ["记录技能使用 skill_1 | 成功 | 增加冒烟测试", { type: "tui.operation", operation: "skill-usage-record", args: "skill_1 | 成功 | 增加冒烟测试" }],
      ["导出技能 skill_1", { type: "tui.operation", operation: "skill-export", args: "skill_1" }],
      ["记录策略记忆 周期复盘 | 每天检查失败任务", { type: "tui.operation", operation: "strategy-memory", args: "周期复盘 | 每天检查失败任务" }],
      ["列出到期策略", { type: "tui.operation", operation: "strategy-due" }],
      ["推进策略 strategy_1", { type: "tui.operation", operation: "strategy-advance", args: "strategy_1" }],
      ["更新用户模型 喜欢直接执行", { type: "tui.operation", operation: "user-model-update", args: "喜欢直接执行" }],
      ["查询用户模型 沟通风格", { type: "tui.operation", operation: "user-model", args: "沟通风格" }],
    ];

    for (const [input, action] of cases) {
      expectAction(input, action);
    }
  });

  it("routes runtime switches, display controls, steering, and parallel agents", () => {
    const cases: Array<[string, Record<string, unknown>]> = [
      ["设置思考 high", { type: "tui.operation", operation: "think", args: "high" }],
      ["开启详细输出", { type: "tui.operation", operation: "verbose", args: "on" }],
      ["关闭追踪", { type: "tui.operation", operation: "trace", args: "off" }],
      ["设置权限 full", { type: "tui.operation", operation: "elevated", args: "full" }],
      ["重定向当前运行 改用最小修复", { type: "tui.operation", operation: "steer", args: "改用最小修复" }],
      ["设置激活 always", { type: "tui.operation", operation: "activation", args: "always" }],
      ["设置用量 full", { type: "tui.operation", operation: "usage", args: "full" }],
      ["打开推理", { type: "tui.operation", operation: "reasoning", args: "on" }],
      ["你能做什么", { type: "tui.operation", operation: "capabilities" }],
      ["展开工具输出", { type: "tui.operation", operation: "tools", args: "expanded" }],
      ["收起工具输出", { type: "tui.operation", operation: "tools", args: "collapsed" }],
      ["并行代理 coder: 修复测试 | qa: 验证构建", { type: "tui.operation", operation: "agents-parallel", args: "coder: 修复测试 | qa: 验证构建" }],
      ["显示并行代理状态 batch_1", { type: "tui.operation", operation: "agents-parallel-status", args: "batch_1" }],
      ["列出并行代理", { type: "tui.operation", operation: "agents-parallel-list" }],
      ["取消并行代理 batch_1", { type: "tui.operation", operation: "agents-parallel-cancel", args: "batch_1" }],
    ];

    for (const [input, action] of cases) {
      expectAction(input, action);
    }
  });

  it("routes MCP, shell, and tool requests to structured actions without exposing command bridges", () => {
    expect(resolveAssistantIntentInput("执行TUI命令 config-patch {\"models\":{}}")).toBeNull();
    expectAction("调用MCP工具 probe__echo {\"text\":\"hello\"}", {
      type: "mcp.call",
      name: "probe__echo",
      arguments: { text: "hello" },
      rawArguments: "{\"text\":\"hello\"}",
    });
    expectAction("执行本地命令 pnpm test", { type: "shell.run", command: "pnpm test" });
    expectAction("调用网关接口 cron.list {}", {
      type: "gateway.call",
      method: "cron.list",
      params: {},
      rawParams: "{}",
    });
  });

  it("audits every Python gateway RPC through the natural-language RPC bridge", () => {
    const gatewaySource = readFileSync("tui_gateway/entry.py", "utf8");
    const methods = [
      ...gatewaySource.matchAll(/"([A-Za-z0-9_.:-]+)"\s*:\s*handle_/g),
    ].map((match) => match[1] ?? "");

    expect(methods.length).toBeGreaterThan(50);
    for (const method of methods) {
      expectAction(`请求RPC ${method} {}`, {
        type: "gateway.call",
        method,
        params: {},
        rawParams: "{}",
      });
    }
  });

  it("asks for clarification before taking vague action", () => {
    expect(resolveAssistantIntentInput("处理一下")).toEqual({
      kind: "message",
      intent: "clarify",
      message: "需要补充要处理的对象和期望结果。请说明目标、范围和成功标准。",
      reason: "ambiguous-action",
      confidence: 0.55,
    });
  });
});

describe("buildTaskExecutionMessage", () => {
  it("wraps task goals in an execution envelope", () => {
    expect(buildTaskExecutionMessage("运行测试并修复错误")).toContain("用户目标: 运行测试并修复错误");
  });
});
