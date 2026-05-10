import type { AssistantAction } from "./assistant-actions.js";

export type AssistantIntent = "chat" | "clarify" | "control" | "rpc" | "task" | "tool";

export type AssistantIntentRoute =
  | {
      kind: "action";
      intent: Extract<AssistantIntent, "control" | "rpc" | "tool">;
      action: AssistantAction;
      reason: string;
      confidence: number;
    }
  | {
      kind: "message";
      intent: Extract<AssistantIntent, "chat" | "clarify" | "task">;
      message: string;
      reason: string;
      confidence: number;
    };

function normalizeInput(input: string): string {
  return input.trim().replace(/[。？！?!]+$/g, "").replace(/\s+/g, " ");
}

function lower(input: string): string {
  return input.toLowerCase();
}

function matchFirst(input: string, patterns: RegExp[]): RegExpMatchArray | null {
  for (const pattern of patterns) {
    const match = input.match(pattern);
    if (match) {
      return match;
    }
  }
  return null;
}

function routeKnownChineseControl(text: string): AssistantIntentRoute | null {
  if (/^(打开|进入|显示|查看)?(系统)?设置$/.test(text)) {
    return {
      kind: "action",
      intent: "control",
      action: { type: "tui.operation", operation: "settings" },
      reason: "settings",
      confidence: 0.98,
    };
  }
  if (/^(查看|显示|获取)?(系统)?状态$/.test(text)) {
    return {
      kind: "action",
      intent: "control",
      action: { type: "tui.operation", operation: "status" },
      reason: "status",
      confidence: 0.98,
    };
  }
  if (/^(列出|查看|显示)?(全部|所有)?任务$/.test(text)) {
    return {
      kind: "action",
      intent: "control",
      action: { type: "tui.operation", operation: "tasks" },
      reason: "business-tasks",
      confidence: 0.98,
    };
  }
  if (/^(列出|查看|显示)(运行中|正在运行)任务$/.test(text)) {
    return {
      kind: "action",
      intent: "control",
      action: { type: "tui.operation", operation: "tasks", args: "running" },
      reason: "business-tasks-running",
      confidence: 0.98,
    };
  }
  if (/^(打开|选择|切换|查看|显示)?模型(列表)?$/.test(text)) {
    return operationRoute("models", undefined, "models");
  }
  const modelMatch = text.match(/^(?:使用|切换到|切换|设置)模型\s+(.+)$/);
  if (modelMatch?.[1]?.trim()) {
    return operationRoute("model", modelMatch[1].trim(), "model");
  }
  if (/^(列出|查看|显示)?(当前)?(可调用)?工具(列表)?$/.test(text)) {
    return operationRoute("tools-effective", undefined, "tools-effective");
  }
  const toolSearchMatch = text.match(/^(?:查找|搜索|检索|寻找)(?:当前)?(?:工具|可调用工具)\s+(.+)$/);
  if (toolSearchMatch?.[1]?.trim()) {
    return operationRoute("tools", toolSearchMatch[1].trim(), "tools-search");
  }
  if (/^(列出|查看|显示)?技能(列表)?$/.test(text)) {
    return operationRoute("skills", undefined, "skills");
  }
  const skillSearchMatch = text.match(/^(?:查找|搜索|检索|寻找)技能\s+(.+)$/);
  if (skillSearchMatch?.[1]?.trim()) {
    return operationRoute("skill-search", skillSearchMatch[1].trim(), "skill-search");
  }
  if (/^(列出|查看|显示)?\s*MCP\s*工具(列表)?$/i.test(text)) {
    return operationRoute("mcp-tools", undefined, "mcp-tools");
  }
  if (/^(查看|显示|打开)?日志$/.test(text)) {
    return operationRoute("logs", undefined, "logs");
  }
  if (/^(查看|显示|读取|打开)?配置$/.test(text)) {
    return operationRoute("config", undefined, "config");
  }
  if (/^(列出|查看|显示|获取)(全部|所有|可用)?(接口|方法|网关方法|网关接口|RPC)(列表)?$/i.test(text)) {
    return operationRoute("gateway-methods", undefined, "gateway-methods");
  }
  const methodDescribeMatch = text.match(/^(?:查看|显示|获取|描述|说明)(?:接口|方法|网关方法|网关接口|RPC)\s+([A-Za-z0-9_.:-]+)$/i);
  if (methodDescribeMatch?.[1]?.trim()) {
    return operationRoute("gateway-method", methodDescribeMatch[1].trim(), "gateway-method-describe");
  }
  if (/^(查看|显示|获取)?(治理|治理状态|治理概览)$/.test(text)) {
    return gatewayActionRoute("governance.overview", undefined, "governance-overview");
  }
  if (/^(查看|显示|获取)?(自治|自治状态|自治概览|自主状态)$/.test(text)) {
    return gatewayActionRoute("autonomy.overview", undefined, "autonomy-overview");
  }
  const experienceSearchMatch = text.match(/^(?:搜索|查找|回忆|检索)(?:过去)?(?:对话|经验|记忆|教训)\s+(.+)$/);
  if (experienceSearchMatch?.[1]?.trim()) {
    return operationRoute("experience-search", experienceSearchMatch[1].trim(), "experience-search");
  }
  const experienceCaptureMatch = text.match(/^(?:记录|捕获|记住|保存)(?:经验|教训|记忆)\s+(.+)$/);
  if (experienceCaptureMatch?.[1]?.trim()) {
    return operationRoute("experience-capture", experienceCaptureMatch[1].trim(), "experience-capture");
  }
  const sessionRecallMatch = text.match(/^(?:回忆|检索|搜索|查找)(?:会话|跨会话|历史会话)\s+(.+)$/);
  if (sessionRecallMatch?.[1]?.trim()) {
    return operationRoute("session-recall", sessionRecallMatch[1].trim(), "session-recall");
  }
  if (/^(经验摘要|记忆摘要|查看经验摘要|显示经验摘要)$/.test(text)) {
    return operationRoute("experience-summary", undefined, "experience-summary");
  }
  if (/^(查看|显示)?自我模型$/.test(text)) {
    return operationRoute("self-model", undefined, "self-model");
  }
  if (/^(打开|选择|切换|查看|显示)?(代理|智能体)(列表)?$/.test(text)) {
    return operationRoute("agents", undefined, "agents");
  }
  const agentMatch = text.match(/^(?:使用|切换到|切换|选择)(?:代理|智能体)\s+(.+)$/);
  if (agentMatch?.[1]?.trim()) {
    return operationRoute("agent", agentMatch[1].trim(), "agent");
  }
  if (/^(打开|选择|切换|查看|显示)?会话(列表)?$/.test(text)) {
    return operationRoute("sessions", undefined, "sessions");
  }
  if (/^(新建|创建|开始)(新)?会话$/.test(text)) {
    return operationRoute("new", undefined, "new-session");
  }
  if (/^(重置|清空)(当前)?会话$/.test(text)) {
    return operationRoute("reset", undefined, "reset-session");
  }
  if (/^(停止|中止|取消)(当前)?(任务|运行|请求|对话)$/.test(text)) {
    return operationRoute("abort", undefined, "abort");
  }
  if (/^(语音|语音输入|开始语音|听我说|开始听)$/.test(text)) {
    return operationRoute("voice", undefined, "voice");
  }
  const steerMatch = text.match(/^(?:重定向|改向|调整|纠正)(?:当前)?(?:运行|任务|请求|对话)?\s+(.+)$/);
  if (steerMatch?.[1]?.trim()) {
    return operationRoute("steer", steerMatch[1].trim(), "steer");
  }
  if (/^(你能做什么|你可以做什么|列出能力|查看能力|能力列表|查看可用功能|列出可用功能)$/.test(text)) {
    return operationRoute("capabilities", undefined, "capabilities");
  }
  if (/^(展开|显示)(工具|工具输出|工具详情)$/.test(text)) {
    return operationRoute("tools", "expanded", "tools-expanded");
  }
  if (/^(收起|折叠|隐藏)(工具|工具输出|工具详情)$/.test(text)) {
    return operationRoute("tools", "collapsed", "tools-collapsed");
  }
  const taskCreateMatch = text.match(/^(?:创建|新建|发布)(?:业务)?任务\s+(.+)$/);
  if (taskCreateMatch?.[1]?.trim()) {
    return operationRoute("task-create", taskCreateMatch[1].trim(), "task-create");
  }
  const taskUpdateMatch = text.match(/^(?:更新|修改)(?:业务)?任务\s+([^\s|]+)\s+(pending|running|completed|failed|cancelled)(?:\s+(\d{1,3}))?(?:\s+(.+))?$/i);
  if (taskUpdateMatch?.[1] && taskUpdateMatch[2]) {
    return operationRoute(
      "task-update",
      `${taskUpdateMatch[1]} | ${taskUpdateMatch[2]}${taskUpdateMatch[3] ? ` | ${taskUpdateMatch[3]}` : ""}${taskUpdateMatch[4] ? ` | ${taskUpdateMatch[4].trim()}` : ""}`,
      "task-update",
    );
  }
  const taskDeleteMatch = text.match(/^(?:删除|移除)(?:业务)?任务\s+([^\s]+)$/);
  if (taskDeleteMatch?.[1]) {
    return operationRoute("task-delete", taskDeleteMatch[1], "task-delete");
  }
  const configPatchMatch = text.match(/^(?:补丁配置|更新配置|修改配置|合并配置)\s+([\s\S]+)$/);
  if (configPatchMatch?.[1]?.trim()) {
    return operationRoute("config-patch", configPatchMatch[1].trim(), "config-patch");
  }
  const remoteModelsMatch = text.match(/^(?:探测|检测|列出|获取)远程模型\s+([\s\S]+)$/);
  if (remoteModelsMatch?.[1]?.trim()) {
    return operationRoute("remote-models", remoteModelsMatch[1].trim(), "remote-models");
  }
  if (/^(列出|查看|显示)?代理文件(列表)?$/.test(text)) {
    return operationRoute("agent-files", undefined, "agent-files");
  }
  const agentFileReadMatch = text.match(/^(?:读取|查看|显示)代理文件\s+(.+)$/);
  if (agentFileReadMatch?.[1]?.trim()) {
    return operationRoute("agent-file", agentFileReadMatch[1].trim(), "agent-file");
  }
  const agentFileSetMatch = text.match(/^(?:写入|保存|设置)代理文件\s+([\s\S]+)$/);
  if (agentFileSetMatch?.[1]?.trim()) {
    return operationRoute("agent-file-set", agentFileSetMatch[1].trim(), "agent-file-set");
  }
  if (/^(列出|查看|显示)?技能候选(列表)?$/.test(text)) {
    return operationRoute("skill-candidates", undefined, "skill-candidates");
  }
  const skillCandidateCreateMatch = text.match(/^(?:创建|新建)技能候选\s+([\s\S]+)$/);
  if (skillCandidateCreateMatch?.[1]?.trim()) {
    return operationRoute("skill-candidate-create", skillCandidateCreateMatch[1].trim(), "skill-candidate-create");
  }
  const skillUsageMatch = text.match(/^(?:记录|保存)技能使用\s+([\s\S]+)$/);
  if (skillUsageMatch?.[1]?.trim()) {
    return operationRoute("skill-usage-record", skillUsageMatch[1].trim(), "skill-usage-record");
  }
  const skillExportMatch = text.match(/^(?:导出|输出)技能\s+([^\s]+)$/);
  if (skillExportMatch?.[1]) {
    return operationRoute("skill-export", skillExportMatch[1], "skill-export");
  }
  const strategyMemoryMatch = text.match(/^(?:记录|保存)策略记忆\s+([\s\S]+)$/);
  if (strategyMemoryMatch?.[1]?.trim()) {
    return operationRoute("strategy-memory", strategyMemoryMatch[1].trim(), "strategy-memory");
  }
  if (/^(列出|查看|显示)?到期策略(推进)?$/.test(text)) {
    return operationRoute("strategy-due", undefined, "strategy-due");
  }
  const strategyAdvanceMatch = text.match(/^(?:推进|完成)策略\s+([^\s]+)$/);
  if (strategyAdvanceMatch?.[1]) {
    return operationRoute("strategy-advance", strategyAdvanceMatch[1], "strategy-advance");
  }
  const selfModelUpdateMatch = text.match(/^(?:更新|补充)自我模型\s+(.+)$/);
  if (selfModelUpdateMatch?.[1]?.trim()) {
    return operationRoute("self-model-update", selfModelUpdateMatch[1].trim(), "self-model-update");
  }
  const userModelUpdateMatch = text.match(/^(?:更新|补充)用户模型\s+(.+)$/);
  if (userModelUpdateMatch?.[1]?.trim()) {
    return operationRoute("user-model-update", userModelUpdateMatch[1].trim(), "user-model-update");
  }
  const userModelQueryMatch = text.match(/^(?:查询|查看|分析)用户模型\s+(.+)$/);
  if (userModelQueryMatch?.[1]?.trim()) {
    return operationRoute("user-model", userModelQueryMatch[1].trim(), "user-model");
  }
  const thinkMatch = text.match(/^(?:设置|切换)(?:思考|思考强度)\s+([A-Za-z0-9_-]+)$/);
  if (thinkMatch?.[1]) {
    return operationRoute("think", thinkMatch[1], "think");
  }
  const explicitSwitchMatch = text.match(/^(?:设置|切换)\s*(fast|verbose|trace|reasoning|usage|elevated|activation|权限|用量|详细输出|追踪|推理|快速模式|激活)\s+([A-Za-z0-9_-]+)$/i);
  if (explicitSwitchMatch?.[1] && explicitSwitchMatch[2]) {
    const key = normalizeSwitchName(explicitSwitchMatch[1]);
    return operationRoute(key, explicitSwitchMatch[2], key);
  }
  const toggleMatch = text.match(/^(开启|启用|关闭|禁用)(快速模式|详细输出|追踪|推理)$/);
  if (toggleMatch?.[1] && toggleMatch[2]) {
    const key = normalizeSwitchName(toggleMatch[2]);
    const value = toggleMatch[1] === "开启" || toggleMatch[1] === "启用" ? "on" : "off";
    return operationRoute(key, value, key);
  }
  const openSwitchMatch = text.match(/^(打开)(推理|快速模式|详细输出|追踪)$/);
  if (openSwitchMatch?.[2]) {
    const key = normalizeSwitchName(openSwitchMatch[2]);
    return operationRoute(key, "on", key);
  }
  const closeSwitchMatch = text.match(/^(关闭)(推理|快速模式|详细输出|追踪)$/);
  if (closeSwitchMatch?.[2]) {
    const key = normalizeSwitchName(closeSwitchMatch[2]);
    return operationRoute(key, "off", key);
  }
  if (/^(查看|显示|列出)?定时任务$/.test(text)) {
    return gatewayActionRoute("cron.list", {}, "cron-list", "{}");
  }
  if (/^(查看|显示|列出)?定时任务运行记录$/.test(text)) {
    return gatewayActionRoute("cron.runs", {}, "cron-runs", "{}");
  }
  const cronRunMatch = text.match(/^(?:运行|执行)定时任务\s+([^\s]+)$/);
  if (cronRunMatch?.[1]) {
    return gatewayActionRoute("cron.run", { id: cronRunMatch[1] }, "cron-run", `{"id":"${escapeJsonString(cronRunMatch[1])}"}`);
  }
  const cronRemoveMatch = text.match(/^(?:删除|移除)定时任务\s+([^\s]+)$/);
  if (cronRemoveMatch?.[1]) {
    return gatewayActionRoute("cron.remove", { id: cronRemoveMatch[1] }, "cron-remove", `{"id":"${escapeJsonString(cronRemoveMatch[1])}"}`);
  }
  const parallelStartMatch = text.match(/^并行代理\s+(.+)$/);
  if (parallelStartMatch?.[1]?.trim()) {
    return operationRoute("agents-parallel", parallelStartMatch[1].trim(), "agents-parallel");
  }
  const parallelStatusMatch = text.match(/^(?:显示|查看|获取)并行代理状态\s+([^\s]+)$/);
  if (parallelStatusMatch?.[1]) {
    return operationRoute("agents-parallel-status", parallelStatusMatch[1], "agents-parallel-status");
  }
  if (/^(列出|查看|显示)?并行代理(批次|列表)?$/.test(text)) {
    return operationRoute("agents-parallel-list", undefined, "agents-parallel-list");
  }
  const parallelCancelMatch = text.match(/^(?:取消|停止)并行代理\s+([^\s]+)$/);
  if (parallelCancelMatch?.[1]) {
    return operationRoute("agents-parallel-cancel", parallelCancelMatch[1], "agents-parallel-cancel");
  }
  return null;
}

function normalizeSwitchName(input: string): string {
  const normalized = input.toLowerCase();
  const map: Record<string, string> = {
    fast: "fast",
    verbose: "verbose",
    trace: "trace",
    reasoning: "reasoning",
    usage: "usage",
    elevated: "elevated",
    activation: "activation",
    权限: "elevated",
    用量: "usage",
    详细输出: "verbose",
    追踪: "trace",
    推理: "reasoning",
    快速模式: "fast",
    激活: "activation",
  };
  return map[normalized] ?? normalized;
}

function escapeJsonString(input: string): string {
  return input.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function actionRoute(
  action: AssistantAction,
  reason: string,
  intent: Extract<AssistantIntent, "control" | "rpc" | "tool"> = "control",
): AssistantIntentRoute {
  return {
    kind: "action",
    intent,
    action,
    reason,
    confidence: 0.98,
  };
}

function operationRoute(
  operation: string,
  args: string | undefined,
  reason: string,
): AssistantIntentRoute {
  return actionRoute(
    {
      type: "tui.operation",
      operation: operation.replace(/^\//, "").trim(),
      ...(args ? { args } : {}),
    },
    reason,
  );
}

function parseJsonParams(raw: string): { parsed?: unknown; raw?: string } {
  const trimmed = raw.trim();
  if (!trimmed) {
    return {};
  }
  try {
    return { parsed: JSON.parse(trimmed) as unknown, raw: trimmed };
  } catch {
    return { raw: trimmed };
  }
}

function gatewayArgRoute(arg: string, reason: string): AssistantIntentRoute | null {
  const [method = "", ...rest] = arg.trim().split(/\s+/);
  if (!method) {
    return null;
  }
  const params = parseJsonParams(rest.join(" "));
  return gatewayActionRoute(method, params.parsed, reason, params.raw);
}

function gatewayActionRoute(
  method: string,
  params: unknown,
  reason: string,
  rawParams?: string,
): AssistantIntentRoute {
  return actionRoute(
    {
      type: "gateway.call",
      method,
      ...(params !== undefined ? { params } : {}),
      ...(rawParams !== undefined ? { rawParams } : {}),
    },
    reason,
    "rpc",
  );
}

function mcpActionRoute(name: string, rawArguments: string | undefined, reason: string): AssistantIntentRoute {
  const params = parseJsonParams(rawArguments ?? "");
  const args = params.parsed && typeof params.parsed === "object" && !Array.isArray(params.parsed)
    ? (params.parsed as Record<string, unknown>)
    : {};
  return actionRoute(
    { type: "mcp.call", name, arguments: args, ...(params.raw ? { rawArguments: params.raw } : {}) },
    reason,
    "tool",
  );
}

function routeGatewayCall(text: string): AssistantIntentRoute | null {
  const match = matchFirst(text, [
    /^(?:调用|执行|请求)(?:网关方法|网关接口|接口|方法|rpc|RPC)\s+([A-Za-z0-9_.:-]+(?:\s+.+)?)$/,
    /^(?:call|run|request)\s+(?:gateway\s+)?(?:method|rpc|api)\s+([A-Za-z0-9_.:-]+(?:\s+.+)?)$/i,
  ]);
  const arg = match?.[1]?.trim();
  if (!arg) {
    return null;
  }
  const route = gatewayArgRoute(arg, "gateway-call");
  return route ? { ...route, confidence: 0.95 } : null;
}

function routeToolInvocation(text: string): AssistantIntentRoute | null {
  const match = matchFirst(text, [
    /^(?:调用|使用|用)\s*([A-Za-z0-9_.:-]+)\s*(?:工具|能力)\s*(.+)$/,
    /^(?:调用|使用|用)\s*([A-Za-z0-9_.:-]+)\s+(.+)$/,
    /^(?:调用|使用)(?:工具|能力)\s+([A-Za-z0-9_.:-]+)\s+(.+)$/,
    /^(?:invoke|use)\s+(?:tool|capability)\s+([A-Za-z0-9_.:-]+)\s+(.+)$/i,
  ]);
  const toolName = match?.[1]?.trim();
  const goal = match?.[2]?.trim();
  if (!toolName || !goal) {
    return null;
  }
  return {
    kind: "action",
    intent: "tool",
    action: { type: "tool.invoke", toolName, goal },
    reason: "tool-invocation",
    confidence: 0.92,
  };
}

function routeMcpToolInvocation(text: string): AssistantIntentRoute | null {
  const match = text.match(/^(?:调用|执行|使用)MCP(?:工具)?\s+([A-Za-z0-9_.:-]+)(?:\s+([\s\S]+))?$/i);
  const name = match?.[1]?.trim();
  if (!name) {
    return null;
  }
  const args = match?.[2]?.trim();
  return mcpActionRoute(name, args, "mcp-call");
}

function routeLocalShellInvocation(text: string): AssistantIntentRoute | null {
  const match = text.match(/^(?:执行|运行|调用)?(?:本地|终端|shell|Shell|命令行)?命令\s+([\s\S]+)$/);
  const command = match?.[1]?.trim();
  if (!command) {
    return null;
  }
  return actionRoute({ type: "shell.run", command }, "local-shell", "tool");
}

function looksLikeQuestion(text: string): boolean {
  const compact = lower(text);
  return (
    /^(什么|为何|为什么|怎么|如何|是否|能否|可以吗|解释|介绍|说明)/.test(text) ||
    /(?:是什么|有什么区别|怎么理解|如何实现|为什么|吗)$/.test(text) ||
    /^(what|why|how|is|are|can|could|explain|describe)\b/i.test(compact)
  );
}

function looksLikeAmbiguousAction(text: string): boolean {
  return /^(处理一下|弄一下|搞一下|优化一下|修一下|看一下)$/.test(text);
}

function looksLikeTask(text: string): boolean {
  const taskVerbs =
    /(检查|修复|实现|补齐|运行|启动|调试|验证|构建|测试|部署|重构|删除|创建|新增|接入|改造|推进|完成|整理|审查|分析项目|扫描项目|排查)/;
  const projectObjects =
    /(项目|仓库|代码|测试|报错|错误|异常|功能|接口|前端|后端|TUI|终端|模型|配置|网关|流水线|文档|技能|代理|记忆|MCP)/i;
  return taskVerbs.test(text) && (projectObjects.test(text) || /^(请|帮我|开始|继续)/.test(text));
}

export function buildTaskExecutionMessage(goal: string): string {
  return [
    "[意图: 执行任务]",
    `用户目标: ${goal}`,
    "",
    "执行要求:",
    "1. 先判断目标是否需要调用工具、读写文件、运行命令或访问后端能力。",
    "2. 如需操作项目，直接使用可用工具完成，不要只给建议。",
    "3. 执行后给出结果、验证方式和剩余风险。",
  ].join("\n");
}

export function resolveAssistantIntentInput(input: string): AssistantIntentRoute | null {
  const text = normalizeInput(input);
  const originalText = input.trim();
  if (!text || text.startsWith("/") || text.startsWith("!")) {
    return null;
  }

  const mcpToolInvocation = routeMcpToolInvocation(text);
  if (mcpToolInvocation) {
    return mcpToolInvocation;
  }

  const localShellInvocation = routeLocalShellInvocation(text);
  if (localShellInvocation) {
    return localShellInvocation;
  }

  const knownControl = routeKnownChineseControl(text);
  if (knownControl) {
    return knownControl;
  }

  const gatewayCall = routeGatewayCall(text);
  if (gatewayCall) {
    return gatewayCall;
  }

  const toolInvocation = routeToolInvocation(text);
  if (toolInvocation) {
    return toolInvocation;
  }

  if (looksLikeAmbiguousAction(text)) {
    return {
      kind: "message",
      intent: "clarify",
      message: "需要补充要处理的对象和期望结果。请说明目标、范围和成功标准。",
      reason: "ambiguous-action",
      confidence: 0.55,
    };
  }

  if (looksLikeTask(text)) {
    return {
      kind: "message",
      intent: "task",
      message: buildTaskExecutionMessage(text),
      reason: "task-execution",
      confidence: 0.82,
    };
  }

  if (looksLikeQuestion(text)) {
    return {
      kind: "message",
      intent: "chat",
      message: originalText,
      reason: "chat-question",
      confidence: 0.7,
    };
  }

  return null;
}
