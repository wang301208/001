/**
 * 系统环境感知与控制 CLI 命令
 */

import { Command } from "commander";
import type { RuntimeEnv } from "../runtime.js";
import { getSystemController } from "../governance/system-control.js";

export function registerSystemControlCommands(program: Command, runtime: RuntimeEnv): void {
  const sysGroup = program.command("sys").description("系统环境感知与控制");

  // 1. 系统状态
  sysGroup
    .command("status")
    .description("查看系统资源状态 (CPU, 内存, 磁盘)")
    .action(async () => {
      console.log("📊 获取系统状态...\n");
      const controller = getSystemController();
      const metrics = await controller.getSystemMetrics();

      console.log(`主机名: ${metrics.hostname}`);
      console.log(`平台: ${metrics.platform}`);
      console.log(`运行时间: ${(metrics.uptime / 3600).toFixed(2)} 小时\n`);

      console.log("🖥️  CPU:");
      console.log(`  型号: ${metrics.cpu.model}`);
      console.log(`  核心数: ${metrics.cpu.cores}`);
      console.log(`  负载估算: ${metrics.cpu.usagePercent.toFixed(1)}%`);
      console.log(`  Load Avg: ${metrics.cpu.loadAvg.join(', ')}\n`);

      console.log("💾 内存:");
      console.log(`  总计: ${(metrics.memory.total / 1024 / 1024 / 1024).toFixed(2)} GB`);
      console.log(`  已用: ${(metrics.memory.used / 1024 / 1024 / 1024).toFixed(2)} GB (${metrics.memory.usagePercent.toFixed(1)}%)`);
      console.log(`  空闲: ${(metrics.memory.free / 1024 / 1024 / 1024).toFixed(2)} GB\n`);

      if (metrics.disk) {
        console.log("💿 磁盘 (/):");
        console.log(`  总计: ${(metrics.disk.total / 1024 / 1024 / 1024).toFixed(2)} GB`);
        console.log(`  已用: ${(metrics.disk.used / 1024 / 1024 / 1024).toFixed(2)} GB (${metrics.disk.usagePercent.toFixed(1)}%)`);
      }
    });

  // 2. 进程管理
  sysGroup
    .command("ps")
    .description("列出运行中的进程")
    .option("-f, --filter <name>", "按名称过滤进程")
    .action(async (options) => {
      console.log("🔄 获取进程列表...\n");
      const controller = getSystemController();
      const processes = await controller.listProcesses(options.filter);

      if (processes.length === 0) {
        console.log("未找到匹配的进程。");
        return;
      }

      console.log(`找到 ${processes.length} 个进程:\n`);
      console.log("PID\tNAME\t\tCPU%\tMEM%");
      console.log("-".repeat(50));
      
      processes.slice(0, 20).forEach(p => {
        console.log(`${p.pid}\t${p.name.padEnd(15)}\t${p.cpu?.toFixed(1) || '-'}\t${p.memory?.toFixed(1) || '-'}`);
      });
      
      if (processes.length > 20) {
        console.log(`... 还有 ${processes.length - 20} 个进程`);
      }
    });

  sysGroup
    .command("kill")
    .description("终止指定 PID 的进程")
    .requiredOption("-p, --pid <number>", "进程 ID", parseInt)
    .action(async (options) => {
      console.log(`⚠️  正在终止进程 ${options.pid}...`);
      const controller = getSystemController();
      const success = await controller.killProcess(options.pid);
      
      if (success) {
        console.log("✅ 进程已终止。");
      } else {
        console.log("❌ 终止失败，请检查权限或 PID 是否正确。");
      }
    });

  // 3. 文件系统
  sysGroup
    .command("ls")
    .description("列出目录内容 (仅限工作区)")
    .argument("[path]", "目录路径", ".")
    .action(async (dirPath) => {
      try {
        const controller = getSystemController();
        const items = await controller.listDirectory(dirPath);
        
        console.log(`📂 目录: ${dirPath}\n`);
        items.forEach(item => {
          const type = item.isDirectory ? "📁" : "📄";
          const size = item.size ? `${(item.size / 1024).toFixed(1)} KB` : "-";
          console.log(`${type} ${item.name.padEnd(30)} ${size}`);
        });
      } catch (error: any) {
        console.error(`❌ 错误: ${error.message}`);
      }
    });

  sysGroup
    .command("cat")
    .description("读取文件内容 (仅限工作区)")
    .requiredOption("-f, --file <path>", "文件路径")
    .action(async (options) => {
      try {
        const controller = getSystemController();
        const content = await controller.readFile(options.file);
        console.log(`📄 文件内容 (${options.file}):\n`);
        console.log(content);
      } catch (error: any) {
        console.error(`❌ 错误: ${error.message}`);
      }
    });

  // 4. 剪贴板
  sysGroup
    .command("clipboard")
    .description("剪贴板操作")
    .option("-g, --get", "获取剪贴板内容")
    .option("-s, --set <text>", "设置剪贴板内容")
    .action(async (options) => {
      const controller = getSystemController();
      
      if (options.get) {
        const content = await controller.getClipboardContent();
        console.log("📋 剪贴板内容:");
        console.log(content);
      } else if (options.set) {
        await controller.setClipboardContent(options.set);
        console.log("✅ 剪贴板内容已更新。");
      } else {
        console.log("请使用 -g 获取或 -s 设置剪贴板内容。");
      }
    });

  // 5. 截图
  sysGroup
    .command("screenshot")
    .description("截取当前屏幕")
    .option("-o, --output <path>", "保存路径 (默认临时文件)")
    .action(async (options) => {
      console.log("📸 正在截图...");
      try {
        const controller = getSystemController();
        const result = await controller.takeScreenshot();
        
        if (options.output) {
          const fs = await import('node:fs/promises');
          await fs.writeFile(options.output, result.data);
          console.log(`✅ 截图已保存至: ${options.output}`);
        } else {
          console.log(`✅ 截图完成 (Buffer大小: ${result.data.length} bytes)`);
          console.log("提示: 使用 -o 参数保存文件。");
        }
      } catch (error: any) {
        console.error(`❌ 截图失败: ${error.message}`);
        console.log("注意: Linux 可能需要安装 ImageMagick (import) 或 scrot。");
      }
    });
}