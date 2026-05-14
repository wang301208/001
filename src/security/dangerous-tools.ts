// 共享的工具风险常量。
// 保持集中管理，以免网关 HTTP 限制和安全审计发生漂移。

/**
 * 通过网关 HTTP `POST /tools/invoke` 默认拒绝的工具。
 * 这些工具属于高风险，因为它们支持会话编排、控制面操作，
 * 或在非交互式 HTTP 接口上无意义的交互流程。
 */
export const DEFAULT_GATEWAY_HTTP_TOOL_DENY = [
  // 直接命令执行 — 即时远程代码执行面
  "exec",
  // 任意子进程创建 — 即时远程代码执行面
  "spawn",
  // Shell 命令执行 — 即时远程代码执行面
  "shell",
  // 宿主机上的任意文件修改
  "fs_write",
  // 宿主机上的任意文件删除
  "fs_delete",
  // 宿主机上的任意文件移动/重命名
  "fs_move",
  // 补丁应用可重写任意文件
  "apply_patch",
  // 会话编排 — 远程生成代理即远程代码执行
  "sessions_spawn",
  // 跨会话注入 — 跨会话消息注入
  "sessions_send",
  // 持久自动化控制面 — 可创建/更新/移除定时运行
  "cron",
  // 网关控制面 — 阻止通过 HTTP 重新配置网关
  "gateway",
  // 节点命令中继可触达配对主机的 system.run
  "nodes",
  // 交互式设置 — 需要终端二维码扫描，在 HTTP 上会挂起
  "whatsapp_login",
] as const;
