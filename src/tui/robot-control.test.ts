import { describe, expect, it } from "vitest";
import { formatRobotControlHelp, resolveRobotControlInput } from "./robot-control.js";

describe("resolveRobotControlInput", () => {
  it("routes natural-language control intents to TUI commands", () => {
    expect(resolveRobotControlInput("打开设置")).toEqual({
      routedText: "/settings",
      reason: "settings",
    });
    expect(resolveRobotControlInput("使用模型 openai/gpt-5.4")).toEqual({
      routedText: "/model openai/gpt-5.4",
      reason: "model",
    });
    expect(resolveRobotControlInput("停止当前任务")).toEqual({
      routedText: "/abort",
      reason: "abort",
    });
    expect(resolveRobotControlInput("你能做什么")).toEqual({
      routedText: "/capabilities",
      reason: "capabilities",
    });
    expect(resolveRobotControlInput("列出工具")).toEqual({
      routedText: "/tools-effective",
      reason: "tools-effective",
    });
    expect(resolveRobotControlInput("当前可调用工具")).toEqual({
      routedText: "/tools-effective",
      reason: "tools-effective",
    });
    expect(resolveRobotControlInput("查找工具 浏览器")).toEqual({
      routedText: "/tools 浏览器",
      reason: "tools-search",
    });
    expect(resolveRobotControlInput("查找能力 治理")).toEqual({
      routedText: "/capabilities 治理",
      reason: "capabilities-search",
    });
    expect(resolveRobotControlInput("调用工具 web_search 搜索最新 Node.js LTS")).toEqual({
      routedText: "/invoke-tool web_search 搜索最新 Node.js LTS",
      reason: "invoke-tool",
    });
    expect(resolveRobotControlInput("使用能力 governance 检查宪章状态")).toEqual({
      routedText: "/invoke-tool governance 检查宪章状态",
      reason: "invoke-tool",
    });
    expect(resolveRobotControlInput('调用网关方法 business.tasks.list {"status":"running"}')).toEqual({
      routedText: '/gateway-call business.tasks.list {"status":"running"}',
      reason: "gateway-call",
    });
    expect(resolveRobotControlInput("调用接口 status")).toEqual({
      routedText: "/gateway-call status",
      reason: "gateway-call",
    });
  });

  it("leaves ordinary goals for the backend agent toolchain", () => {
    expect(resolveRobotControlInput("帮我检查这个仓库的测试并修复失败项")).toBeNull();
  });

  it("does not rewrite explicit slash or shell commands", () => {
    expect(resolveRobotControlInput("/status")).toBeNull();
    expect(resolveRobotControlInput("!pnpm test")).toBeNull();
  });

  it("routes readable Chinese gateway method discovery intents", () => {
    expect(resolveRobotControlInput("列出网关方法")).toEqual({
      routedText: "/methods",
      reason: "gateway-methods",
    });
    expect(resolveRobotControlInput("查找接口 business")).toEqual({
      routedText: "/methods business",
      reason: "gateway-methods-search",
    });
    expect(resolveRobotControlInput("查看接口 business.tasks.list")).toEqual({
      routedText: "/method business.tasks.list",
      reason: "gateway-method-describe",
    });
    expect(resolveRobotControlInput("生成调用模板 business.tasks.list")).toEqual({
      routedText: "/method business.tasks.list",
      reason: "gateway-method-describe",
    });
  });

  it("routes common readable Chinese business intents to concrete gateway calls", () => {
    expect(resolveRobotControlInput("列出运行中任务")).toEqual({
      routedText: "/tasks running",
      reason: "business-tasks-running",
    });
    expect(resolveRobotControlInput("查看治理状态")).toEqual({
      routedText: "/gateway-call governance.overview",
      reason: "governance-overview",
    });
    expect(resolveRobotControlInput("查看自治状态")).toEqual({
      routedText: "/gateway-call autonomy.overview",
      reason: "autonomy-overview",
    });
  });

  it("routes backend feature intents to direct TUI commands", () => {
    expect(resolveRobotControlInput("list tasks")).toEqual({
      routedText: "/tasks",
      reason: "business-tasks",
    });
    expect(resolveRobotControlInput("show logs")).toEqual({
      routedText: "/logs",
      reason: "logs",
    });
    expect(resolveRobotControlInput("show config")).toEqual({
      routedText: "/config",
      reason: "config",
    });
    expect(resolveRobotControlInput("list mcp tools")).toEqual({
      routedText: "/mcp-tools",
      reason: "mcp-tools",
    });
    expect(resolveRobotControlInput("search skills deploy")).toEqual({
      routedText: "/skill-search deploy",
      reason: "skill-search",
    });
    expect(resolveRobotControlInput("show agent files")).toEqual({
      routedText: "/agent-files",
      reason: "agent-files",
    });
  });

  it("routes experience, past conversation, skill candidate, and self-model intents", () => {
    expect(resolveRobotControlInput("record experience remote model lesson")).toEqual({
      routedText: "/experience-capture remote model lesson",
      reason: "experience-capture",
    });
    expect(resolveRobotControlInput("search past conversations deploy failure")).toEqual({
      routedText: "/experience-search deploy failure",
      reason: "experience-search",
    });
    expect(resolveRobotControlInput("experience summary")).toEqual({
      routedText: "/experience-summary",
      reason: "experience-summary",
    });
    expect(resolveRobotControlInput("show skill candidates")).toEqual({
      routedText: "/skill-candidates",
      reason: "skill-candidates",
    });
    expect(resolveRobotControlInput("show self model")).toEqual({
      routedText: "/self-model",
      reason: "self-model",
    });
    expect(resolveRobotControlInput("update self model prefer terminal memory")).toEqual({
      routedText: "/self-model-update prefer terminal memory",
      reason: "self-model-update",
    });
  });
});

describe("formatRobotControlHelp", () => {
  it("explains that text and voice use the same capability path", () => {
    const output = formatRobotControlHelp();
    expect(output).toContain("机器人控制台");
    expect(output).toContain("直接输入或说出目标即可调用能力");
    expect(output).toContain("其他复杂目标无需命令格式");
  });
});
