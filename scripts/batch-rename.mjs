#!/usr/bin/env node

/**
 * 批量重命名脚本 - 将项目中所有 assistant/助手/assistant 引用替换为 assistant/助手/ASSISTANT
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
  { pattern: /ASSISTANT_GATEWAY_TOKEN/g, replacement: "ASSISTANT_GATEWAY_TOKEN" },
  { pattern: /ASSISTANT_GATEWAY_PASSWORD/g, replacement: "ASSISTANT_GATEWAY_PASSWORD" },
  { pattern: /ASSISTANT_STATE_DIR/g, replacement: "ASSISTANT_STATE_DIR" },
  { pattern: /ASSISTANT_CONFIG_PATH/g, replacement: "ASSISTANT_CONFIG_PATH" },
  { pattern: /ASSISTANT_HOME/g, replacement: "ASSISTANT_HOME" },
  { pattern: /ASSISTANT_LOAD_SHELL_ENV/g, replacement: "ASSISTANT_LOAD_SHELL_ENV" },
  { pattern: /ASSISTANT_SHELL_ENV_TIMEOUT_MS/g, replacement: "ASSISTANT_SHELL_ENV_TIMEOUT_MS" },
  { pattern: /ASSISTANT_LIVE_OPENAI_KEY/g, replacement: "ASSISTANT_LIVE_OPENAI_KEY" },
  { pattern: /ASSISTANT_LIVE_ANTHROPIC_KEY/g, replacement: "ASSISTANT_LIVE_ANTHROPIC_KEY" },
  { pattern: /ASSISTANT_LIVE_GEMINI_KEY/g, replacement: "ASSISTANT_LIVE_GEMINI_KEY" },
  { pattern: /ASSISTANT_TWITCH_ACCESS_TOKEN/g, replacement: "ASSISTANT_TWITCH_ACCESS_TOKEN" },
  { pattern: /ASSISTANT_EXTENSIONS/g, replacement: "ASSISTANT_EXTENSIONS" },
  { pattern: /ASSISTANT_VARIANT/g, replacement: "ASSISTANT_VARIANT" },
  { pattern: /ASSISTANT_BUNDLED_PLUGIN_DIR/g, replacement: "ASSISTANT_BUNDLED_PLUGIN_DIR" },
  { pattern: /ASSISTANT_DOCKER_APT_UPGRADE/g, replacement: "ASSISTANT_DOCKER_APT_UPGRADE" },
  { pattern: /ASSISTANT_NODE_BOOKWORM_IMAGE/g, replacement: "ASSISTANT_NODE_BOOKWORM_IMAGE" },
  { pattern: /ASSISTANT_NODE_BOOKWORM_DIGEST/g, replacement: "ASSISTANT_NODE_BOOKWORM_DIGEST" },
  { pattern: /ASSISTANT_NODE_BOOKWORM_SLIM_IMAGE/g, replacement: "ASSISTANT_NODE_BOOKWORM_SLIM_IMAGE" },
  { pattern: /ASSISTANT_NODE_BOOKWORM_SLIM_DIGEST/g, replacement: "ASSISTANT_NODE_BOOKWORM_SLIM_DIGEST" },
  { pattern: /ASSISTANT_INSTALL_BROWSER/g, replacement: "ASSISTANT_INSTALL_BROWSER" },
  { pattern: /ASSISTANT_INSTALL_DOCKER_CLI/g, replacement: "ASSISTANT_INSTALL_DOCKER_CLI" },
  { pattern: /ASSISTANT_DOCKER_GPG_FINGERPRINT/g, replacement: "ASSISTANT_DOCKER_GPG_FINGERPRINT" },
  { pattern: /ASSISTANT_DOCKER_APT_PACKAGES/g, replacement: "ASSISTANT_DOCKER_APT_PACKAGES" },
  { pattern: /ASSISTANT_TZ/g, replacement: "ASSISTANT_TZ" },
  { pattern: /ASSISTANT_IMAGE/g, replacement: "ASSISTANT_IMAGE" },
  { pattern: /ASSISTANT_CONFIG_DIR/g, replacement: "ASSISTANT_CONFIG_DIR" },
  { pattern: /ASSISTANT_WORKSPACE_DIR/g, replacement: "ASSISTANT_WORKSPACE_DIR" },
  { pattern: /ASSISTANT_GATEWAY_PORT/g, replacement: "ASSISTANT_GATEWAY_PORT" },
  { pattern: /ASSISTANT_BRIDGE_PORT/g, replacement: "ASSISTANT_BRIDGE_PORT" },
  { pattern: /ASSISTANT_GATEWAY_BIND/g, replacement: "ASSISTANT_GATEWAY_BIND" },
  { pattern: /ASSISTANT_ALLOW_INSECURE_PRIVATE_WS/g, replacement: "ASSISTANT_ALLOW_INSECURE_PRIVATE_WS" },
  { pattern: /ASSISTANT_PROFILE/g, replacement: "ASSISTANT_PROFILE" },
  { pattern: /ASSISTANT_FORCE_BUILD/g, replacement: "ASSISTANT_FORCE_BUILD" },
  { pattern: /ASSISTANT_BUILD_PRIVATE_QA/g, replacement: "ASSISTANT_BUILD_PRIVATE_QA" },
  { pattern: /ASSISTANT_ENABLE_PRIVATE_QA_CLI/g, replacement: "ASSISTANT_ENABLE_PRIVATE_QA_CLI" },
  { pattern: /ASSISTANT_RUNNER_LOG/g, replacement: "ASSISTANT_RUNNER_LOG" },
  { pattern: /ASSISTANT_RUN_NODE_OUTPUT_LOG/g, replacement: "ASSISTANT_RUN_NODE_OUTPUT_LOG" },
  { pattern: /ASSISTANT_WATCH_MODE/g, replacement: "ASSISTANT_WATCH_MODE" },
  { pattern: /ASSISTANT_SKIP_CHANNELS/g, replacement: "ASSISTANT_SKIP_CHANNELS" },
  { pattern: /ASSISTANT_SKIP_DOCKER_BUILD/g, replacement: "ASSISTANT_SKIP_DOCKER_BUILD" },
  
  // TypeScript 类型和接口
  { pattern: /AssistantConfig/g, replacement: "AssistantConfig" },
  { pattern: /AssistantChannelConfig/g, replacement: "AssistantChannelConfig" },
  { pattern: /AssistantPluginApi/g, replacement: "AssistantPluginApi" },
  { pattern: /AssistantRuntimeApi/g, replacement: "AssistantRuntimeApi" },
  
  // 路径和目录引用
  { pattern: /\.assistant/g, replacement: ".assistant" },
  { pattern: /assistant\.json/g, replacement: "assistant.json" },
  { pattern: /assistant\.mjs/g, replacement: "assistant.mjs" },
  
  // GitHub 仓库引用
  { pattern: /github\.com\/assistant\/assistant/g, replacement: "github.com/assistant/assistant" },
  { pattern: /docs\.assistant\.ai/g, replacement: "docs.assistant.ai" },
  
  // 包名引用
  { pattern: /@assistant\//g, replacement: "@assistant/" },
  { pattern: /npm install -g assistant/g, replacement: "npm install -g assistant" },
  
  // 显示名称（UI相关使用"系统"，其他使用"助手"）
  { pattern: /\bAssistant\b(?! Gateway)/g, replacement: "助手" },
  { pattern: /\bassistant\b(?! gateway)/gi, replacement: "assistant" },
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
