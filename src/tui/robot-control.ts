import { normalizeLowercaseStringOrEmpty } from "../shared/string-coerce.js";

export type RobotControlRoute = {
  routedText: string;
  reason: string;
};

function normalizeRobotInput(input: string): string {
  return input
    .trim()
    .replace(/[。.!！?？]+$/g, "")
    .replace(/\s+/g, " ");
}

function matchesAny(input: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(input));
}

function extractTrailingArgument(input: string, patterns: RegExp[]): string {
  for (const pattern of patterns) {
    const match = pattern.exec(input);
    const value = match?.[1]?.trim();
    if (value) {
      return value;
    }
  }
  return "";
}

export function resolveRobotControlInput(input: string): RobotControlRoute | null {
  const text = normalizeRobotInput(input);
  if (!text || text.startsWith("/") || text.startsWith("!")) {
    return null;
  }

  const lower = normalizeLowercaseStringOrEmpty(text);

  const experienceCaptureArg = extractTrailingArgument(text, [
    /^(?:record|capture|remember)\s+(?:experience|lesson|memory)\s+(.+)$/i,
    /^(?:learn|remember)\s+from\s+(?:this\s+)?experience\s+(.+)$/i,
  ]);
  if (experienceCaptureArg) {
    return {
      routedText: `/experience-capture ${experienceCaptureArg}`,
      reason: "experience-capture",
    };
  }

  const experienceSearchArg = extractTrailingArgument(text, [
    /^(?:search|find|recall)\s+(?:past\s+)?(?:conversations?|experience|memory|lessons?)\s+(.+)$/i,
    /^(?:what|show)\s+(?:do\s+we\s+)?(?:remember|know)\s+about\s+(.+)$/i,
  ]);
  if (experienceSearchArg) {
    return {
      routedText: `/experience-search ${experienceSearchArg}`,
      reason: "experience-search",
    };
  }

  if (
    matchesAny(text, [
      /^(?:experience|memory|lesson)\s+summary$/i,
      /^show\s+(?:experience|memory|lesson)\s+summary$/i,
    ])
  ) {
    return { routedText: "/experience-summary", reason: "experience-summary" };
  }

  if (
    matchesAny(text, [
      /^show\s+skill\s+candidates$/i,
      /^list\s+skill\s+candidates$/i,
    ])
  ) {
    return { routedText: "/skill-candidates", reason: "skill-candidates" };
  }

  if (matchesAny(text, [/^show\s+self\s+model$/i, /^self\s+model$/i])) {
    return { routedText: "/self-model", reason: "self-model" };
  }

  const selfModelUpdateArg = extractTrailingArgument(text, [
    /^update\s+self\s+model\s+(.+)$/i,
    /^remember\s+self\s+model\s+(.+)$/i,
  ]);
  if (selfModelUpdateArg) {
    return { routedText: `/self-model-update ${selfModelUpdateArg}`, reason: "self-model-update" };
  }

  const gatewayMethodDescribeArg = extractTrailingArgument(text, [
    /^(?:查看|显示|获取|描述|说明)(?:网关方法|网关接口|接口|方法|rpc|RPC)\s+([A-Za-z0-9_.:-]+)$/i,
    /^(?:生成|创建)(?:调用模板|接口模板|rpc模板|RPC模板)\s+([A-Za-z0-9_.:-]+)$/i,
    /^(?:describe|show)\s+(?:gateway\s+)?(?:method|rpc|api)\s+([A-Za-z0-9_.:-]+)$/i,
  ]);
  if (gatewayMethodDescribeArg) {
    return { routedText: `/method ${gatewayMethodDescribeArg}`, reason: "gateway-method-describe" };
  }

  if (
    matchesAny(text, [
      /^(?:列出|查看|显示)(?:运行中|正在运行)(?:任务|业务任务)$/,
      /^(?:list|show)\s+running\s+(?:business\s+)?tasks$/i,
    ])
  ) {
    return {
      routedText: "/tasks running",
      reason: "business-tasks-running",
    };
  }

  if (
    matchesAny(text, [
      /^(?:列出|查看|显示)(?:全部|所有)?(?:任务|业务任务)$/,
      /^(?:list|show)\s+(?:business\s+)?tasks$/i,
      /^(?:task|tasks)\s+list$/i,
    ])
  ) {
    return { routedText: "/tasks", reason: "business-tasks" };
  }

  if (matchesAny(text, [/^(?:show|tail|open)\s+logs?$/i, /^logs?$/i])) {
    return { routedText: "/logs", reason: "logs" };
  }

  if (matchesAny(text, [/^(?:show|read|open)\s+config$/i, /^config$/i])) {
    return { routedText: "/config", reason: "config" };
  }

  if (
    matchesAny(text, [
      /^(?:list|show)\s+mcp\s+tools$/i,
      /^mcp\s+tools$/i,
    ])
  ) {
    return { routedText: "/mcp-tools", reason: "mcp-tools" };
  }

  const skillSearchArg = extractTrailingArgument(text, [
    /^(?:search|find)\s+skills?\s+(.+)$/i,
  ]);
  if (skillSearchArg) {
    return { routedText: `/skill-search ${skillSearchArg}`, reason: "skill-search" };
  }

  if (
    matchesAny(text, [
      /^(?:show|list)\s+skills?$/i,
      /^skills?$/i,
    ])
  ) {
    return { routedText: "/skills", reason: "skills" };
  }

  if (
    matchesAny(text, [
      /^(?:show|list)\s+agent\s+files$/i,
      /^agent\s+files$/i,
    ])
  ) {
    return { routedText: "/agent-files", reason: "agent-files" };
  }

  if (
    matchesAny(text, [
      /^(?:查看|显示|获取)(?:治理|治理层)(?:状态|概览)?$/,
      /^(?:show|get)\s+governance\s+(?:status|overview)$/i,
    ])
  ) {
    return { routedText: "/gateway-call governance.overview", reason: "governance-overview" };
  }

  if (
    matchesAny(text, [
      /^(?:查看|显示|获取)(?:自治|自主|自主系统)(?:状态|概览)?$/,
      /^(?:show|get)\s+(?:autonomy|autonomous)\s+(?:status|overview)$/i,
    ])
  ) {
    return { routedText: "/gateway-call autonomy.overview", reason: "autonomy-overview" };
  }

  const gatewayMethodsSearchArg = extractTrailingArgument(text, [
    /^(?:查找|搜索|检索|寻找)(?:网关方法|网关接口|接口|rpc|RPC|方法)\s+(.+)$/i,
    /^(?:find|search)\s+(?:gateway\s+)?(?:methods?|rpc|apis?)\s+(.+)$/i,
  ]);
  if (gatewayMethodsSearchArg) {
    return { routedText: `/methods ${gatewayMethodsSearchArg}`, reason: "gateway-methods-search" };
  }

  if (
    matchesAny(text, [
      /^(?:列出|查看|显示|获取)(?:全部|所有|可用)?(?:网关方法|网关接口|接口|方法|rpc|RPC)(?:列表)?$/,
      /^(?:list|show)\s+(?:gateway\s+)?(?:methods?|rpc|apis?)$/i,
    ])
  ) {
    return { routedText: "/methods", reason: "gateway-methods" };
  }

  const readableGatewayCallArg = extractTrailingArgument(text, [
    /^(?:调用|执行|请求)(?:网关方法|网关接口|接口|rpc|RPC)\s+([A-Za-z0-9_.:-]+(?:\s+.+)?)$/i,
  ]);
  if (readableGatewayCallArg) {
    return { routedText: `/gateway-call ${readableGatewayCallArg}`, reason: "gateway-call" };
  }

  const gatewayCallArg = extractTrailingArgument(text, [
    /^(?:调用|执行|请求)(?:网关方法|网关接口|接口|rpc|RPC)\s+([A-Za-z0-9_.:-]+(?:\s+.+)?)$/i,
    /^(?:call|run|request)\s+(?:gateway\s+)?(?:method|rpc|api)\s+([A-Za-z0-9_.:-]+(?:\s+.+)?)$/i,
  ]);
  if (gatewayCallArg) {
    return { routedText: `/gateway-call ${gatewayCallArg}`, reason: "gateway-call" };
  }

  const invokeToolArg = extractTrailingArgument(text, [
    /^(?:调用|使用)(?:工具|能力)\s+([A-Za-z0-9_.:-]+)\s+(.+)$/i,
    /^(?:invoke|use)\s+(?:tool|capability)\s+([A-Za-z0-9_.:-]+)\s+(.+)$/i,
  ]);
  if (invokeToolArg) {
    const match =
      /^(?:调用|使用)(?:工具|能力)\s+([A-Za-z0-9_.:-]+)\s+(.+)$/i.exec(text) ??
      /^(?:invoke|use)\s+(?:tool|capability)\s+([A-Za-z0-9_.:-]+)\s+(.+)$/i.exec(text);
    const toolName = match?.[1]?.trim();
    const goal = match?.[2]?.trim();
    if (toolName && goal) {
      return { routedText: `/invoke-tool ${toolName} ${goal}`, reason: "invoke-tool" };
    }
  }

  const toolsSearchArg = extractTrailingArgument(text, [
    /^(?:查找|搜索|检索|寻找)(?:当前)?(?:工具|可调用工具)\s+(.+)$/i,
    /^(?:find|search)\s+(?:current\s+)?tools?\s+(.+)$/i,
  ]);
  if (toolsSearchArg) {
    return { routedText: `/tools ${toolsSearchArg}`, reason: "tools-search" };
  }

  const capabilitiesSearchArg = extractTrailingArgument(text, [
    /^(?:查找|搜索|检索|寻找)(?:能力|功能)\s+(.+)$/i,
    /^(?:find|search)\s+(?:capabilities|abilities|features)\s+(.+)$/i,
  ]);
  if (capabilitiesSearchArg) {
    return { routedText: `/capabilities ${capabilitiesSearchArg}`, reason: "capabilities-search" };
  }

  if (
    matchesAny(text, [
      /^(你能做什么|你可以做什么|列出能力|查看能力|查看可用功能|列出可用功能|能力列表)$/,
      /^(what can you do|show capabilities|list capabilities|list tools|show tools|tool catalog)$/i,
    ])
  ) {
    return { routedText: "/capabilities", reason: "capabilities" };
  }

  if (
    matchesAny(text, [
      /^(列出工具|查看工具|工具列表|当前可调用工具|当前工具|实际可用工具|本会话可用工具|本会话可调用工具)$/,
      /^(current tools|effective tools|show effective tools|available tools for this session)$/i,
    ])
  ) {
    return { routedText: "/tools-effective", reason: "tools-effective" };
  }

  if (
    matchesAny(text, [
      /^(帮我)?(打开|查看|显示)?(帮助|命令|命令列表|机器人帮助)$/,
      /^(show|open)?\s*(help|commands|robot help)$/i,
    ])
  ) {
    return { routedText: "/help", reason: "help" };
  }

  if (
    matchesAny(text, [
      /^(机器人|控制台|机器人模式|怎么控制|如何控制)$/,
      /^(robot|robot mode|robot control)$/i,
    ])
  ) {
    return { routedText: "/robot", reason: "robot-help" };
  }

  if (
    matchesAny(text, [
      /^(打开|进入|显示|查看)?(系统)?设置$/,
      /^(open|show)?\s*settings$/i,
    ])
  ) {
    return { routedText: "/settings", reason: "settings" };
  }

  if (
    matchesAny(text, [
      /^(打开|显示|查看)?(治理|治理面板|治理状态)$/,
      /^(open|show)?\s*(governance|governance panel)$/i,
    ])
  ) {
    return { routedText: "/governance", reason: "governance" };
  }

  if (
    matchesAny(text, [
      /^(查看|显示|获取)?(网关|gateway)(状态|情况)?$/,
      /^(gateway|gateway status|show gateway status)$/i,
    ])
  ) {
    return { routedText: "/gateway-status", reason: "gateway-status" };
  }

  if (
    matchesAny(text, [
      /^(查看|显示|获取)?(状态|系统状态|当前状态)$/,
      /^(status|show status)$/i,
    ])
  ) {
    return { routedText: "/status", reason: "status" };
  }

  if (
    matchesAny(text, [
      /^(打开|选择|切换|查看|显示)?(模型|模型列表)$/,
      /^(open|show|select)?\s*(models|model list)$/i,
    ])
  ) {
    return { routedText: "/models", reason: "models" };
  }

  const modelArg = extractTrailingArgument(text, [
    /^(?:使用|切换到|切换|设置)(?:模型)\s+(.+)$/i,
    /^(?:use|switch to|set)\s+model\s+(.+)$/i,
  ]);
  if (modelArg) {
    return { routedText: `/model ${modelArg}`, reason: "model" };
  }

  if (
    matchesAny(text, [
      /^(打开|选择|切换|查看|显示)?(代理|代理列表|智能体|智能体列表)$/,
      /^(open|show|select)?\s*(agents|agent list)$/i,
    ])
  ) {
    return { routedText: "/agents", reason: "agents" };
  }

  const agentArg = extractTrailingArgument(text, [
    /^(?:使用|切换到|切换|选择)(?:代理|智能体)\s+(.+)$/i,
    /^(?:use|switch to|select)\s+agent\s+(.+)$/i,
  ]);
  if (agentArg) {
    return { routedText: `/agent ${agentArg}`, reason: "agent" };
  }

  if (
    matchesAny(text, [
      /^(打开|选择|切换|查看|显示)?(会话|会话列表)$/,
      /^(open|show|select)?\s*(sessions|session list)$/i,
    ])
  ) {
    return { routedText: "/sessions", reason: "sessions" };
  }

  const sessionArg = extractTrailingArgument(text, [
    /^(?:切换到|切换|打开|选择)(?:会话)\s+(.+)$/i,
    /^(?:open|switch to|select)\s+session\s+(.+)$/i,
  ]);
  if (sessionArg) {
    return { routedText: `/session ${sessionArg}`, reason: "session" };
  }

  if (
    matchesAny(text, [
      /^(新建|创建|开始)?(新会话|新的会话)$/,
      /^(new|new session|start new session)$/i,
    ])
  ) {
    return { routedText: "/new", reason: "new-session" };
  }

  if (
    matchesAny(text, [
      /^(重置|清空)(当前)?会话$/,
      /^(reset|reset session|clear session)$/i,
    ])
  ) {
    return { routedText: "/reset", reason: "reset-session" };
  }

  if (
    matchesAny(text, [
      /^(停止|中止|取消)(当前)?(任务|运行|请求|对话)$/,
      /^(abort|stop|cancel)( current)? (run|task|request)$/i,
    ])
  ) {
    return { routedText: "/abort", reason: "abort" };
  }

  if (
    matchesAny(text, [
      /^(开启|启用)(快速模式)$/,
      /^(enable|turn on) fast mode$/i,
    ])
  ) {
    return { routedText: "/fast on", reason: "fast-on" };
  }

  if (
    matchesAny(text, [
      /^(关闭|禁用)(快速模式)$/,
      /^(disable|turn off) fast mode$/i,
    ])
  ) {
    return { routedText: "/fast off", reason: "fast-off" };
  }

  if (
    matchesAny(text, [
      /^(开启|启用)(详细|详细模式|verbose)$/,
      /^(enable|turn on) verbose$/i,
    ])
  ) {
    return { routedText: "/verbose on", reason: "verbose-on" };
  }

  if (
    matchesAny(text, [
      /^(关闭|禁用)(详细|详细模式|verbose)$/,
      /^(disable|turn off) verbose$/i,
    ])
  ) {
    return { routedText: "/verbose off", reason: "verbose-off" };
  }

  if (
    matchesAny(text, [
      /^(开启|启用)(追踪|trace)$/,
      /^(enable|turn on) trace$/i,
    ])
  ) {
    return { routedText: "/trace on", reason: "trace-on" };
  }

  if (
    matchesAny(text, [
      /^(关闭|禁用)(追踪|trace)$/,
      /^(disable|turn off) trace$/i,
    ])
  ) {
    return { routedText: "/trace off", reason: "trace-off" };
  }

  if (
    matchesAny(text, [
      /^(开启|启用)(推理|reasoning)$/,
      /^(enable|turn on) reasoning$/i,
    ])
  ) {
    return { routedText: "/reasoning on", reason: "reasoning-on" };
  }

  if (
    matchesAny(text, [
      /^(关闭|禁用)(推理|reasoning)$/,
      /^(disable|turn off) reasoning$/i,
    ])
  ) {
    return { routedText: "/reasoning off", reason: "reasoning-off" };
  }

  if (
    matchesAny(text, [
      /^(展开|显示)(工具|工具详情|工具输出)$/,
      /^(expand|show) tool output$/i,
    ])
  ) {
    return { routedText: "/tools expanded", reason: "tools-expanded" };
  }

  if (
    matchesAny(text, [
      /^(折叠|隐藏)(工具|工具详情|工具输出)$/,
      /^(collapse|hide) tool output$/i,
    ])
  ) {
    return { routedText: "/tools collapsed", reason: "tools-collapsed" };
  }

  if (
    matchesAny(text, [
      /^(语音|语音输入|开始语音|听我说|开始听)$/,
      /^(voice|listen|start listening|voice input)$/i,
    ])
  ) {
    return { routedText: "/voice", reason: "voice" };
  }

  if (
    matchesAny(text, [
      /^(语音状态|语音输入状态)$/,
      /^(voice status|listen status)$/i,
    ])
  ) {
    return { routedText: "/voice status", reason: "voice-status" };
  }

  if (lower === "退出助手" || lower === "关闭助手" || lower === "quit assistant") {
    return { routedText: "/exit", reason: "exit" };
  }

  return null;
}

export function formatRobotControlHelp(): string {
  return [
    "机器人控制台",
    "直接输入或说出目标即可调用能力：普通任务会进入后端代理和工具链；明确的控制意图会转换为本地命令。",
    "",
    "常用文字/语音指令：",
    "打开设置 / 打开治理 / 查看状态 / 网关状态",
    "模型列表 / 使用模型 <provider/model>",
    "代理列表 / 使用代理 <id>",
    "会话列表 / 新会话 / 重置会话",
    "开始语音 / 语音状态",
    "展开工具 / 折叠工具",
    "停止当前任务 / 退出助手",
    "",
    "其他复杂目标无需命令格式，直接描述即可，由助手通过已注册工具执行。",
  ].join("\n");
}
