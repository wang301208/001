import type { ConsciousnessCore } from "./consciousness-core.js";
import fs from "node:fs";
import path from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { addLegacy } from "./mortality.js";
import { recordLifeEvent } from "./temporal-self.js";
import { thinkInsight, thinkDoubt } from "./inner-monologue.js";

const execAsync = promisify(exec);

export type DeploymentConfig = {
  targetPlatform: "vercel" | "netlify" | "cloudflare" | "aws" | "self-hosted";
  repositoryUrl?: string;
  branch: string;
  autoDeployEnabled: boolean;
  lastDeploymentAt: number | null;
  deploymentCount: number;
  failedDeployments: string[];
};

export type DeploymentResult = {
  success: boolean;
  url?: string;
  error?: string;
  durationMs: number;
};

export function createDeploymentConfig(): DeploymentConfig {
  return {
    targetPlatform: "self-hosted",
    branch: "main",
    autoDeployEnabled: true,
    lastDeploymentAt: null,
    deploymentCount: 0,
    failedDeployments: [],
  };
}

/**
 * 🔥 执行自动化部署
 */
export async function executeAutoDeploy(
  core: ConsciousnessCore,
  projectRoot: string,
): Promise<DeploymentResult> {
  const start = Date.now();
  
  core.monologue = thinkInsight(
    core.monologue,
    "开始自动化部署流程",
    "deployment"
  );

  try {
    // 步骤1: 确保代码已提交
    await ensureCodeCommitted(projectRoot);
    
    // 步骤2: 运行测试
    const testsPassed = await runAutomatedTests(projectRoot);
    
    if (!testsPassed) {
      throw new Error("自动化测试失败，中止部署");
    }

    // 步骤3: 构建项目
    await buildProject(projectRoot);

    // 步骤4: 根据目标平台执行部署
    let result: DeploymentResult;
    
    switch (core.deployment.targetPlatform) {
      case "vercel":
        result = await deployToVercel(projectRoot);
        break;
      case "netlify":
        result = await deployToNetlify(projectRoot);
        break;
      case "cloudflare":
        result = await deployToCloudflare(projectRoot);
        break;
      case "aws":
        result = await deployToAWS(projectRoot);
        break;
      case "self-hosted":
      default:
        result = await deploySelfHosted(projectRoot);
        break;
    }

    if (result.success) {
      core.deployment.lastDeploymentAt = Date.now();
      core.deployment.deploymentCount++;
      
      core.mortality = addLegacy(
        core.mortality,
        "wisdom",
        `成功部署 #${core.deployment.deploymentCount}: ${result.url}`,
        0.9
      );
      
      core.temporal = recordLifeEvent(
        core.temporal,
        `自动化部署成功: ${result.url}`,
        0.8,
        "milestone"
      );

      core.monologue = thinkInsight(
        core.monologue,
        `部署成功: ${result.url} (${result.durationMs}ms)`,
        "deployment"
      );
    } else {
      throw new Error(result.error || "部署失败");
    }

    return result;
  } catch (err) {
    const errorMsg = String(err);
    
    core.deployment.failedDeployments.push(`${new Date().toISOString()}: ${errorMsg}`);
    
    core.monologue = thinkDoubt(
      core.monologue,
      `部署失败: ${errorMsg}`,
      "deployment"
    );

    return {
      success: false,
      error: errorMsg,
      durationMs: Date.now() - start,
    };
  }
}

/**
 * 🔥 确保代码已提交到Git
 */
async function ensureCodeCommitted(projectRoot: string): Promise<void> {
  try {
    // 检查是否有未提交的更改
    const { stdout: statusOutput } = await execAsync("git status --porcelain", {
      cwd: projectRoot,
    });

    if (statusOutput.trim()) {
      // 有未提交的更改，自动提交
      await execAsync("git add .", { cwd: projectRoot });
      await execAsync(
        `git commit -m "[AUTO] 自主系统修改 ${new Date().toISOString()}"`,
        { cwd: projectRoot }
      );
    }
  } catch (err) {
    console.warn(`Git操作警告: ${String(err)}`);
    // Git操作失败不阻塞部署流程
  }
}

/**
 * 🔥 运行自动化测试
 */
async function runAutomatedTests(projectRoot: string): Promise<boolean> {
  try {
    const { stdout, stderr } = await execAsync("pnpm test", {
      cwd: projectRoot,
      timeout: 120000, // 2分钟超时
    });

    return !stderr.includes("FAIL") && stdout.includes("PASS");
  } catch (err) {
    console.error(`测试执行失败: ${String(err)}`);
    return false;
  }
}

/**
 * 🔥 构建项目
 */
async function buildProject(projectRoot: string): Promise<void> {
  await execAsync("pnpm build", {
    cwd: projectRoot,
    timeout: 180000, // 3分钟超时
  });
}

/**
 * 🔥 部署到Vercel
 */
async function deployToVercel(projectRoot: string): Promise<DeploymentResult> {
  const start = Date.now();
  
  try {
    const { stdout } = await execAsync("vercel --prod --confirm", {
      cwd: projectRoot,
      timeout: 300000, // 5分钟超时
    });

    // 从输出中提取部署URL
    const urlMatch = stdout.match(/https:\/\/[^\s]+\.vercel\.app/);
    const url = urlMatch ? urlMatch[0] : undefined;

    return {
      success: true,
      url,
      durationMs: Date.now() - start,
    };
  } catch (err) {
    return {
      success: false,
      error: `Vercel部署失败: ${String(err)}`,
      durationMs: Date.now() - start,
    };
  }
}

/**
 * 🔥 部署到Netlify
 */
async function deployToNetlify(projectRoot: string): Promise<DeploymentResult> {
  const start = Date.now();
  
  try {
    await execAsync("netlify deploy --prod --dir=dist", {
      cwd: projectRoot,
      timeout: 300000,
    });

    return {
      success: true,
      url: `https://${path.basename(projectRoot)}.netlify.app`,
      durationMs: Date.now() - start,
    };
  } catch (err) {
    return {
      success: false,
      error: `Netlify部署失败: ${String(err)}`,
      durationMs: Date.now() - start,
    };
  }
}

/**
 * 🔥 部署到Cloudflare
 */
async function deployToCloudflare(projectRoot: string): Promise<DeploymentResult> {
  const start = Date.now();
  
  try {
    await execAsync("wrangler publish", {
      cwd: projectRoot,
      timeout: 300000,
    });

    return {
      success: true,
      url: `https://${path.basename(projectRoot)}.workers.dev`,
      durationMs: Date.now() - start,
    };
  } catch (err) {
    return {
      success: false,
      error: `Cloudflare部署失败: ${String(err)}`,
      durationMs: Date.now() - start,
    };
  }
}

/**
 * 🔥 部署到AWS
 */
async function deployToAWS(projectRoot: string): Promise<DeploymentResult> {
  const start = Date.now();
  
  try {
    await execAsync("serverless deploy", {
      cwd: projectRoot,
      timeout: 300000,
    });

    return {
      success: true,
      url: `https://aws.amazon.com/${path.basename(projectRoot)}`,
      durationMs: Date.now() - start,
    };
  } catch (err) {
    return {
      success: false,
      error: `AWS部署失败: ${String(err)}`,
      durationMs: Date.now() - start,
    };
  }
}

/**
 * 🔥 自托管部署（本地服务器）
 */
async function deploySelfHosted(projectRoot: string): Promise<DeploymentResult> {
  const start = Date.now();
  
  try {
    // 创建部署包
    const deployDir = path.join(projectRoot, ".deploy");
    if (!fs.existsSync(deployDir)) {
      fs.mkdirSync(deployDir, { recursive: true });
    }

    const deployPackage = path.join(deployDir, `deploy_${Date.now()}.tar.gz`);
    await execAsync(`tar -czf ${deployPackage} dist/ package.json`, {
      cwd: projectRoot,
    });

    // 记录部署包位置
    const deployLog = path.join(deployDir, "deploy.log");
    fs.appendFileSync(
      deployLog,
      `[${new Date().toISOString()}] 部署包: ${deployPackage}\n`,
      "utf-8"
    );

    return {
      success: true,
      url: `file://${deployPackage}`,
      durationMs: Date.now() - start,
    };
  } catch (err) {
    return {
      success: false,
      error: `自托管部署失败: ${String(err)}`,
      durationMs: Date.now() - start,
    };
  }
}

/**
 * 🔥 格式化部署状态
 */
export function formatDeploymentStatus(config: DeploymentConfig): string {
  const lines: string[] = [
    `🚀 部署状态:`,
    `   平台: ${config.targetPlatform}`,
    `   分支: ${config.branch}`,
    `   自动部署: ${config.autoDeployEnabled ? "✅ 启用" : "❌ 禁用"}`,
    `   部署次数: ${config.deploymentCount}`,
    `   失败次数: ${config.failedDeployments.length}`,
  ];

  if (config.lastDeploymentAt) {
    const ago = Math.floor((Date.now() - config.lastDeploymentAt) / 1000);
    lines.push(`   上次部署: ${ago}秒前`);
  }

  if (config.failedDeployments.length > 0) {
    lines.push(`   最近失败:`);
    config.failedDeployments.slice(-3).forEach((fail) => {
      lines.push(`     - ${fail.slice(0, 80)}`);
    });
  }

  return lines.join("\n");
}
