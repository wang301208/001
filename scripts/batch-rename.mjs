#!/usr/bin/env node

/**
 * 批量重命名脚本 - 将项目中所有 zhushou/助手/zhushou 引用替换为 zhushou/助手/ZHUSHOU
 * 
 * 使用方法: node scripts/batch-rename.mjs
 */

import { readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT_DIR = join(__dirname, "..");

// 需要跳过的目录
const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "dist-runtime",
  ".artifacts",
  ".tmp",
]);

// 需要处理的文件扩展名
const VALID_EXTENSIONS = new Set([
  ".ts", ".js", ".mjs", ".cjs",
  ".json", ".yaml", ".yml",
  ".md", ".mdx",
  ".toml",
  "Dockerfile", "dockerfile",
  ".env", ".env.example",
]);

// 替换规则（按顺序执行）
const REPLACEMENTS = [
  // 环境变量和配置键
  { pattern: /ZHUSHOU_GATEWAY_TOKEN/g, replacement: "ZHUSHOU_GATEWAY_TOKEN" },
  { pattern: /ZHUSHOU_GATEWAY_PASSWORD/g, replacement: "ZHUSHOU_GATEWAY_PASSWORD" },
  { pattern: /ZHUSHOU_STATE_DIR/g, replacement: "ZHUSHOU_STATE_DIR" },
  { pattern: /ZHUSHOU_CONFIG_PATH/g, replacement: "ZHUSHOU_CONFIG_PATH" },
  { pattern: /ZHUSHOU_HOME/g, replacement: "ZHUSHOU_HOME" },
  { pattern: /ZHUSHOU_LOAD_SHELL_ENV/g, replacement: "ZHUSHOU_LOAD_SHELL_ENV" },
  { pattern: /ZHUSHOU_SHELL_ENV_TIMEOUT_MS/g, replacement: "ZHUSHOU_SHELL_ENV_TIMEOUT_MS" },
  { pattern: /ZHUSHOU_LIVE_OPENAI_KEY/g, replacement: "ZHUSHOU_LIVE_OPENAI_KEY" },
  { pattern: /ZHUSHOU_LIVE_ANTHROPIC_KEY/g, replacement: "ZHUSHOU_LIVE_ANTHROPIC_KEY" },
  { pattern: /ZHUSHOU_LIVE_GEMINI_KEY/g, replacement: "ZHUSHOU_LIVE_GEMINI_KEY" },
  { pattern: /ZHUSHOU_TWITCH_ACCESS_TOKEN/g, replacement: "ZHUSHOU_TWITCH_ACCESS_TOKEN" },
  { pattern: /ZHUSHOU_EXTENSIONS/g, replacement: "ZHUSHOU_EXTENSIONS" },
  { pattern: /ZHUSHOU_VARIANT/g, replacement: "ZHUSHOU_VARIANT" },
  { pattern: /ZHUSHOU_BUNDLED_PLUGIN_DIR/g, replacement: "ZHUSHOU_BUNDLED_PLUGIN_DIR" },
  { pattern: /ZHUSHOU_DOCKER_APT_UPGRADE/g, replacement: "ZHUSHOU_DOCKER_APT_UPGRADE" },
  { pattern: /ZHUSHOU_NODE_BOOKWORM_IMAGE/g, replacement: "ZHUSHOU_NODE_BOOKWORM_IMAGE" },
  { pattern: /ZHUSHOU_NODE_BOOKWORM_DIGEST/g, replacement: "ZHUSHOU_NODE_BOOKWORM_DIGEST" },
  { pattern: /ZHUSHOU_NODE_BOOKWORM_SLIM_IMAGE/g, replacement: "ZHUSHOU_NODE_BOOKWORM_SLIM_IMAGE" },
  { pattern: /ZHUSHOU_NODE_BOOKWORM_SLIM_DIGEST/g, replacement: "ZHUSHOU_NODE_BOOKWORM_SLIM_DIGEST" },
  { pattern: /ZHUSHOU_INSTALL_BROWSER/g, replacement: "ZHUSHOU_INSTALL_BROWSER" },
  { pattern: /ZHUSHOU_INSTALL_DOCKER_CLI/g, replacement: "ZHUSHOU_INSTALL_DOCKER_CLI" },
  { pattern: /ZHUSHOU_DOCKER_GPG_FINGERPRINT/g, replacement: "ZHUSHOU_DOCKER_GPG_FINGERPRINT" },
  { pattern: /ZHUSHOU_DOCKER_APT_PACKAGES/g, replacement: "ZHUSHOU_DOCKER_APT_PACKAGES" },
  { pattern: /ZHUSHOU_TZ/g, replacement: "ZHUSHOU_TZ" },
  { pattern: /ZHUSHOU_IMAGE/g, replacement: "ZHUSHOU_IMAGE" },
  { pattern: /ZHUSHOU_CONFIG_DIR/g, replacement: "ZHUSHOU_CONFIG_DIR" },
  { pattern: /ZHUSHOU_WORKSPACE_DIR/g, replacement: "ZHUSHOU_WORKSPACE_DIR" },
  { pattern: /ZHUSHOU_GATEWAY_PORT/g, replacement: "ZHUSHOU_GATEWAY_PORT" },
  { pattern: /ZHUSHOU_BRIDGE_PORT/g, replacement: "ZHUSHOU_BRIDGE_PORT" },
  { pattern: /ZHUSHOU_GATEWAY_BIND/g, replacement: "ZHUSHOU_GATEWAY_BIND" },
  { pattern: /ZHUSHOU_ALLOW_INSECURE_PRIVATE_WS/g, replacement: "ZHUSHOU_ALLOW_INSECURE_PRIVATE_WS" },
  { pattern: /ZHUSHOU_PROFILE/g, replacement: "ZHUSHOU_PROFILE" },
  { pattern: /ZHUSHOU_FORCE_BUILD/g, replacement: "ZHUSHOU_FORCE_BUILD" },
  { pattern: /ZHUSHOU_BUILD_PRIVATE_QA/g, replacement: "ZHUSHOU_BUILD_PRIVATE_QA" },
  { pattern: /ZHUSHOU_ENABLE_PRIVATE_QA_CLI/g, replacement: "ZHUSHOU_ENABLE_PRIVATE_QA_CLI" },
  { pattern: /ZHUSHOU_RUNNER_LOG/g, replacement: "ZHUSHOU_RUNNER_LOG" },
  { pattern: /ZHUSHOU_RUN_NODE_OUTPUT_LOG/g, replacement: "ZHUSHOU_RUN_NODE_OUTPUT_LOG" },
  { pattern: /ZHUSHOU_WATCH_MODE/g, replacement: "ZHUSHOU_WATCH_MODE" },
  { pattern: /ZHUSHOU_SKIP_CHANNELS/g, replacement: "ZHUSHOU_SKIP_CHANNELS" },
  { pattern: /ZHUSHOU_SKIP_DOCKER_BUILD/g, replacement: "ZHUSHOU_SKIP_DOCKER_BUILD" },
  
  // TypeScript 类型和接口
  { pattern: /ZhushouConfig/g, replacement: "ZhushouConfig" },
  { pattern: /ZhushouChannelConfig/g, replacement: "ZhushouChannelConfig" },
  { pattern: /ZhushouPluginApi/g, replacement: "ZhushouPluginApi" },
  { pattern: /ZhushouRuntimeApi/g, replacement: "ZhushouRuntimeApi" },
  
  // 路径和目录引用
  { pattern: /\.zhushou/g, replacement: ".zhushou" },
  { pattern: /zhushou\.json/g, replacement: "zhushou.json" },
  { pattern: /zhushou\.mjs/g, replacement: "zhushou.mjs" },
  
  // GitHub 仓库引用
  { pattern: /github\.com\/zhushou\/zhushou/g, replacement: "github.com/zhushou/zhushou" },
  { pattern: /docs\.zhushou\.ai/g, replacement: "docs.zhushou.ai" },
  
  // 包名引用
  { pattern: /@zhushou\//g, replacement: "@zhushou/" },
  { pattern: /npm install -g zhushou/g, replacement: "npm install -g zhushou" },
  
  // 显示名称（UI相关使用"系统"，其他使用"助手"）
  { pattern: /\bOpenClaw\b(?! Gateway)/g, replacement: "助手" },
  { pattern: /\bopenclaw\b(?! gateway)/gi, replacement: "zhushou" },
];

function shouldProcessFile(filePath) {
  const fileName = filePath.split("/").pop().toLowerCase();
  
  // 检查是否是有效扩展名
  const ext = "." + fileName.split(".").pop();
  if (VALID_EXTENSIONS.has(ext) || fileName === "dockerfile") {
    return true;
  }
  
  return false;
}

function processDirectory(dirPath, stats = { processed: 0, skipped: 0 }) {
  const entries = readdirSync(dirPath, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = join(dirPath, entry.name);
    
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) {
        continue;
      }
      processDirectory(fullPath, stats);
    } else if (entry.isFile()) {
      const relPath = relative(ROOT_DIR, fullPath);
      
      if (!shouldProcessFile(fullPath)) {
        stats.skipped++;
        continue;
      }
      
      try {
        const content = readFileSync(fullPath, "utf8");
        let newContent = content;
        let hasChanges = false;
        
        for (const { pattern, replacement } of REPLACEMENTS) {
          if (pattern.test(newContent)) {
            newContent = newContent.replace(pattern, replacement);
            hasChanges = true;
          }
        }
        
        if (hasChanges) {
          writeFileSync(fullPath, newContent, "utf8");
          console.log(`✓ ${relPath}`);
          stats.processed++;
        }
      } catch (error) {
        console.error(`✗ ${relPath}: ${error.message}`);
      }
    }
  }
  
  return stats;
}

console.log("开始批量重命名...\n");
const stats = processDirectory(ROOT_DIR);
console.log(`\n完成！处理了 ${stats.processed} 个文件，跳过了 ${stats.skipped} 个文件`);
