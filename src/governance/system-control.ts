/**
 * 系统环境感知与控制模块
 * 
 * 提供对本地操作系统的安全访问能力，包括：
 * 1. 系统资源监控 (CPU, Memory, Disk, Network)
 * 2. 进程管理 (List, Kill)
 * 3. 文件系统操作 (Read, Write, List - 受限路径)
 * 4. 剪贴板交互
 * 5. 屏幕截图
 */

import os from 'node:os';
import fs from 'node:fs/promises';
import path from 'node:path';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { createSubsystemLogger } from '../logging/subsystem.js';

const execAsync = promisify(exec);
const log = createSubsystemLogger('system-control');

// ==================== 类型定义 ====================

export interface SystemMetrics {
  timestamp: number;
  hostname: string;
  platform: string;
  uptime: number;
  cpu: {
    model: string;
    speed: number;
    cores: number;
    loadAvg: number[];
    usagePercent: number; // 估算值
  };
  memory: {
    total: number;
    free: number;
    used: number;
    usagePercent: number;
  };
  disk?: {
    total: number;
    free: number;
    used: number;
    usagePercent: number;
  };
  networkInterfaces: Record<string, any[]>;
}

export interface ProcessInfo {
  pid: number;
  name: string;
  cpu?: number;
  memory?: number;
  command?: string;
}

export interface FileSystemItem {
  name: string;
  path: string;
  isDirectory: boolean;
  size?: number;
  modifiedAt?: Date;
}

export interface ScreenshotResult {
  format: 'png' | 'jpeg';
  data: Buffer;
  width: number;
  height: number;
}

// ==================== 核心功能类 ====================

export class SystemController {
  private allowedRoots: string[];

  constructor(allowedRoots: string[] = [process.cwd()]) {
    this.allowedRoots = allowedRoots.map(r => path.resolve(r));
  }

  /**
   * 获取系统实时指标
   */
  async getSystemMetrics(): Promise<SystemMetrics> {
    const cpus = os.cpus();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    
    // 简单的 CPU 使用率估算 (基于 Load Average)
    const loadAvg = os.loadavg();
    const coreCount = cpus.length;
    // Load average 是过去1,5,15分钟的平均负载，除以核心数得到大致百分比
    const usagePercent = Math.min(100, (loadAvg[0] / coreCount) * 100);

    let diskInfo: SystemMetrics['disk'] = undefined;
    try {
      // 尝试获取磁盘使用情况 (仅 Linux/Mac 支持 df 命令，Windows 需不同处理)
      if (process.platform !== 'win32') {
        const { stdout } = await execAsync('df -k /');
        const lines = stdout.trim().split('\n');
        if (lines.length > 1) {
          const parts = lines[1].split(/\s+/);
          const total = parseInt(parts[1]) * 1024;
          const used = parseInt(parts[2]) * 1024;
          const free = parseInt(parts[3]) * 1024;
          diskInfo = {
            total,
            used,
            free,
            usagePercent: (used / total) * 100
          };
        }
      }
    } catch (e) {
      log.warn('Failed to get disk info', e);
    }

    return {
      timestamp: Date.now(),
      hostname: os.hostname(),
      platform: process.platform,
      uptime: os.uptime(),
      cpu: {
        model: cpus[0].model,
        speed: cpus[0].speed,
        cores: coreCount,
        loadAvg,
        usagePercent
      },
      memory: {
        total: totalMem,
        free: freeMem,
        used: usedMem,
        usagePercent: (usedMem / totalMem) * 100
      },
      disk: diskInfo,
      networkInterfaces: Object.fromEntries(
        Object.entries(os.networkInterfaces()).map(([name, entries]) => [name, entries ?? []]),
      )
    };
  }

  /**
   * 列出当前运行的进程
   */
  async listProcesses(filter?: string): Promise<ProcessInfo[]> {
    try {
      let command = '';
      if (process.platform === 'win32') {
        command = 'tasklist /FO CSV /NH';
      } else {
        // Mac/Linux
        command = 'ps -eo pid,comm,%cpu,%mem --no-headers';
      }

      const { stdout } = await execAsync(command);
      const lines = stdout.trim().split('\n');
      
      const processes: ProcessInfo[] = [];

      for (const line of lines) {
        if (!line.trim()) continue;
        
        let proc: ProcessInfo | null = null;

        if (process.platform === 'win32') {
          // Parse CSV-like output: "name.exe","1234","Console","1","10,000 K"
          const matches = line.match(/"([^"]+)"/g);
          if (matches && matches.length >= 2) {
            proc = {
              pid: parseInt(matches[1].replace(/"/g, '')),
              name: matches[0].replace(/"/g, ''),
            };
          }
        } else {
          // Parse ps output: pid comm %cpu %mem
          const parts = line.trim().split(/\s+/);
          if (parts.length >= 4) {
            proc = {
              pid: parseInt(parts[0]),
              name: parts[1],
              cpu: parseFloat(parts[2]),
              memory: parseFloat(parts[3])
            };
          }
        }

        if (proc) {
          if (!filter || proc.name.toLowerCase().includes(filter.toLowerCase())) {
            processes.push(proc);
          }
        }
      }

      return processes.slice(0, 100); // Limit results
    } catch (error) {
      log.error('Failed to list processes', error);
      return [];
    }
  }

  /**
   * 终止进程
   */
  async killProcess(pid: number): Promise<boolean> {
    try {
      if (process.platform === 'win32') {
        await execAsync(`taskkill /F /PID ${pid}`);
      } else {
        await execAsync(`kill -9 ${pid}`);
      }
      log.info(`Killed process ${pid}`);
      return true;
    } catch (error) {
      log.error(`Failed to kill process ${pid}`, error);
      return false;
    }
  }

  /**
   * 验证路径是否在允许的根目录下
   */
  private validatePath(targetPath: string): string {
    const resolved = path.resolve(targetPath);
    const isAllowed = this.allowedRoots.some(root => resolved.startsWith(root));
    
    if (!isAllowed) {
      throw new Error(`Access denied: Path ${resolved} is outside allowed roots (${this.allowedRoots.join(', ')})`);
    }
    return resolved;
  }

  /**
   * 列出目录内容
   */
  async listDirectory(dirPath: string): Promise<FileSystemItem[]> {
    const validPath = this.validatePath(dirPath);
    
    try {
      const items = await fs.readdir(validPath, { withFileTypes: true });
      const result: FileSystemItem[] = [];

      for (const item of items) {
        const fullPath = path.join(validPath, item.name);
        let size: number | undefined;
        let modifiedAt: Date | undefined;

        try {
          const stats = await fs.stat(fullPath);
          size = stats.size;
          modifiedAt = stats.mtime;
        } catch (e) {
          // Ignore stat errors for specific files
        }

        result.push({
          name: item.name,
          path: fullPath,
          isDirectory: item.isDirectory(),
          size,
          modifiedAt
        });
      }

      return result;
    } catch (error) {
      log.error(`Failed to list directory ${validPath}`, error);
      throw error;
    }
  }

  /**
   * 读取文件内容
   */
  async readFile(filePath: string, encoding: BufferEncoding = 'utf-8'): Promise<string> {
    const validPath = this.validatePath(filePath);
    try {
      return await fs.readFile(validPath, encoding);
    } catch (error) {
      log.error(`Failed to read file ${validPath}`, error);
      throw error;
    }
  }

  /**
   * 写入文件内容
   */
  async writeFile(filePath: string, content: string): Promise<void> {
    const validPath = this.validatePath(filePath);
    try {
      await fs.writeFile(validPath, content, 'utf-8');
      log.info(`Wrote to file ${validPath}`);
    } catch (error) {
      log.error(`Failed to write file ${validPath}`, error);
      throw error;
    }
  }

  /**
   * 获取剪贴板内容
   */
  async getClipboardContent(): Promise<string> {
    try {
      let command = '';
      if (process.platform === 'darwin') {
        command = 'pbpaste';
      } else if (process.platform === 'win32') {
        command = 'powershell.exe -command "Get-Clipboard"';
      } else {
        // Linux
        command = 'xclip -selection clipboard -o';
      }
      
      const { stdout } = await execAsync(command);
      return stdout.trim();
    } catch (error) {
      log.error('Failed to get clipboard content', error);
      return '';
    }
  }

  /**
   * 设置剪贴板内容
   */
  async setClipboardContent(content: string): Promise<void> {
    try {
      if (process.platform === 'darwin') {
        await execAsync(`echo "${content.replace(/"/g, '\\"')}" | pbcopy`);
      } else if (process.platform === 'win32') {
        await execAsync(`echo ${content} | clip`);
      } else {
        // Linux
        await execAsync(`echo "${content.replace(/"/g, '\\"')}" | xclip -selection clipboard`);
      }
      log.info('Clipboard content updated');
    } catch (error) {
      log.error('Failed to set clipboard content', error);
    }
  }

  /**
   * 屏幕截图
   */
  async takeScreenshot(): Promise<ScreenshotResult> {
    try {
      const tempFile = path.join(os.tmpdir(), `screenshot-${Date.now()}.png`);
      let command = '';

      if (process.platform === 'darwin') {
        command = `screencapture -x ${tempFile}`;
      } else if (process.platform === 'win32') {
        // PowerShell screenshot
        command = `powershell -Command "Add-Type -AssemblyName System.Windows.Forms; Add-Type -AssemblyName System.Drawing; $screen = [System.Windows.Forms.Screen]::PrimaryScreen; $bitmap = New-Object System.Drawing.Bitmap $screen.Bounds.Width, $screen.Bounds.Height; $graphics = [System.Drawing.Graphics]::FromImage($bitmap); $graphics.CopyFromScreen($screen.Bounds.X, $screen.Bounds.Y, 0, 0, $bitmap.Size); $bitmap.Save('${tempFile}', [System.Drawing.Imaging.ImageFormat]::Png);"`;
      } else {
        // Linux (requires scrot or import)
        command = `import -window root ${tempFile}`; // ImageMagick
      }

      await execAsync(command);
      
      const data = await fs.readFile(tempFile);
      await fs.unlink(tempFile); // Cleanup

      return {
        format: 'png',
        data,
        width: 0, // Would need image parsing to get exact dims
        height: 0
      };
    } catch (error) {
      log.error('Failed to take screenshot', error);
      throw error;
    }
  }
}

// ==================== 单例导出 ====================

let instance: SystemController | null = null;

export function getSystemController(allowedRoots?: string[]): SystemController {
  if (!instance) {
    instance = new SystemController(allowedRoots);
  }
  return instance;
}

export function resetSystemController(): void {
  instance = null;
}
