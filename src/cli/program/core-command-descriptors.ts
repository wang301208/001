import { defineCommandDescriptorCatalog } from "./command-descriptor-utils.js";
import type { NamedCommandDescriptor } from "./command-group-descriptors.js";

export type CoreCliCommandDescriptor = NamedCommandDescriptor;

const coreCliCommandCatalog = defineCommandDescriptorCatalog([
  {
    name: "setup",
    description: "初始化本地配置和代理工作空间",
    hasSubcommands: false,
  },
  {
    name: "onboard",
    description: "交互式引导配置网关、工作空间和技能",
    hasSubcommands: false,
  },
  {
    name: "configure",
    description: "交互式配置凭据、频道、网关和代理默认值",
    hasSubcommands: false,
  },
  {
    name: "config",
    description:
      "非交互式配置助手（get/set/unset/file/validate）。默认：启动引导式配置。",
    hasSubcommands: true,
  },
  {
    name: "backup",
    description: "创建和验证本地备份归档",
    hasSubcommands: true,
  },
  {
    name: "doctor",
    description: "健康检查 + 快速修复网关和频道",
    hasSubcommands: false,
  },
  {
    name: "reset",
    description: "重置本地配置/状态（保留 CLI 安装）",
    hasSubcommands: false,
  },
  {
    name: "uninstall",
    description: "卸载网关服务 + 本地数据（CLI 保留）",
    hasSubcommands: false,
  },
  {
    name: "message",
    description: "发送、读取和管理消息",
    hasSubcommands: true,
  },
  {
    name: "mcp",
    description: "管理 zhushou MCP 配置和频道桥接",
    hasSubcommands: true,
  },
  {
    name: "agent",
    description: "通过网关运行一次代理交互",
    hasSubcommands: false,
  },
  {
    name: "agents",
    description: "管理隔离代理（工作空间、认证、路由）",
    hasSubcommands: true,
  },
  {
    name: "status",
    description: "显示频道健康状态和最近的会话接收者",
    hasSubcommands: false,
  },
  {
    name: "health",
    description: "从运行中的网关获取健康状态",
    hasSubcommands: false,
  },
  {
    name: "sessions",
    description: "列出已存储的对话会话",
    hasSubcommands: true,
  },
  {
    name: "governance",
    description: "检查组织章程和治理控制面状态",
    hasSubcommands: true,
  },
  {
    name: "tasks",
    description: "检查持久化后台任务状态",
    hasSubcommands: true,
  },
  {
    name: "autonomy",
    description: "检查和启动托管自治配置",
    hasSubcommands: true,
  },
  {
    name: "autonomous",
    description: "自治系统管理（状态/模块/审计/防御/缓存/成本）",
    hasSubcommands: true,
  },
] as const satisfies ReadonlyArray<CoreCliCommandDescriptor>);

export const CORE_CLI_COMMAND_DESCRIPTORS = coreCliCommandCatalog.descriptors;

export function getCoreCliCommandDescriptors(): ReadonlyArray<CoreCliCommandDescriptor> {
  return coreCliCommandCatalog.getDescriptors();
}

export function getCoreCliCommandNames(): string[] {
  return coreCliCommandCatalog.getNames();
}

export function getCoreCliCommandsWithSubcommands(): string[] {
  return coreCliCommandCatalog.getCommandsWithSubcommands();
}
