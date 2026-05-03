# 配置向导 API 文档

本文档描述 `src/wizard/` 下各模块的公开 API，供插件开发者和测试代码参考。

---

## `src/wizard/prompts.ts`

### 类型

#### `WizardPrompter`

向导交互接口，由 `createClackPrompter()` 实现，测试代码通过 `createWizardPrompter()` 模拟。

```typescript
type WizardPrompter = {
  intro(title: string): Promise<void>;
  outro(message: string): Promise<void>;
  note(message: string, title?: string): Promise<void>;
  select<T>(params: WizardSelectParams<T>): Promise<T>;
  multiselect<T>(params: WizardMultiSelectParams<T>): Promise<T[]>;
  text(params: WizardTextParams): Promise<string>;
  confirm(params: WizardConfirmParams): Promise<boolean>;
  progress(label: string): WizardProgress;
  showValidationErrors(issues: WizardValidationIssue[], title?: string): Promise<void>;
  showConfigDiff(entries: WizardConfigDiffEntry[], title?: string): Promise<void>;
};
```

#### `WizardValidationIssue`

```typescript
type WizardValidationIssue = {
  /** 问题对应的配置路径，如 "gateway.auth.mode" */
  path: string;
  message: string;
  /** "error" 阻止继续；"conflict" 为互斥对；"warning" 为建议性提示 */
  severity: "error" | "conflict" | "warning";
};
```

#### `WizardConfigDiffEntry`

```typescript
type WizardConfigDiffEntry = {
  path: string;
  before: unknown;
  after: unknown;
};
```

#### `WizardCancelledError`

用户中止向导时抛出的错误。向导入口应捕获此错误并以 exit code 1 退出。

```typescript
class WizardCancelledError extends Error {
  constructor(message?: string);
}
```

---

## `src/wizard/assistant-constants.ts`

所有向导文件应从本模块导入产品名称和相关常量，而非内联硬编码字符串。

```typescript
/** 用户可见的产品显示名称 */
export const PRODUCT_NAME: string;

/** CLI 二进制名称（用于命令行示例） */
export const CLI_COMMAND: string;

/** 文档基础 URL */
export const DOCS_BASE_URL: string;

/** 默认配置文件路径（用于向导消息中展示） */
export const CONFIG_FILE_DEFAULT_PATH: string;

/** 向导输出中引用的环境变量名称映射 */
export const ENV_VARS: {
  GATEWAY_TOKEN: string;
  GATEWAY_PASSWORD: string;
  GATEWAY_PORT: string;
  CONFIG_PATH: string;
};

/** 构建带路径的文档 URL */
export function docsUrl(path: string): string;
```

---

## `src/wizard/validation.ts`

### 类型

#### `ValidationResult`

```typescript
type ValidationResult = {
  /** false 表示存在错误或冲突 */
  valid: boolean;
  errors: ValidationError[];     // 必须修复的问题（旧版字段等）
  conflicts: ConfigConflict[];   // 互斥配置对
  warnings: ValidationError[];   // 建议性提示（不阻断向导）
};
```

#### `ValidationError`

```typescript
type ValidationError = {
  path: string;
  message: string;
  code: string;
};
```

#### `ConfigConflict`

```typescript
type ConfigConflict = {
  paths: string[];
  message: string;
  code: string;
};
```

### 函数

#### `validateWizardConfig(config: OpenClawConfig, opts?: { legacyIssues?: WizardLegacyIssue[] }): ValidationResult`

对配置进行完整校验，检查：
1. **旧版字段**（如 `routing`、`providers`、`bot`、`agent`、`memorySearch`、`heartbeat`、旧频道顶级字段、旧网关认证别名、旧搜索 provider 配置等）→ error
2. **互斥配置对** → conflict
3. **缺失必要配置** → warning
4. **配置读取阶段报告的 `legacyIssues`** → error，用于拒绝已被读取层自动迁移但源文件仍包含旧语法的配置。

```typescript
import { validateWizardConfig } from "./validation.js";

const result = validateWizardConfig(config);
if (!result.valid) {
  // result.errors 包含旧版字段错误
  // result.conflicts 包含互斥配置对
}
```

#### `validationResultToWizardIssues(result: ValidationResult): WizardValidationIssue[]`

将校验结果转换为 `WizardPrompter.showValidationErrors()` 可直接渲染的结构化问题列表。

#### `detectConfigConflicts(config: OpenClawConfig): ConfigConflict[]`

仅检测并返回冲突列表，不检查旧版字段或缺失字段。

#### `hasLegacyFields(config: OpenClawConfig, legacyIssues?: WizardLegacyIssue[]): boolean`

快速检查配置中是否包含任何旧版字段。可传入读取层报告的 `legacyIssues` 作为第二个参数。

#### `formatValidationResult(result: ValidationResult): string`

将 `ValidationResult` 格式化为多行字符串，可直接传给 `prompter.note()`。

---

### 已知冲突规则

| Code | 冲突说明 |
|------|----------|
| `tailscale-non-loopback-bind` | Tailscale serve/funnel 要求 `bind=loopback` |
| `tailscale-funnel-no-password` | Tailscale funnel 要求密码认证 |
| `lan-bind-no-auth` | LAN/auto 绑定但未配置任何认证 |
| `remote-mode-with-local-only-settings` | remote 模式下设置了本地专用字段 |

---

## `src/wizard/templates.ts`

### 类型

#### `WizardTemplate`

```typescript
type WizardTemplate = {
  id: string;
  name: string;
  description: string;
  /** 叠加到基础配置上的部分配置 */
  config: Partial<OpenClawConfig>;
};
```

### 内置模板

| ID | 名称 | 说明 |
|----|------|------|
| `minimal` | 最小化（本地回环） | loopback + token，无 Tailscale |
| `lan` | 局域网共享 | 0.0.0.0 绑定，token 认证 |
| `tailscale-serve` | Tailscale Serve | loopback + tailscale serve |
| `tailscale-funnel` | Tailscale Funnel | loopback + funnel + password |
| `remote-gateway` | 远程网关 | gateway.mode=remote |

### 函数

#### `applyTemplate(base: OpenClawConfig, template: WizardTemplate): OpenClawConfig`

将模板配置深度合并到基础配置上，返回新对象，不修改原始参数。

```typescript
const result = applyTemplate(existingConfig, findTemplate("minimal")!);
```

#### `findTemplate(id: string): WizardTemplate | undefined`

按 ID 查找模板，未找到返回 `undefined`。

#### `templateSelectOptions(): Array<{ value: string; label: string; hint: string }>`

返回可直接传给 `prompter.select()` 的选项列表（包含所有模板加一个"跳过"选项）。

---

## `src/wizard/rollback.ts`

### 类型

#### `ConfigSnapshot`

```typescript
type ConfigSnapshot = {
  timestamp: number;    // Unix 毫秒时间戳
  config: OpenClawConfig;
  label: string;        // 如 "before-setup-wizard"
};
```

#### `RollbackResult`

```typescript
type RollbackResult =
  | { ok: true }
  | { ok: false; reason: string };
```

### 函数

#### `createSnapshot(config: OpenClawConfig, label: string): ConfigSnapshot`

创建配置的深拷贝快照（内存中，不写入磁盘）。

#### `saveConfigSnapshot(snapshot: ConfigSnapshot, snapshotDir?: string): Promise<string>`

将快照写入磁盘，返回文件绝对路径。默认目录：`~/.openclaw/.snapshots/`。

#### `listConfigSnapshots(snapshotDir?: string): Promise<ConfigSnapshot[]>`

从磁盘加载所有快照，按时间戳降序（最新在前）排列。目录不存在时返回空数组。

#### `rollbackToSnapshot(snapshot: ConfigSnapshot, writeConfig: (config: OpenClawConfig) => Promise<void>): Promise<RollbackResult>`

通过调用 `writeConfig` 函数将快照配置写回，返回操作结果。

```typescript
import { writeConfigFile } from "../config/config.js";
const result = await rollbackToSnapshot(snap, writeConfigFile);
if (!result.ok) {
  console.error(result.reason);
}
```

#### `pruneOldSnapshots(maxAgeMs: number, snapshotDir?: string): Promise<number>`

删除早于 `maxAgeMs` 毫秒的快照文件，返回已删除的文件数。

---

### CLI 回滚入口

向导会在覆盖已有配置前保存快照。用户可通过以下命令查看与恢复：

```bash
openclaw config snapshots list
openclaw config snapshots rollback <timestamp>
```

---

## `test/helpers/wizard-prompter.ts`

### `createWizardPrompter(overrides?: Partial<WizardPrompter>): WizardPrompter`

测试用 prompter 工厂，所有方法均为 `vi.fn()` mock。可通过 `overrides` 覆盖任意方法。

```typescript
import { createWizardPrompter } from "../../test/helpers/wizard-prompter.js";

const prompter = createWizardPrompter({
  select: vi.fn(async () => "quickstart"),
  confirm: vi.fn(async () => true),
});
```

---

## 性能目标

| 指标 | 目标 |
|------|------|
| 向导启动到首屏提示 | ≤ 2 秒 |
| 内存占用（Node 进程） | ≤ 60 MB |

向导通过动态导入（`await import(...)`）懒加载重模块来满足上述目标。新增模块应遵循同样模式，避免在模块顶层静态导入大型依赖。
