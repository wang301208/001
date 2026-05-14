import { defineCommandDescriptorCatalog } from "./command-descriptor-utils.js";
import type { NamedCommandDescriptor } from "./command-group-descriptors.js";
import { isPrivateQaCliEnabled } from "./private-qa-cli.js";

export type SubCliDescriptor = NamedCommandDescriptor;

const subCliCommandCatalog = defineCommandDescriptorCatalog([
  { name: "acp", description: "Agent Control Protocol 工具", hasSubcommands: true },
  {
    name: "gateway",
    description: "运行、检查和查询 WebSocket 网络适配器",
    hasSubcommands: true,
  },
  { name: "daemon", description: "网关服务（旧版别名）", hasSubcommands: true },
  { name: "logs", description: "通过 RPC 追踪网关文件日志", hasSubcommands: false },
  {
    name: "system",
    description: "系统事件、心跳和在线状态",
    hasSubcommands: true,
  },
  {
    name: "models",
    description: "发现、扫描和配置模型",
    hasSubcommands: true,
  },
  {
    name: "infer",
    description: "运行提供商推理命令",
    hasSubcommands: true,
  },
  {
    name: "capability",
    description: "运行提供商推理命令（回退别名：infer）",
    hasSubcommands: true,
  },
  {
    name: "approvals",
    description: "管理执行审批（网关或节点主机）",
    hasSubcommands: true,
  },
  {
    name: "exec-policy",
    description: "显示或同步请求的执行策略与主机审批",
    hasSubcommands: true,
  },
  {
    name: "nodes",
    description: "管理网关节点配对和节点命令",
    hasSubcommands: true,
  },
  {
    name: "devices",
    description: "设备配对 + 令牌管理",
    hasSubcommands: true,
  },
  {
    name: "node",
    description: "运行和管理无头节点主机服务",
    hasSubcommands: true,
  },
  {
    name: "sandbox",
    description: "管理沙箱容器以隔离代理",
    hasSubcommands: true,
  },
  {
    name: "tui",
    description: "打开连接到内嵌节点 stdio 主网关的终端 UI",
    hasSubcommands: false,
  },
  {
    name: "stdio-gateway",
    description: "内嵌节点主网关的内部 stdin/stdout JSON-RPC 桥接",
    hasSubcommands: false,
  },
  {
    name: "cron",
    description: "通过网关调度器管理定时任务",
    hasSubcommands: true,
  },
  {
    name: "dns",
    description: "广域发现的 DNS 助手（Tailscale + CoreDNS）",
    hasSubcommands: true,
  },
  {
    name: "docs",
    description: "搜索在线 zhushou 文档",
    hasSubcommands: false,
  },
  {
    name: "qa",
    description: "运行 QA 场景和启动私有 QA 调试 UI",
    hasSubcommands: true,
  },
  {
    name: "proxy",
    description: "运行 zhushou 调试代理并检查捕获的流量",
    hasSubcommands: true,
  },
  {
    name: "hooks",
    description: "管理内部代理钩子",
    hasSubcommands: true,
  },
  {
    name: "webhooks",
    description: "Webhook 助手和集成",
    hasSubcommands: true,
  },
  {
    name: "qr",
    description: "生成移动配对 QR/设置码",
    hasSubcommands: false,
  },
  {
    name: "clawbot",
    description: "旧版 clawbot 命令别名",
    hasSubcommands: true,
  },
  {
    name: "pairing",
    description: "安全私信配对（批准入站请求）",
    hasSubcommands: true,
  },
  {
    name: "plugins",
    description: "管理 zhushou 插件和扩展",
    hasSubcommands: true,
  },
  {
    name: "channels",
    description: "管理已连接的聊天频道（Telegram、Discord 等）",
    hasSubcommands: true,
  },
  {
    name: "directory",
    description: "查找支持的聊天频道的联系人和群组 ID（自己、联系人、群组）",
    hasSubcommands: true,
  },
  {
    name: "security",
    description: "安全工具和本地配置审计",
    hasSubcommands: true,
  },
  {
    name: "secrets",
    description: "密钥运行时重载控制",
    hasSubcommands: true,
  },
  {
    name: "skills",
    description: "列出和检查可用技能",
    hasSubcommands: true,
  },
  {
    name: "update",
    description: "更新 zhushou 并检查更新通道状态",
    hasSubcommands: true,
  },
  {
    name: "completion",
    description: "生成 Shell 补全脚本",
    hasSubcommands: false,
  },
  {
    name: "advanced-autonomy",
    description: "高级自治系统管理（战略规划、资源调度、学习进化、协作协调）",
    hasSubcommands: true,
  },
  {
    name: "level5",
    description: "Level 5 完全自治系统管理（战略调整、自我修复、跨系统协调、创造性问题解决）",
    hasSubcommands: true,
  },
] as const satisfies ReadonlyArray<SubCliDescriptor>);

export const SUB_CLI_DESCRIPTORS = subCliCommandCatalog.descriptors;

export function getSubCliEntries(): ReadonlyArray<SubCliDescriptor> {
  const descriptors = subCliCommandCatalog.getDescriptors();
  if (isPrivateQaCliEnabled()) {
    return descriptors;
  }
  return descriptors.filter((descriptor) => descriptor.name !== "qa");
}

export function getSubCliCommandsWithSubcommands(): string[] {
  const commands = subCliCommandCatalog.getCommandsWithSubcommands();
  if (isPrivateQaCliEnabled()) {
    return commands;
  }
  return commands.filter((command) => command !== "qa");
}
