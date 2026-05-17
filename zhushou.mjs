#!/usr/bin/env node
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distPath = resolve(__dirname, 'dist', 'index.js');
const distUrl = pathToFileURL(distPath).href;

try {
  await import(distUrl);
} catch (err) {
  console.error('[zhushou] 启动失败:', err);
  process.exit(1);
}
