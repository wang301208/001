const UI_TEXT_TRANSLATIONS: Record<string, string> = {
  "n/a": "不适用",
  none: "无",
  all: "全部",
  yes: "是",
  no: "否",
  pass: "通过",
  fail: "失败",
  queued: "排队中",
  running: "运行中",
  waiting: "等待中",
  blocked: "已阻塞",
  manual: "手动",
  startup: "启动",
  supervisor: "监督器",
  silent: "静默",
  subagent: "子代理",
  cron: "定时任务",
  "Use default": "使用默认值",
  "Use profile default": "使用档案默认值",
  "Use the profile default goal": "使用档案默认目标",
  "One path per line or comma-separated": "每行一个路径，或用逗号分隔",
  "One agent per line or comma-separated": "每行一个代理，或用逗号分隔",
  "optional reconcile note": "可选对账备注",
  "proposal not created yet": "提案尚未创建",

  Refresh: "刷新",
  "Refreshing...": "刷新中...",
  "Refresh Governance": "刷新治理",
  "Refresh Registry": "刷新注册表",
  "Refresh Inventory": "刷新清单",
  "Refresh Genesis": "刷新创世纪",
  "Refresh Proposals": "刷新提案",
  "Start Flow": "启动流程",
  "Inspect Flow": "检查流程",
  "Fix Loop": "修复循环",
  Observe: "观察",
  Manage: "管理",
  Browse: "浏览",
  Configure: "配置",
  "Create Proposal": "创建提案",
  "Reset Draft": "重置草稿",
  "Submit Replay Verdict": "提交回放结论",
  "Supervise Fleet": "监督集群",
  "Reconcile Fleet": "对账集群",
  "Heal Fleet": "修复集群",
  "Apply Visible": "应用可见项",
  "Approve Visible": "批准可见项",
  "Revert Visible": "回滚可见项",

  Healthy: "健康",
  Idle: "空闲",
  Drift: "漂移",
  "Missing Loop": "缺失循环",
  "Reconcile Loop": "对账循环",
  Heal: "修复",
  Reconcile: "对账",
  Startup: "启动",
  Supervisor: "监督器",
  Manual: "手动",
  Created: "已创建",
  Existing: "已存在",
  Skipped: "已跳过",
  Pending: "待处理",
  Approved: "已批准",
  Rejected: "已拒绝",
  Applied: "已应用",
  "Force Apply All": "强制全部应用",
  "Apply Safe": "安全应用",
  Ready: "就绪",
  Attention: "需关注",
  Blocked: "已阻塞",
  Critical: "严重",
  Warning: "警告",
  Info: "信息",
  Repair: "修复",
  Build: "构建",
  "Steady State": "稳态",
  Required: "必需",
  Recommended: "推荐",
  "Not Needed": "不需要",
  Active: "活跃",
  Passed: "通过",
  Failed: "失败",
  Planned: "已计划",
  Inactive: "非活跃",
  discovered: "已发现",
  missing: "缺失",
  active: "活跃",
  inactive: "非活跃",
  invalid: "无效",

  Status: "状态",
  Interval: "间隔",
  Updated: "更新时间",
  Tasks: "任务",
  Failures: "失败数",
  "Next Run": "下次运行",
  "Last Run": "上次运行",
  Team: "团队",
  Mode: "模式",
  Stage: "阶段",
  Owner: "负责人",
  Storage: "存储",
  Review: "审查",
  Details: "详情",
  Documents: "文档",
  Hooks: "钩子",
  Actions: "动作",
  Operations: "操作",
  Dependencies: "依赖",
  Workspaces: "工作区",
  Collaborators: "协作者",
  Blockers: "阻塞项",
  Signals: "信号",
  Goal: "目标",
  Title: "标题",
  Rationale: "理由",
  Operator: "操作者",

  "Execution Runtime Projection": "执行运行时投影",
  "Structured executor graph, governed capability request, and genesis handoff state.":
    "结构化执行器图、受治理的能力请求和创世纪交接状态。",
  "Capability Request": "能力请求",
  "Focus Gap IDs": "关注缺口 ID",
  "Request Blockers": "请求阻塞项",
  "Runtime Hooks": "运行时钩子",
  "Observed Capability Gaps": "已观察能力缺口",
  "Task Graph": "任务图",
  "Execution Phases": "执行阶段",
  "Algorithm Research Projection": "算法研究投影",
  "Governed benchmark pressure, research phases, and promotion evidence for decision-engine evolution.":
    "面向决策引擎演进的受治理基准压力、研究阶段和晋升证据。",
  "Target Domains": "目标领域",
  "Observed Algorithm Gaps": "已观察算法缺口",
  "Required Evidence": "必需证据",
  "Promotion Blockers": "晋升阻塞项",
  "Research Phases": "研究阶段",
  "Genesis Runtime Projection": "创世纪运行时投影",
  "Assigned genesis stage, dependency graph, and governed handoff state for this agent.":
    "该代理的创世纪阶段分配、依赖图和受治理交接状态。",
  "Stage Actions": "阶段动作",
  "Stage Dependency Graph": "阶段依赖图",
  "Stage Graph": "阶段图",
  "Sovereignty Watch Projection": "主权监控投影",
  "Governance integrity snapshot, boundary triage plan, and automatic enforcement posture.":
    "治理完整性快照、边界分诊计划和自动执行态势。",
  "Reserved Authorities": "保留权限",
  "Freeze Targets": "冻结目标",
  "Automatic Enforcement": "自动执行",
  "Critical Findings": "严重发现",
  "Watch Phases": "监控阶段",
  "Sandbox Universe": "沙箱宇宙",
  "Promotion-gated experiment envelope, replay pressure, and rollback readiness.":
    "带晋升门禁的实验边界、回放压力和回滚就绪度。",
  "Target Focus Gaps": "目标关注缺口",
  "Promotion Gate Evidence": "晋升门禁证据",
  "Promotion Gate Blockers": "晋升门禁阻塞项",
  "Sandbox Controller": "沙箱控制器",
  "Evidence Ledger": "证据账本",
  "Replay Runner": "回放运行器",
  Scenarios: "场景",
  "Required Outputs": "必需输出",
  "Sandbox Replay Gate": "沙箱回放门禁",
  "Manual verdict channel for replay, QA, and audit promotion pressure on the latest governed flow.":
    "针对最新受治理流程的回放、QA 和审计晋升压力的手动结论通道。",
  "Replay Verdict": "回放结论",
  "QA Verdict": "QA 结论",
  "Audit Verdict": "审计结论",
  "Autonomy Fleet": "自治集群",
  "Global loop convergence and managed flow posture across core autonomous agents.":
    "核心自治代理的全局循环收敛和托管流程态势。",
  "Workspace Scope": "工作区范围",
  "Resolved Scope": "解析范围",
  "Fleet Supervisor": "集群监督器",
  "One-shot autonomy control pass across healing, governance, capability gap review, and genesis routing.":
    "覆盖修复、治理、能力缺口审查和创世纪路由的一次性自治控制通道。",
  "Recommended Next Actions": "推荐下一步动作",
  "Supervisor Gap Focus": "监督器关注缺口",
  "Genesis Mode": "创世纪模式",
  "Genesis Team": "创世纪团队",
  "Genesis Blockers": "创世纪阻塞项",
  "Blocked Stages": "阻塞阶段",
  "Capability Inventory": "能力清单",
  "Deterministic registry view across skills, plugins, blueprints, and capability gaps.":
    "跨技能、插件、蓝图和能力缺口的确定性注册表视图。",
  "Requested Agents": "请求代理",
  "Suggested Actions": "建议动作",
  "Attention Entries": "需关注条目",
  "Genesis Plan": "创世纪计划",
  "Deterministic handoff plan for the governed capability factory.":
    "受治理能力工厂的确定性交接计划。",
  "Governance Proposals": "治理提案",
  "Autonomy-generated charter repair proposals synthesized for eligible governance agents.":
    "为合格治理代理合成的自治生成宪章修复提案。",
  "Reconcile Mode": "对账模式",
  "Reconcile Note": "对账备注",
  "Charter Directory": "宪章目录",
  "Eligible Agents": "合格代理",
  "Finding IDs": "发现 ID",
  "Latest Governance Reconcile": "最新治理对账",
  "Autonomy-triggered proposal execution against the governance ledger.":
    "由自治触发、面向治理账本的提案执行。",
  "Autonomy History": "自治历史",
  "Persistent maintenance events recorded from manual heals, startup recovery, and the supervisor.":
    "记录来自手动修复、启动恢复和监督器的持久维护事件。",
  "History Mode": "历史模式",
  "History Source": "历史来源",
  "Result Limit": "结果限制",
  "Autonomy Profile": "自治档案",
  "Governance contract, mission, and runtime lane.": "治理契约、使命和运行通道。",
  "Reports To": "汇报对象",
  "Start Managed Flow": "启动托管流程",
  "Launch a governed autonomy run for this agent.": "为该代理启动受治理的自治运行。",
  "Controller ID": "控制器 ID",
  "Current Step": "当前步骤",
  "Notify Policy": "通知策略",
  "Flow Status": "流程状态",
  "Seed Runtime": "种子运行时",
  "Seed Status": "种子状态",
  "Seed Label": "种子标签",
  "Seed Summary": "种子摘要",
  "Autonomy Loop": "自治循环",
  "Scheduled control loop that keeps this profile running without manual intervention.":
    "无需人工干预即可保持该档案运行的计划控制循环。",
  "Loop Interval (minutes)": "循环间隔（分钟）",
  "Governed Session Target": "治理会话目标",
  "Loop Directive": "循环指令",
  "Governance Envelope": "治理边界",
  "Mutation boundaries, network rules, and recommended goals.":
    "变更边界、网络规则和推荐目标。",
  "Recommended Goals": "推荐目标",
  "Mutation Allow": "允许变更",
  "Mutation Deny": "禁止变更",
  "Network Conditions": "网络条件",
  "Latest Managed Flow": "最新托管流程",
  "Most recent governed autonomy flow bound to this session lane.":
    "绑定到该会话通道的最新受治理自治流程。",
  "Recent Tasks": "最近任务",

  "Runtime Hook Coverage": "运行时钩子覆盖率",
  "Covered Hooks": "已覆盖钩子",
  "Governance Control Plane": "治理控制平面",
  "Organizational charter health, freeze posture, and machine-readable governance findings.":
    "组织宪章健康度、冻结态势和机器可读治理发现。",
  "Governance Freeze": "治理冻结",
  "Deny Tools": "禁用工具",
  "Active Sovereignty Incidents": "活跃主权事件",
  "Sovereignty Incidents": "主权事件",
  "Open Incident IDs": "未关闭事件 ID",
  "No persisted sovereignty incidents.": "没有持久化主权事件。",
  "Proposal Ledger": "提案账本",
  "Charter Findings": "宪章发现",
  "No governance charter findings.": "没有治理宪章发现。",
  "Loading governance control plane...": "正在加载治理控制平面...",
  "Asset Registry": "资产注册表",
  "Librarian-controlled charter registry health for governed skills, plugins, memory, strategy, and algorithm assets.":
    "由图书管理员控制的宪章注册表健康度，覆盖受治理技能、插件、记忆、策略和算法资产。",
  "Registry File": "注册表文件",
  "Registry Drift": "注册表漂移",
  "Missing Asset IDs": "缺失资产 ID",
  "Stale Asset IDs": "过期资产 ID",
  "Drifted Asset IDs": "漂移资产 ID",
  "Desired Registry Preview": "目标注册表预览",
  "No governed capability assets were derived for registry output.":
    "尚未为注册表输出推导出受治理能力资产。",
  "Loading governance capability asset registry...": "正在加载治理能力资产注册表...",
  "Governance Workbench Scope": "治理工作台范围",
  "Define the fleet slice used for capability inventory and genesis planning.":
    "定义用于能力清单和创世纪规划的集群切片。",
  "Agent Scope": "代理范围",
  "Genesis Team ID": "创世纪团队 ID",
  "Resolved Agents": "已解析代理",
  "Team Charter": "团队宪章",
  "Team-level charter posture, enforcement surface, and runtime hook coverage for the resolved governance team.":
    "已解析治理团队的团队级宪章态势、执行面和运行时钩子覆盖率。",
  "Declared Members": "已声明成员",
  "Missing Members": "缺失成员",
  "Freeze Active Members": "冻结活跃成员",
  "Policy Surface": "策略面",
  "Effective Tool Deny": "生效工具禁用",
  "Team Profile": "团队档案",
  "Member-level governance overview for the resolved team, including runtime and mutation posture.":
    "已解析团队的成员级治理概览，包括运行时和变更态势。",
  "Open Sovereignty Incidents": "未关闭主权事件",
  "No member mission declared.": "未声明成员使命。",
  "No governed team members returned.": "未返回受治理团队成员。",
  "Capability registry has not been loaded yet.": "能力注册表尚未加载。",
  Scope: "范围",
  "Governed Knowledge Assets": "治理知识资产",
  "Priority Gaps": "优先缺口",
  "Hot Entries": "热点条目",
  "No governed capability gaps.": "没有受治理能力缺口。",
  "No governed capability entries visible.": "没有可见的受治理能力条目。",
  "Loading governance capability inventory...": "正在加载治理能力清单...",
  "Deterministic stage plan for the governed genesis team to close the highest-priority gaps.":
    "治理创世纪团队用于关闭最高优先级缺口的确定性阶段计划。",
  "No active genesis blockers.": "没有活跃创世纪阻塞项。",
  "Loading governance genesis plan...": "正在加载治理创世纪计划...",
  "Review, reject, and apply machine-generated charter mutations from the governance ledger.":
    "审查、拒绝和应用治理账本中的机器生成宪章变更。",
  "Latest Synthesis": "最新合成",
  "Deterministic proposal generation against the current governance scope.":
    "针对当前治理范围的确定性提案生成。",
  "Latest Reconcile": "最新对账",
  "Deterministic synthesis plus bounded auto-approval and auto-apply execution.":
    "确定性合成以及有边界的自动批准和自动应用执行。",
  "Proposal Workbench": "提案工作台",
  "Create governed charter mutations directly from the control plane.":
    "直接从控制平面创建受治理的宪章变更。",
  "Created By Agent": "创建代理",
  "Created By Session Key": "创建会话键",
  "Operations JSON": "操作 JSON",
  "Draft Preview": "草稿预览",
  "Status Filter": "状态过滤",
  "Decision / Reconcile Note": "决策 / 对账备注",
  "Apply Record": "应用记录",
  "Revert Record": "回滚记录",
  "Agent Charter": "代理宪章",
  "Role blueprint, collaborator boundary, and effective runtime contract for":
    "角色蓝图、协作者边界和生效运行时契约：",
  "No charter mission declared.": "未声明宪章使命。",
  "May Decide": "可决策",
  "Must Not Decide": "不可决策",
  "Mutation and Runtime": "变更与运行时",
  "Injected Charter Prompt": "注入的宪章提示",

  "Agent Context": "代理上下文",
  Workspace: "工作区",
  "Open Files tab": "打开文件标签页",
  "Primary Model": "主模型",
  "Identity Name": "身份名称",
  "Identity Avatar": "身份头像",
  "Skills Filter": "技能过滤",
  Default: "默认",
  Channels: "通信渠道",
  "Gateway-wide channel status snapshot.": "网关级通信渠道状态快照。",
  "No channels found.": "未找到通信渠道。",
  "Setup guide": "设置指南",
  Scheduler: "调度器",
  "Gateway cron status.": "网关定时任务状态。",
  Jobs: "任务",
  "Next wake": "下次唤醒",
  "Agent Cron Jobs": "代理定时任务",
  "Scheduled jobs targeting this agent.": "指向该代理的计划任务。",
  "No jobs assigned.": "没有分配任务。",
  "Core Files": "核心文件",
  "Bootstrap persona, identity, and tool guidance.": "启动人格、身份和工具指南。",
  "No files found.": "未找到文件。",
  "Select a file to edit.": "选择一个文件进行编辑。",
  "Preview rendered markdown": "预览渲染后的 Markdown",
  "Toggle fullscreen": "切换全屏",
  "Edit file": "编辑文件",
  Content: "内容",
  Overview: "概览",
  "Workspace paths and identity metadata.": "工作区路径和身份元数据。",
  "Model Selection": "模型选择",
  "Not set": "未设置",
  Fallbacks: "后备模型",
  "Tool Access": "工具访问",
  "Loading runtime tool catalog…": "正在加载运行时工具目录…",
  Profile: "档案",
  Source: "来源",
  "Available Right Now": "当前可用",
  "Loading available tools…": "正在加载可用工具…",
  "Quick Presets": "快速预设",
  Skills: "技能",
  "Remove per-agent allowlist and use all skills": "移除单代理允许列表并使用全部技能",
  Filter: "过滤",
  "Search skills": "搜索技能",
  "No skills found.": "未找到技能。",
  "Select an agent": "选择代理",
  "Pick an agent to inspect its workspace and tools.": "选择一个代理以检查其工作区和工具。",
  "Copy agent ID to clipboard": "复制代理 ID 到剪贴板",
  "Decentralized DMs via Nostr relays (NIP-04).": "通过 Nostr 中继进行去中心化私信（NIP-04）。",
  "Bot status and channel configuration.": "机器人状态和通信渠道配置。",
  "BTW side result": "BTW 旁路结果",
  "Not saved to chat history": "未保存到聊天历史",
  "Dismiss BTW result": "关闭 BTW 结果",
  Dismiss: "关闭",
  "Remove attachment": "移除附件",
  "Type a message below · / for commands": "在下方输入消息 · 输入 / 查看命令",
  "Ready to chat": "已就绪，可开始聊天",
  "Search messages...": "搜索消息...",
  "Search messages": "搜索消息",
  "Close search": "关闭搜索",
  Unpin: "取消固定",
  "Command arguments": "命令参数",
  "Slash commands": "斜杠命令",
  "Loading chat": "正在加载聊天",
  "No matching messages": "没有匹配消息",
  "Exit focus mode": "退出专注模式",
  "Remove queued message": "移除排队消息",
  "Attach file": "附加文件",
  "New session": "新会话",
  Export: "导出",
  "Export chat": "导出聊天",
  Stop: "停止",
  "Stop generating": "停止生成",
  Theme: "主题",
  "Choose a theme family.": "选择主题系列。",
  Roundness: "圆角",
  "Adjust corner radius across the UI.": "调整整个界面的圆角。",
  Connection: "连接",
  Gateway: "网关",
  Assistant: "助手",
  "No changes": "没有更改",
  "Raw mode disabled (snapshot cannot safely round-trip raw text).":
    "原始模式已禁用（快照无法安全往返处理原始文本）。",
  "Search settings...": "搜索设置...",
  "Search settings": "搜索设置",
  "Clear search": "清除搜索",
  "Your configuration is invalid. Some settings may not work as expected.":
    "你的配置无效，部分设置可能无法按预期工作。",
  "Loading schema…": "正在加载架构…",
  "Toggle raw config redaction": "切换原始配置脱敏",
  "Raw config (JSON/JSON5)": "原始配置（JSON/JSON5）",
  Snapshots: "快照",
  "Status, health, and heartbeat data.": "状态、健康度和心跳数据。",
  Health: "健康度",
  "Last heartbeat": "最近心跳",
  "Manual RPC": "手动 RPC",
  "Send a raw gateway method with JSON params.": "使用 JSON 参数发送原始网关方法。",
  Method: "方法",
  "Select a method…": "选择方法…",
  "Params (JSON)": "参数（JSON）",
  Models: "模型",
  "Catalog from models.list.": "来自 models.list 的目录。",
  "Event Log": "事件日志",
  "Latest gateway events.": "最新网关事件。",
  "No events yet.": "暂无事件。",
  Logs: "日志",
  "Gateway file logs (JSONL).": "网关文件日志（JSONL）。",
  "Search logs": "搜索日志",
  "Auto-follow": "自动跟随",
  "No log entries.": "没有日志条目。",
  Nodes: "节点",
  "Paired devices and live links.": "已配对设备和实时连接。",
  "No nodes found.": "未找到节点。",
  Devices: "设备",
  "Pairing requests + role tokens.": "配对请求和角色令牌。",
  Pending: "待处理",
  Paired: "已配对",
  "No paired devices.": "没有已配对设备。",
  "Tokens: none": "令牌：无",
  Tokens: "令牌",
  "Any node": "任意节点",
  "No nodes with system.run available.": "没有可用 system.run 的节点。",
  "No agents found.": "未找到代理。",
  Binding: "绑定",
  Sessions: "会话",
  Global: "全局",
  Unknown: "未知",
  Limit: "限制",
  "Filter by key, label, kind…": "按键、标签、类型过滤…",
  "Select all on page": "选择本页全部",
  "Select session": "选择会话",
  Label: "标签",
  Compaction: "压缩",
  Thinking: "思考",
  Fast: "快速",
  Verbose: "详细",
  Reasoning: "推理",
  "Loading checkpoints…": "正在加载检查点…",
  "No summary captured.": "没有捕获摘要。",
  "Installed skills and their status.": "已安装技能及其状态。",
  "Filter installed skills": "过滤已安装技能",
  "Search ClawHub skills…": "搜索 ClawHub 技能…",
  "Searching…": "搜索中…",
  "No skills found on ClawHub.": "ClawHub 中未找到技能。",
  "Skill not found.": "未找到技能。",
  "Missing requirements": "缺失要求",
  "Close sidebar": "关闭侧边栏",
  "View Raw Text": "查看原始文本",
  "Exec approvals": "执行审批",
  Host: "主机",
  Node: "节点",
  Fallback: "后备",
  Enabled: "已启用",
  Allowlist: "允许列表",
  "Case-insensitive glob patterns.": "不区分大小写的 glob 模式。",
  Pattern: "模式",
  "Copy command": "复制命令",
  Cancel: "取消",
  Create: "创建",
  "Search or jump to… (⌘K)": "搜索或跳转…（⌘K）",
  "Open command palette": "打开命令面板",
  "Update available:": "发现可用更新：",
  "Dismiss update banner": "关闭更新横幅",
  "Chat settings": "聊天设置",
  "Color mode": "颜色模式",
  "Copy code": "复制代码",
  Copy: "复制",
  "Copied!": "已复制！",
  Delete: "删除",
  "Delete message": "删除消息",
  "Delete this message?": "删除这条消息？",
  "Don't ask again": "不再询问",
  "Read aloud": "朗读",
  "Stop speaking": "停止朗读",
  "Open in canvas": "在画布中打开",
  "Chat model": "聊天模型",
  "Chat thinking level": "聊天思考级别",
  "Open in the side panel": "在侧边栏中打开",
  "Open tool details in side panel": "在侧边栏中打开工具详情",
  "Raw details": "原始详情",
  Completed: "已完成",
  "Voice note": "语音备注",
  "Checking...": "检查中...",
  Unavailable: "不可用",
  "Start a managed flow before submitting replay verdicts.":
    "提交回放结论前请先启动托管流程。",
  "Latest flow does not expose a sandbox replay runner yet.":
    "最新流程尚未暴露沙箱回放运行器。",
  "Loading autonomy fleet posture...": "正在加载自治集群态势...",
  "No governed autonomy profiles are visible yet.": "尚无可见的受治理自治档案。",
  "Running an end-to-end autonomy supervision pass across the visible fleet.":
    "正在对可见集群运行端到端自治监督流程。",
  "No governed capability gaps are currently flagged by the registry.":
    "注册表当前未标记受治理能力缺口。",
  "Loading capability registry...": "正在加载能力注册表...",
  "Planning Genesis handoffs...": "正在规划创世纪交接...",
  "No Genesis handoff plan has been synthesized yet.": "尚未合成创世纪交接计划。",
  "No governance proposals were synthesized for the current scope.":
    "当前范围尚未合成治理提案。",
  "Synthesizing charter repair proposals...": "正在合成宪章修复提案...",
  "No synthesized governance proposals yet.": "尚无已合成治理提案。",
  "No synthesized governance mutations were eligible for reconcile execution.":
    "没有可用于对账执行的已合成治理变更。",
  "Reconciling synthesized governance proposals...": "正在对账已合成治理提案...",
  "Loading autonomy history...": "正在加载自治历史...",
  "Load the profile to inspect its governed autonomy contract.":
    "加载档案以检查其受治理自治契约。",
  "Seed Task Enabled": "已启用种子任务",
  "Reset Overrides": "重置覆盖项",
  "No loop job is scheduled yet. Enabling it will install a governed recurring control cycle for this profile.":
    "尚未计划循环任务。启用后会为该档案安装受治理的周期控制循环。",
  "Use Goal": "使用目标",
  "No managed autonomy flow has been recorded for this session lane yet.":
    "该会话通道尚未记录托管自治流程。",
  "Bootstrap charter constitution": "引导宪章宪制",
  "Explain why this governed mutation is necessary.": "说明为什么需要此受治理变更。",
  "optional approval, rejection, or reconcile note": "可选批准、拒绝或对账备注",
  "Use Inventory Scope": "使用清单范围",
  "Use Genesis Scope": "使用创世纪范围",
  "Clear Scope": "清空范围",
  "Resolved Team": "已解析团队",
  "Resolved Workspaces": "已解析工作区",
  "Loading governance team charter...": "正在加载治理团队宪章...",
  "Team member governance appears here after a team snapshot loads.":
    "团队快照加载后，成员治理信息会显示在这里。",
  "Governed skills, plugins, memory, strategy, algorithm assets, blueprints, and gap pressure for the selected governance scope.":
    "所选治理范围内的受治理技能、插件、记忆、策略、算法资产、蓝图和缺口压力。",
  "Focus Gaps": "关注缺口",
  "Created proposal": "已创建提案",
  "Load Draft": "加载草稿",
  "Loading governance proposals...": "正在加载治理提案...",
  "Loading selected agent governance...": "正在加载所选代理治理信息...",
  "You have unsaved config changes.": "你有未保存的配置更改。",
  "Load channels to see live status.": "加载通信渠道以查看实时状态。",
  "Run Now": "立即运行",
  "Load the agent workspace files to edit core instructions.":
    "加载代理工作区文件以编辑核心指令。",
  Reset: "重置",
  "This file is missing. Saving will create it in the agent workspace.":
    "该文件缺失。保存后将在代理工作区中创建它。",
  "Profile + per-tool overrides for this agent.": "该代理的档案和逐工具覆盖项。",
  "Enable All": "全部启用",
  "Disable All": "全部禁用",
  "Load the gateway config to adjust tool profiles.": "加载网关配置以调整工具档案。",
  "Could not load runtime tool catalog. Showing built-in fallback list instead.":
    "无法加载运行时工具目录，改为显示内置后备列表。",
  "What this agent can use in the current chat session.":
    "该代理在当前聊天会话中可使用的内容。",
  "Switch chat to this agent to view its live runtime tools.":
    "将聊天切换到该代理以查看其实时运行时工具。",
  "Could not load available tools for this session.": "无法加载该会话的可用工具。",
  "No tools are available for this session right now.": "该会话当前没有可用工具。",
  Inherit: "继承",
  "Load the gateway config to set per-agent skills.": "加载网关配置以设置逐代理技能。",
  "This agent uses a custom skill allowlist.": "该代理使用自定义技能允许列表。",
  "All skills are enabled. Disabling any skill will create a per-agent allowlist.":
    "所有技能均已启用。禁用任意技能会创建逐代理允许列表。",
  "Load skills for this agent to view workspace-specific entries.":
    "加载该代理的技能以查看工作区专属条目。",
  "No agents": "没有代理",
  "Copy ID": "复制 ID",
  "Schema unavailable. Use Raw.": "架构不可用。请使用原始模式。",
  "Channel config schema unavailable.": "通信渠道配置架构不可用。",
  "Unsupported schema node. Use Raw mode.": "不支持的架构节点。请使用原始模式。",
  "Unsupported array schema. Use Raw mode.": "不支持的数组架构。请使用原始模式。",
  "Unsupported schema. Use Raw.": "不支持的架构。请使用原始模式。",
  "Schema unavailable.": "架构不可用。",
  "Select...": "请选择...",
  Add: "添加",
  "Add Entry": "添加条目",
  "Custom entries": "自定义条目",
  "No custom entries.": "没有自定义条目。",
  "Reset to default": "重置为默认值",
  "Remove item": "移除项目",
  Key: "键",
  "Remove entry": "移除条目",
  "Quick Settings": "快速设置",
  Form: "表单",
  Raw: "原始",
  "Don't remind again": "不再提醒",
  Peek: "预览",
  "What should it do?": "它应该做什么？",
  "Describe the task in natural language. The agent will run this prompt each time.":
    "用自然语言描述任务。代理每次都会运行此提示。",
  "Name (optional)": "名称（可选）",
  "e.g., Check my inbox for urgent emails and summarize them...":
    "例如：检查我的收件箱中的紧急邮件并汇总...",
  "e.g., Morning inbox check": "例如：早间收件箱检查",
  "When should it run?": "它应该何时运行？",
  "Pick a schedule. You can fine-tune it later.": "选择一个计划。之后可以再微调。",
  Back: "返回",
  Next: "下一步",
  "How should it work?": "它应该如何工作？",
  "Choose how results are delivered.": "选择结果投递方式。",
  "Optional routing key for job delivery and wake routing.":
    "用于任务投递和唤醒路由的可选路由键。",
  "Account ID": "账户 ID",
  "Optional channel account ID for multi-account setups.":
    "多账户设置中的可选通信渠道账户 ID。",
  "Light context": "轻量上下文",
  "Use lightweight bootstrap context for this agent job.":
    "为该代理任务使用轻量启动上下文。",
  "Failure alerts": "失败告警",
  "Inherit global setting": "继承全局设置",
  "Disable for this job": "对此任务禁用",
  "Custom per-job settings": "自定义逐任务设置",
  "Control when this job sends repeated-failure alerts.":
    "控制该任务何时发送重复失败告警。",
  "Alert after": "告警阈值",
  "Consecutive errors before alerting.": "触发告警前的连续错误次数。",
  "Cooldown (seconds)": "冷却时间（秒）",
  "Minimum seconds between alerts.": "告警之间的最小秒数。",
  "Alert channel": "告警渠道",
  "Alert to": "告警发送到",
  "Optional recipient override for failure alerts.": "失败告警的可选接收人覆盖项。",
  "+1555... or chat id": "+1555... 或聊天 ID",
  "Alert mode": "告警模式",
  "Announce (via channel)": "公告（通过渠道）",
  "Webhook (HTTP POST)": "Webhook（HTTP POST）",
  "Alert account ID": "告警账户 ID",
  "Account ID for multi-account setups": "多账户设置的账户 ID",
  "Run if due": "到期则运行",
  "Close": "关闭",
  "Copy archive path": "复制归档路径",
  "No imported insights yet": "尚无导入洞察",
  "Run a ChatGPT import with apply to surface clustered imported insights here.":
    "运行带应用的 ChatGPT 导入，以在此显示聚类后的导入洞察。",
  "Potentially useful signals": "潜在有用信号",
  "Corrections or revisions": "更正或修订",
  "Import details": "导入详情",
  "Started with:": "起始内容：",
  "Ended on:": "结束内容：",
  "Messages:": "消息：",
  "Risk reasons:": "风险原因：",
  "Labels:": "标签：",
  "Open source page": "打开来源页面",
  "Memory palace is not populated yet": "记忆宫殿尚未填充",
  "Claims": "声明",
  "Open questions": "开放问题",
  "Contradictions": "矛盾",
  "Page details": "页面详情",
  "Wiki page:": "Wiki 页面：",
  "Id:": "ID：",
  "Open wiki page": "打开 Wiki 页面",
  Dreams: "梦境",
  "Imported Insights": "导入洞察",
  "Memory Palace": "记忆宫殿",
  "Memory Wiki is not enabled": "记忆 Wiki 未启用",
  "Imported Insights and Memory Palace are provided by the bundled":
    "导入洞察和记忆宫殿由内置插件提供：",
  Enable: "启用",
  "Open Config": "打开配置",
  Reload: "重新加载",
  "Reloading…": "重新加载中…",
  "How to enable": "如何启用",
  "Hide details": "隐藏详情",
  "Allow once": "允许一次",
  "Always allow": "始终允许",
  Deny: "拒绝",
  "No content available": "没有可用内容",
  "Allowlist and approval policy for": "允许列表和审批策略：",
  "Load exec approvals to edit allowlists.": "加载执行审批以编辑允许列表。",
  Target: "目标",
  "Select node": "选择节点",
  "No nodes advertise exec approvals yet.": "尚无节点声明执行审批能力。",
  Defaults: "默认值",
  Security: "安全",
  Ask: "询问",
  "Ask fallback": "询问后备",
  "Auto-allow skill CLIs": "自动允许技能 CLI",
  "Add pattern": "添加模式",
  "No allowlist entries yet.": "尚无允许列表条目。",
  Remove: "移除",
  Approve: "批准",
  Reject: "拒绝",
  Rotate: "轮换",
  Revoke: "撤销",
  Freeze: "冻结",
  "Device pairing docs (opens in new tab)": "设备配对文档（在新标签页打开）",
  "Control UI auth docs (opens in new tab)": "控制界面认证文档（在新标签页打开）",
  "Tailscale Serve docs (opens in new tab)": "Tailscale Serve 文档（在新标签页打开）",
  "Insecure HTTP docs (opens in new tab)": "不安全 HTTP 文档（在新标签页打开）",
  "Docs: Device pairing": "文档：设备配对",
  "Docs: Control UI auth": "文档：控制界面认证",
  "Docs: Tailscale Serve": "文档：Tailscale Serve",
  "Docs: Insecure HTTP": "文档：不安全 HTTP",
  "Auth token must be passed as a URL fragment:":
    "认证令牌必须作为 URL 片段传递：",
  "Toggle token visibility": "切换令牌可见性",
  "Toggle password visibility": "切换密码可见性",
  "system or shared password": "系统或共享密码",
  "No sessions found.": "未找到会话。",
  "(optional)": "（可选）",
  Previous: "上一页",
  "No compaction checkpoints recorded for this session.":
    "该会话尚无压缩检查点记录。",
  "Branch from checkpoint": "从检查点创建分支",
  Restore: "恢复",
  "Search and install skills from the registry": "从注册表搜索并安装技能",
  "API key": "API 密钥",
  "Get your key:": "获取你的密钥：",
  "Save key": "保存密钥",
  "Filter by role": "按角色过滤",
  "Filter by tool": "按工具过滤",
  "Remove days filter": "移除天数过滤",
  "Remove hours filter": "移除小时过滤",
  "Remove session filter": "移除会话过滤",
  "unknown error": "未知错误",
  "gateway token mismatch": "网关令牌不匹配",
  "gateway auth failed": "网关认证失败",
  "too many failed authentication attempts": "认证失败次数过多",
  "gateway pairing required": "需要网关配对",
  "device identity required (use HTTPS/localhost or allow insecure auth explicitly)":
    "需要设备身份（请使用 HTTPS/localhost，或显式允许不安全认证）",
  "origin not allowed (open the Control UI from the gateway host or allow it in gateway.controlUi.allowedOrigins)":
    "来源不被允许（请从网关主机打开控制界面，或在 gateway.controlUi.allowedOrigins 中允许该来源）",
  "gateway token missing": "缺少网关令牌",
  "gateway connect failed": "网关连接失败",
};

const SKIP_SELECTOR = [
  "code",
  "pre",
  "kbd",
  "samp",
  "script",
  "style",
  "textarea",
  ".mono",
  ".markdown-body",
  ".markdown-sidebar",
  ".chat-message",
  ".chat-message__content",
  ".log-line",
  ".terminal",
  "[data-no-localize]",
].join(",");

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function translateExact(value: string): string | null {
  const normalized = normalizeText(value);
  return UI_TEXT_TRANSLATIONS[normalized] ?? null;
}

function translateDynamic(value: string): string | null {
  const normalized = normalizeText(value);
  const gatewayStatus = normalized.match(/^Gateway status: (.+)$/);
  if (gatewayStatus) {
    return `网关状态：${UI_TEXT_TRANSLATIONS[gatewayStatus[1]] ?? gatewayStatus[1]}`;
  }
  const colorMode = normalized.match(/^Color mode: (.+)$/);
  if (colorMode) {
    return `颜色模式：${UI_TEXT_TRANSLATIONS[colorMode[1]] ?? colorMode[1]}`;
  }
  const pendingChanges = normalized.match(/^View (\d+) pending changes?$/);
  if (pendingChanges) {
    return `查看 ${pendingChanges[1]} 个待处理更改`;
  }
  const lastRefresh = normalized.match(/^Last refresh: (.+)$/);
  if (lastRefresh) {
    return `最近刷新：${lastRefresh[1]}`;
  }
  const blocked = normalized.match(/^Blocked: (.+)$/);
  if (blocked) {
    return `已阻塞：${blocked[1]}`;
  }
  const accounts = normalized.match(/^Accounts \((.+)\)$/);
  if (accounts) {
    return `账户（${accounts[1]}）`;
  }
  const queued = normalized.match(/^Queued \((.+)\)$/);
  if (queued) {
    return `已排队（${queued[1]}）`;
  }
  const exportLabel = normalized.match(/^Export (.+)$/);
  if (exportLabel) {
    return `导出 ${exportLabel[1]}`;
  }
  const fileLabel = normalized.match(/^File: (.+)$/);
  if (fileLabel) {
    return `文件：${fileLabel[1]}`;
  }
  const useDefault = normalized.match(/^Use default \((.+)\)$/);
  if (useDefault) {
    return `使用默认值（${useDefault[1]}）`;
  }
  const lastUsed = normalized.match(/^Last used: (.+)$/);
  if (lastUsed) {
    return `最近使用：${lastUsed[1]}`;
  }
  const unsupportedType = normalized.match(/^Unsupported type: (.+)\. Use Raw mode\.$/);
  if (unsupportedType) {
    return `不支持的类型：${unsupportedType[1]}。请使用原始模式。`;
  }
  const latestVersion = normalized.match(/^Latest: v(.+)$/);
  if (latestVersion) {
    return `最新：v${latestVersion[1]}`;
  }
  if (normalized.startsWith("Update available:")) {
    return normalized.replace("Update available:", "发现可用更新：").replace("(running", "（当前运行");
  }
  if (normalized.startsWith("Source:")) {
    return normalized.replace("Source:", "来源：");
  }
  if (normalized.startsWith("Primary model")) {
    return normalized.replace("Primary model", "主模型").replace("(default)", "（默认）");
  }
  return null;
}

function translateValue(value: string): string | null {
  return translateExact(value) ?? translateDynamic(value);
}

function shouldSkipTextNode(node: Text): boolean {
  const parent = node.parentElement;
  return !parent || Boolean(parent.closest(SKIP_SELECTOR));
}

function translateTextNode(node: Text) {
  if (shouldSkipTextNode(node)) {
    return;
  }
  const translated = translateValue(node.data);
  if (!translated) {
    return;
  }
  const prefix = node.data.match(/^\s*/)?.[0] ?? "";
  const suffix = node.data.match(/\s*$/)?.[0] ?? "";
  node.data = `${prefix}${translated}${suffix}`;
}

function translateAttributes(root: ParentNode) {
  const candidates =
    root instanceof Element ? [root, ...Array.from(root.querySelectorAll("*"))] : [];
  for (const element of candidates) {
    if (element.closest(SKIP_SELECTOR)) {
      continue;
    }
    for (const attr of ["title", "aria-label", "placeholder"]) {
      const current = element.getAttribute(attr);
      if (!current) {
        continue;
      }
      const translated = translateValue(current);
      if (translated) {
        element.setAttribute(attr, translated);
      }
    }
  }
}

export function localizeControlUiDom(root: ParentNode) {
  if (typeof document === "undefined") {
    return;
  }
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) {
    nodes.push(walker.currentNode as Text);
  }
  for (const node of nodes) {
    translateTextNode(node);
  }
  translateAttributes(root);
}
