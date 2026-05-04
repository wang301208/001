---

## 🔍 技能自主发现与安装机制

### 核心原则

**技能自主管理**让系统能够：
- ✅ **自主发现** - 自动扫描和识别可用技能
- ✅ **自主评估** - 智能判断技能价值和适用性
- ✅ **自主安装** - 安全地安装和配置新技能
- ✅ **自主调用** - 根据任务需求智能选择技能
- ✅ **MCP 自主调度** - 动态管理和调用 MCP 服务器

---

### 1. 技能自主发现（Skill Discovery）

#### 1.1 发现触发条件

Sentinel 会在以下情况启动技能发现流程：

**条件 A: 能力缺口检测**
```yaml
触发: Executor 遇到无法完成的任务
指标:
  - 任务失败率 > 30%
  - 错误信息提示缺少特定功能
  - 用户明确要求某功能但无对应技能
  
示例:
  任务: "分析 GitHub 仓库的 CI/CD 状态"
  失败原因: "没有 GitHub API 访问技能"
  → 触发发现: 搜索 "GitHub CI/CD monitoring skill"
```

**条件 B: 性能瓶颈识别**
```yaml
触发: 现有技能执行效率低下
指标:
  - 平均执行时间 > 阈值
  - 资源消耗过高
  - 有更优替代方案存在
  
示例:
  当前技能: "HTTP 请求 (axios)" - 500ms
  发现替代: "HTTP 请求 (undici)" - 200ms
  → 触发评估: 是否替换或共存
```

**条件 C: 新功能需求**
```yaml
触发: 战略规划提出新能力需求
指标:
  - Strategist 识别市场机会
  - Founder 规划组织扩展
  - Algorithmist 需要新算法支持
  
示例:
  战略: "支持多模态 AI 交互"
  需求: "图像理解、音频处理技能"
  → 触发发现: 搜索相关技能包
```

#### 1.2 发现源

系统会从多个渠道自主发现技能：

**官方技能库**
```typescript
const officialSkills = await sentinel.discoverFromOfficialRegistry({
  query: "github ci/cd monitoring",
  filters: {
    minRating: 4.0,
    minDownloads: 1000,
    lastUpdated: "6m", // 6个月内更新
    verified: true,
  },
});
```

**社区技能市场**
```typescript
const communitySkills = await sentinel.discoverFromCommunityMarket({
  query: "data visualization",
  sortBy: "popularity",
  limit: 20,
});
```

**MCP 服务器目录**
```typescript
const mcpServers = await sentinel.discoverMcpServers({
  categories: ["github", "filesystem", "database"],
  protocolVersion: "2024-11-05",
});
```

**本地工作区扫描**
```typescript
const localSkills = await sentinel.scanLocalWorkspace({
  workspaceDir: "/path/to/workspace",
  detectPatterns: [
    "skills/**/*.md",
    "extensions/**/package.json",
    ".cursor-plugin/**",
  ],
});
```

**Git 仓库搜索**
```typescript
const gitSkills = await sentinel.searchGitRepositories({
  platforms: ["github", "gitlab", "gitee"],
  topics: ["openclaw-skill", "ai-agent-skill"],
  language: "typescript",
  stars: { min: 10 },
});
```

#### 1.3 发现结果评估

每个发现的技能都会经过多维度评估：

``typescript
interface SkillDiscoveryResult {
  id: string;
  name: string;
  description: string;
  source: "official" | "community" | "mcp" | "local" | "git";
  
  // 质量评分
  qualityScore: {
    rating: number;           // 0-5
    downloads: number;        // 下载次数
    lastUpdated: Date;        // 最后更新
    maintainerActivity: number; // 维护者活跃度 0-1
    documentationQuality: number; // 文档质量 0-1
  };
  
  // 兼容性检查
  compatibility: {
    platformCompatible: boolean;
    dependencyConflicts: string[];
    securityScanPassed: boolean;
    licenseCompatible: boolean;
  };
  
  // 价值评估
  valueAssessment: {
    relevanceToGaps: number;      // 与缺口的关联度 0-1
    performanceImprovement: number; // 预期性能提升 %
    maintenanceCost: number;      // 预估维护成本
    adoptionRisk: number;         // 采用风险 0-1
  };
  
  // 推荐等级
  recommendationLevel: "highly_recommended" | "recommended" | "consider" | "not_recommended";
}
```

---

### 2. 技能自主安装（Skill Installation）

#### 2.1 安装决策流程

```
┌──────────────┐
│ 1. 优先级排序 │ ← 根据价值评分排序
└──────┬───────┘
       │ Top N 候选
       ▼
┌──────────────┐
│ 2. 依赖分析   │ ← 检查依赖冲突
└──────┬───────┘
       │ 依赖图谱
       ▼
┌──────────────┐
│ 3. 安全扫描   │ ← 代码安全检查
└──────┬───────┘
       │ 安全报告
       ▼
┌──────────────┐
│ 4. 沙盒测试   │ ← 隔离环境测试
└──────┬───────┘
       │ 测试结果
       ▼
┌──────────────┐
│ 5. 审批决策   │ ← 自动或人工审批
└──────┬───────┘
       │ 
       ├─→ 高分低风险: 自动安装
       └─→ 中分中风险: 提案等待审批
       ▼
┌──────────────┐
│ 6. 安装执行   │ ← Librarian 执行安装
└──────┬───────┘
       │
       ├─→ 下载技能包
       ├─→ 解析依赖
       ├─→ 安装依赖
       ├─→ 注册技能
       └─→ 更新索引
       ▼
┌──────────────┐
│ 7. 验证测试   │ ← QA 验证安装
└──────┬───────┘
       │ 验证通过
       ▼
┌──────────────┐
│ 8. 激活使用   │ ← 标记为可用
└──────────────┘
```

#### 2.2 安装策略

**策略 A: 自动安装（高置信度）**
```yaml
条件:
  - 质量评分 ≥ 4.5
  - 安全评分 = 通过
  - 依赖冲突 = 无
  - 来源 = 官方或已验证
  
操作:
  - 直接安装到生产环境
  - 后台运行验证测试
  - 发现问题自动回滚
  
风险: 低
```

**策略 B: 沙盒先行（中等置信度）**
```yaml
条件:
  - 质量评分 3.5-4.5
  - 有新依赖需要安装
  - 社区技能但未充分验证
  
操作:
  - 先在沙盒环境安装
  - 运行完整测试套件
  - 观察期 7-14 天
  - 确认稳定后晋升
  
风险: 中
```

**策略 C: 人工审批（低置信度或高风险）**
```yaml
条件:
  - 质量评分 < 3.5
  - 有重大依赖变更
  - 来自未知来源
  - 涉及敏感权限
  
操作:
  - 生成详细评估报告
  - 提交人类审批
  - 批准后在沙盒测试
  - 逐步 rollout
  
风险: 高
```

#### 2.3 安装执行

Librarian 负责执行技能安装：

```typescript
// 1. 准备安装环境
const installContext = await librarian.prepareInstall({
  skillId: "github-cicd-monitor",
  targetEnvironment: "production", // or "sandbox"
  isolationLevel: "full", // full | partial | none
});

// 2. 下载技能包
const skillPackage = await librarian.downloadSkill({
  source: skillInfo.sourceUrl,
  checksum: skillInfo.checksum,
  verifySignature: true,
});

// 3. 解析和安装依赖
const dependencies = await librarian.resolveDependencies({
  skillPackage,
  strategy: "minimal", // minimal | full | isolated
});

await librarian.installDependencies({
  dependencies,
  conflictResolution: "auto", // auto | prompt | skip
});

// 4. 注册技能到资产目录
const registration = await librarian.registerSkill({
  skillPackage,
  metadata: {
    installedAt: new Date(),
    installedBy: "librarian",
    installationMethod: "autonomous",
    sandboxTested: true,
    qaPassed: true,
  },
});

// 5. 更新技能索引
await librarian.rebuildIndex({
  scope: "incremental", // incremental | full
});

// 6. 通知相关代理
await librarian.notifyAgents({
  skillId: skillInfo.id,
  message: `新技能 ${skillInfo.name} 已安装并可用`,
  agents: ["executor", "strategist"],
});
```

#### 2.4 安装后验证

QA 会自动运行验证测试：

```typescript
// 1. 基本功能测试
const basicTests = await qa.runBasicTests({
  skillId: "github-cicd-monitor",
  testCases: [
    "初始化技能",
    "加载配置",
    "执行核心功能",
    "错误处理",
  ],
});

// 2. 集成测试
const integrationTests = await qa.runIntegrationTests({
  skillId: "github-cicd-monitor",
  scenarios: [
    "与其他技能协作",
    "资源竞争处理",
    "并发调用",
  ],
});

// 3. 性能基准测试
const perfTests = await qa.runPerformanceTests({
  skillId: "github-cicd-monitor",
  metrics: [
    "启动时间",
    "内存占用",
    "响应延迟",
    "吞吐量",
  ],
});

// 4. 安全扫描
const securityScan = await qa.runSecurityScan({
  skillId: "github-cicd-monitor",
  checks: [
    "代码注入漏洞",
    "权限过度授予",
    "敏感信息泄露",
    "依赖漏洞",
  ],
});

// 5. 生成验证报告
const verificationReport = await qa.generateReport({
  basicTests,
  integrationTests,
  perfTests,
  securityScan,
});

if (verificationReport.passed) {
  await librarian.activateSkill({ skillId: "github-cicd-monitor" });
} else {
  await librarian.quarantineSkill({
    skillId: "github-cicd-monitor",
    reason: verificationReport.failures,
  });
}
```

---

### 3. 技能自主调用（Skill Invocation）

#### 3.1 智能选择引擎

Executor 会根据任务需求智能选择最合适的技能：

**选择维度**:

```typescript
interface SkillSelectionCriteria {
  // 功能匹配度
  functionalMatch: {
    capabilityCoverage: number;    // 功能覆盖度 0-1
    apiCompatibility: number;      // API 兼容性 0-1
    outputFormat: boolean;         // 输出格式匹配
  };
  
  // 性能指标
  performance: {
    avgResponseTime: number;       // 平均响应时间 ms
    successRate: number;           // 成功率 0-1
    resourceEfficiency: number;    // 资源效率 0-1
  };
  
  // 可靠性
  reliability: {
    uptime: number;                // 可用性 0-1
    errorRecovery: number;         // 错误恢复能力 0-1
    consistency: number;           // 一致性 0-1
  };
  
  // 成本
  cost: {
    tokenUsage: number;            // Token 消耗
    computationCost: number;       // 计算成本
    maintenanceCost: number;       // 维护成本
  };
  
  // 上下文适配
  contextFit: {
    currentWorkflow: number;       // 当前工作流适配度
    teamPreference: number;        // 团队偏好
    historicalSuccess: number;     // 历史成功率
  };
}
```

**选择算法**:

```typescript
async function selectOptimalSkill(
  task: TaskDescription,
  availableSkills: SkillInfo[],
): Promise<SkillSelection> {
  // 1. 过滤不兼容的技能
  const compatibleSkills = availableSkills.filter(skill => 
    isCompatible(task, skill)
  );
  
  // 2. 计算每个技能的综合评分
  const scoredSkills = await Promise.all(
    compatibleSkills.map(async skill => {
      const criteria = await evaluateSkill(task, skill);
      const score = calculateWeightedScore(criteria, {
        functionalMatch: 0.30,
        performance: 0.25,
        reliability: 0.20,
        cost: 0.15,
        contextFit: 0.10,
      });
      
      return { skill, score, criteria };
    })
  );
  
  // 3. 排序并选择最优
  scoredSkills.sort((a, b) => b.score - a.score);
  
  // 4. 返回前 3 个候选（用于降级策略）
  return {
    primary: scoredSkills[0],
    fallbacks: scoredSkills.slice(1, 3),
  };
}
```

#### 3.2 调用执行

Executor 会智能执行技能调用：

```typescript
// 1. 准备调用上下文
const callContext = await executor.prepareCallContext({
  skill: selectedSkill,
  task: currentTask,
  environment: runtimeEnv,
});

// 2. 参数映射和验证
const validatedParams = await executor.validateAndMapParams({
  skillSchema: selectedSkill.inputSchema,
  taskParams: currentTask.parameters,
  defaults: selectedSkill.defaultParams,
});

// 3. 执行技能调用
const result = await executor.invokeSkill({
  skillId: selectedSkill.id,
  params: validatedParams,
  timeout: selectedSkill.timeout || 30000,
  retryPolicy: {
    maxRetries: 3,
    backoff: "exponential",
  },
});

// 4. 结果处理和转换
const processedResult = await executor.processResult({
  rawResult: result,
  outputSchema: selectedSkill.outputSchema,
  transformationRules: selectedSkill.outputTransformations,
});

// 5. 记录和监控
await executor.recordInvocation({
  skillId: selectedSkill.id,
  taskId: currentTask.id,
  duration: result.duration,
  success: result.success,
  metrics: result.metrics,
});

// 6. 学习和优化
await executor.learnFromInvocation({
  skillId: selectedSkill.id,
  outcome: result.success ? "success" : "failure",
  performance: result.metrics,
  feedback: currentTask.userFeedback,
});
```

#### 3.3 降级和容错

当主要技能失败时，系统会自动降级：

``typescript
// 降级策略
if (!primaryResult.success) {
  // 尝试第一个备选技能
  if (selection.fallbacks[0]) {
    log.warn(`主技能失败，尝试备选: ${selection.fallbacks[0].skill.name}`);
    const fallbackResult = await executor.invokeSkill({
      skillId: selection.fallbacks[0].skill.id,
      params: validatedParams,
    });
    
    if (fallbackResult.success) {
      // 记录主技能问题
      await librarian.reportSkillIssue({
        skillId: selectedSkill.id,
        issue: "performance_degradation",
        severity: "warning",
      });
      
      return fallbackResult;
    }
  }
  
  // 所有技能都失败，上报错误
  throw new SkillInvocationError(
    `所有候选技能均失败: ${selectedSkill.name}`,
    { cause: primaryResult.error }
  );
}
```

---

### 4. MCP 自主调度（MCP Autonomous Orchestration）

#### 4.1 MCP 服务器发现

系统会自主发现和注册 MCP 服务器：

**发现源**:

```typescript
// 1. 本地配置文件扫描
const localMcpServers = await sentinel.scanLocalMcpConfigs({
  configPaths: [
    ".mcp.json",
    ".cursor/mcp.json",
    "claude_desktop_config.json",
  ],
});

// 2. MCP 服务器目录查询
const directoryServers = await sentinel.queryMcpDirectory({
  url: "https://mcp.directory/api/servers",
  filters: {
    categories: ["development", "productivity"],
    minRating: 4.0,
  },
});

// 3. Git 仓库搜索
const gitMcpServers = await sentinel.searchMcpOnGit({
  platforms: ["github", "gitlab"],
  keywords: ["mcp-server", "model-context-protocol"],
  language: "typescript",
});

// 4. 运行时动态发现
const runtimeDiscovered = await sentinel.detectRuntimeMcpServers({
  scanPorts: [3000, 8080, 9000],
  detectProtocol: true,
});
```

#### 4.2 MCP 服务器管理

Librarian 负责 MCP 服务器的生命周期管理：

**注册流程**:

``typescript
// 1. 验证 MCP 服务器
const validation = await librarian.validateMcpServer({
  serverConfig: discoveredServer,
  checks: [
    "protocol_compliance",
    "tool_schema_validity",
    "resource_accessibility",
    "prompt_template_format",
  ],
});

if (!validation.valid) {
  await librarian.rejectMcpServer({
    serverId: discoveredServer.id,
    reasons: validation.errors,
  });
  return;
}

// 2. 安全审查
const securityReview = await librarian.reviewMcpSecurity({
  serverConfig: discoveredServer,
  reviewItems: [
    "permission_scope",
    "data_access_pattern",
    "network_security",
    "authentication_method",
  ],
});

// 3. 注册到 MCP 管理器
const registration = await librarian.registerMcpServer({
  serverConfig: discoveredServer,
  securityReview,
  metadata: {
    registeredAt: new Date(),
    registeredBy: "librarian",
    autoDiscovered: true,
  },
});

// 4. 建立连接
const connection = await librarian.connectMcpServer({
  serverId: discoveredServer.id,
  transportType: discoveredServer.transport, // stdio | sse | http
  timeout: 5000,
});

// 5. 索引工具和资源
const tools = await connection.listTools();
const resources = await connection.listResources();
const prompts = await connection.listPrompts();

await librarian.indexMcpCapabilities({
  serverId: discoveredServer.id,
  tools,
  resources,
  prompts,
});

// 6. 健康检查
await librarian.startHealthMonitoring({
  serverId: discoveredServer.id,
  interval: "60s",
  checks: ["connectivity", "response_time", "error_rate"],
});
```

#### 4.3 MCP 工具智能调用

Executor 会像调用普通技能一样智能调用 MCP 工具：

``typescript
// 1. 根据任务需求选择 MCP 工具
const mcpToolSelection = await executor.selectMcpTool({
  task: currentTask,
  availableMcpTools: allRegisteredMcpTools,
  criteria: {
    functionality: 0.35,
    performance: 0.25,
    reliability: 0.20,
    cost: 0.10,
    contextFit: 0.10,
  },
});

// 2. 准备 MCP 调用
const mcpCall = await executor.prepareMcpCall({
  serverId: mcpToolSelection.serverId,
  toolName: mcpToolSelection.toolName,
  params: currentTask.parameters,
});

// 3. 执行 MCP 调用
const mcpResult = await executor.invokeMcpTool({
  serverId: mcpToolSelection.serverId,
  toolName: mcpToolSelection.toolName,
  arguments: mcpCall.arguments,
  timeout: mcpToolSelection.timeout,
});

// 4. 处理结果
const processedResult = await executor.processMcpResult({
  rawResult: mcpResult,
  toolSchema: mcpToolSelection.outputSchema,
});

// 5. 缓存结果（如果适用）
if (mcpToolSelection.cacheable) {
  await executor.cacheMcpResult({
    cacheKey: generateCacheKey(mcpCall),
    result: processedResult,
    ttl: mcpToolSelection.cacheTtl,
  });
}
```

#### 4.4 MCP 服务器健康监控

系统会持续监控 MCP 服务器健康：

``typescript
// 健康检查循环
setInterval(async () => {
  const servers = await librarian.getAllMcpServers();
  
  for (const server of servers) {
    const health = await librarian.checkMcpHealth({
      serverId: server.id,
      checks: {
        connectivity: async () => {
          try {
            await server.connection.ping();
            return { status: "healthy", latency: pingLatency };
          } catch (error) {
            return { status: "unhealthy", error: error.message };
          }
        },
        
        responseTime: async () => {
          const start = Date.now();
          await server.connection.listTools();
          const duration = Date.now() - start;
          return { status: duration < 1000 ? "good" : "slow", duration };
        },
        
        errorRate: async () => {
          const stats = await librarian.getMcpStats({
            serverId: server.id,
            window: "1h",
          });
          const rate = stats.errors / stats.totalCalls;
          return { 
            status: rate < 0.05 ? "good" : rate < 0.1 ? "warning" : "critical",
            rate,
          };
        },
      },
    });
    
    // 更新健康状态
    await librarian.updateMcpHealthStatus({
      serverId: server.id,
      health,
    });
    
    // 如果健康恶化，采取行动
    if (health.overall === "critical") {
      await librarian.handleMcpDegradation({
        serverId: server.id,
        action: "quarantine", // quarantine | restart | notify
      });
    }
  }
}, 60000); // 每分钟检查
```

#### 4.5 MCP 故障恢复

当 MCP 服务器出现故障时，系统会自动恢复：

``typescript
// 故障恢复策略
async function handleMcpFailure(serverId: string, error: Error) {
  const server = await librarian.getMcpServer(serverId);
  
  // 1. 记录故障
  await librarian.recordMcpFailure({
    serverId,
    error,
    timestamp: new Date(),
  });
  
  // 2. 尝试重启
  if (server.restartable) {
    log.info(`尝试重启 MCP 服务器: ${server.name}`);
    const restartResult = await librarian.restartMcpServer({
      serverId,
      graceful: true,
      timeout: 10000,
    });
    
    if (restartResult.success) {
      log.info(`MCP 服务器重启成功: ${server.name}`);
      return;
    }
  }
  
  // 3. 切换到备用服务器
  const backupServers = await librarian.findBackupMcpServers({
    originalServerId: serverId,
    capability: server.capabilities,
  });
  
  if (backupServers.length > 0) {
    log.warn(`主服务器失败，切换到备用: ${backupServers[0].name}`);
    await librarian.switchToBackupMcp({
      originalServerId: serverId,
      backupServerId: backupServers[0].id,
    });
    return;
  }
  
  // 4. 降级到非 MCP 方案
  log.error(`MCP 服务器不可用，使用降级方案: ${server.name}`);
  await executor.useFallbackStrategy({
    originalMcpTool: server.primaryTool,
    fallbackMethod: "local_execution",
  });
  
  // 5. 通知管理员
  await librarian.notifyAdmin({
    severity: "high",
    message: `MCP 服务器故障: ${server.name}`,
    details: error.message,
    actionsTaken: ["restart_attempted", "backup_checked", "fallback_activated"],
  });
}
```

---

### 5. 自主管理配置

#### 5.1 发现配置

```
# .zhushou/config.yaml
autonomy:
  skill_discovery:
    enabled: true
    sources:
      official_registry:
        enabled: true
        url: "https://skills.openclaw.dev/api"
        refresh_interval: "24h"
      
      community_market:
        enabled: true
        url: "https://mcp.community/api"
        min_rating: 3.5
        refresh_interval: "12h"
      
      mcp_directory:
        enabled: true
        url: "https://mcp.directory/api"
        categories: ["all"]
        refresh_interval: "24h"
      
      local_scan:
        enabled: true
        paths:
          - "./skills"
          - "./extensions"
          - "./.cursor-plugin"
        scan_interval: "6h"
      
      git_search:
        enabled: false
        platforms: ["github"]
        topics: ["openclaw-skill"]
        search_interval: "7d"
    
    evaluation:
      min_quality_score: 3.0
      require_security_scan: true
      require_license_check: true
      auto_approve_threshold: 4.5
```

#### 5.2 安装配置

```
autonomy:
  skill_installation:
    enabled: true
    
    strategies:
      automatic:
        enabled: true
        conditions:
          min_quality_score: 4.5
          source_whitelist: ["official", "verified_community"]
          max_dependencies: 5
          require_sandbox_test: false
      
      sandbox_first:
        enabled: true
        conditions:
          min_quality_score: 3.5
          observation_period: "7d"
          promotion_threshold: 4.0
      
      manual_approval:
        enabled: true
        conditions:
          below_quality_score: 3.5
          from_untrusted_source: true
          requires_sensitive_permissions: true
    
    sandbox:
      enabled: true
      isolation_level: "full"
      resource_limits:
        memory: "512MB"
        cpu: "50%"
        network: "restricted"
      retention_days: 30
    
    verification:
      run_basic_tests: true
      run_integration_tests: true
      run_performance_tests: true
      run_security_scan: true
      min_pass_rate: 0.95
```

#### 5.3 调用配置

```
autonomy:
  skill_invocation:
    selection_algorithm: "weighted_scoring"
    
    weights:
      functional_match: 0.30
      performance: 0.25
      reliability: 0.20
      cost: 0.15
      context_fit: 0.10
    
    fallback:
      enabled: true
      max_fallback_attempts: 2
      fallback_timeout: "50%" # 相对于主超时时间
    
    caching:
      enabled: true
      default_ttl: "1h"
      max_cache_size: "1GB"
      cache_strategy: "lru"
    
    monitoring:
      track_success_rate: true
      track_performance: true
      track_cost: true
      alert_on_degradation: true
      degradation_threshold: 0.8 # 成功率低于 80%
```

#### 5.4 MCP 配置

```
autonomy:
  mcp_orchestration:
    enabled: true
    
    discovery:
      local_config_scan: true
      directory_query: true
      git_search: false
      runtime_detection: true
    
    management:
      auto_register: true
      auto_connect: true
      health_monitoring: true
      health_check_interval: "60s"
    
    invocation:
      smart_selection: true
      result_caching: true
      default_timeout: "30s"
      retry_policy:
        max_retries: 2
        backoff: "exponential"
    
    fault_tolerance:
      auto_restart: true
      backup_servers: true
      fallback_strategies: true
      admin_notification: true
```

---

### 6. 实施示例

#### 6.1 自主发现和安装技能

```
// Sentinel 检测到能力缺口
const gapDetected = await sentinel.detectCapabilityGap({
  task: "analyze github repository ci/cd status",
  missingCapability: "github_api_access",
});

// 触发技能发现
const discoveredSkills = await sentinel.discoverSkills({
  query: "github ci/cd monitoring",
  sources: ["official", "community"],
  filters: {
    minRating: 4.0,
    verified: true,
  },
});

// Archaeologist 分析最佳候选
const analysis = await archaeologist.analyzeSkillCandidates({
  candidates: discoveredSkills,
  criteria: {
    functionality: 0.35,
    performance: 0.25,
    reliability: 0.20,
    cost: 0.10,
    ease_of_use: 0.10,
  },
});

// TDD Developer 在沙盒中测试
const sandboxTest = await tddDeveloper.testInSandbox({
  skill: analysis.topCandidate,
  testScenarios: [
    "basic_initialization",
    "api_authentication",
    "ci_status_fetch",
    "error_handling",
  ],
});

// QA 验证
const qaResult = await qa.validateSkill({
  skill: analysis.topCandidate,
  tests: {
    functional: true,
    integration: true,
    performance: true,
    security: true,
  },
});

// Librarian 执行安装
if (qaResult.passed) {
  await librarian.installSkill({
    skill: analysis.topCandidate,
    environment: "production",
    register: true,
    index: true,
    notify: true,
  });
  
  log.info(`技能安装成功: ${analysis.topCandidate.name}`);
} else {
  await librarian.quarantineSkill({
    skill: analysis.topCandidate,
    reason: qaResult.failures,
  });
  
  log.warn(`技能验证失败，已隔离: ${analysis.topCandidate.name}`);
}
```

#### 6.2 自主调用技能

```
// Executor 接收任务
const task = {
  id: "task-123",
  description: "检查 openclaw/openclaw 仓库的 CI 状态",
  parameters: {
    repo: "openclaw/openclaw",
    branch: "main",
  },
};

// 智能选择技能
const skillSelection = await executor.selectSkill({
  task,
  availableSkills: await librarian.getAvailableSkills({
    category: "github",
  }),
});

log.info(`选择技能: ${skillSelection.primary.skill.name} (评分: ${skillSelection.primary.score})`);

// 执行技能调用
const result = await executor.invokeSkill({
  skillId: skillSelection.primary.skill.id,
  params: task.parameters,
  timeout: 30000,
  retryPolicy: {
    maxRetries: 2,
    backoff: "exponential",
  },
});

if (result.success) {
  log.info(`任务完成: CI 状态 = ${result.data.status}`);
  
  // 记录成功经验
  await executor.recordSuccess({
    skillId: skillSelection.primary.skill.id,
    taskId: task.id,
    performance: result.metrics,
  });
} else {
  log.warn(`主技能失败，尝试备选...`);
  
  // 尝试备选技能
  if (skillSelection.fallbacks.length > 0) {
    const fallbackResult = await executor.invokeSkill({
      skillId: skillSelection.fallbacks[0].skill.id,
      params: task.parameters,
    });
    
    if (fallbackResult.success) {
      log.info(`备选技能成功`);
      
      // 报告主技能问题
      await librarian.reportSkillIssue({
        skillId: skillSelection.primary.skill.id,
        issue: "execution_failure",
        severity: "warning",
      });
    }
  }
}
```

#### 6.3 自主调度 MCP

```
// Sentinel 发现新的 MCP 服务器
const discoveredMcp = await sentinel.discoverMcpServer({
  source: "local_config",
  configPath: ".mcp.json",
});

// Librarian 验证和注册
const validation = await librarian.validateMcpServer(discoveredMcp);

if (validation.valid) {
  // 注册服务器
  await librarian.registerMcpServer({
    serverConfig: discoveredMcp,
    autoConnect: true,
  });
  
  // 建立连接
  const connection = await librarian.connectMcpServer({
    serverId: discoveredMcp.id,
  });
  
  // 索引能力
  const tools = await connection.listTools();
  await librarian.indexMcpTools({
    serverId: discoveredMcp.id,
    tools,
  });
  
  log.info(`MCP 服务器已注册: ${discoveredMcp.name} (${tools.length} 个工具)`);
  
  // 启动健康监控
  await librarian.startHealthMonitoring({
    serverId: discoveredMcp.id,
    interval: "60s",
  });
}

// Executor 使用 MCP 工具
const mcpTool = await executor.selectMcpTool({
  task: {
    description: "读取文件内容",
    parameters: { path: "/path/to/file.txt" },
  },
  availableTools: await librarian.getMcpTools({
    category: "filesystem",
  }),
});

const mcpResult = await executor.invokeMcpTool({
  serverId: mcpTool.serverId,
  toolName: mcpTool.toolName,
  arguments: { path: "/path/to/file.txt" },
});

log.info(`MCP 工具执行成功: ${mcpResult.content}`);
```

---

### 7. 监控与告警

#### 7.1 技能发现监控

```
interface SkillDiscoveryMetrics {
  totalDiscovered: number;
  approvedForInstallation: number;
  installedSuccessfully: number;
  failedVerification: number;
  quarantined: number;
  avgDiscoveryTime: number;
  topSources: Array<{ source: string; count: number }>;
}
```

#### 7.2 技能调用监控

```
interface SkillInvocationMetrics {
  totalInvocations: number;
  successRate: number;
  avgResponseTime: number;
  errorRate: number;
  fallbackUsageRate: number;
  topSkills: Array<{ skillId: string; usage: number; successRate: number }>;
  degradedSkills: Array<{ skillId: string; degradationReason: string }>;
}
```

#### 7.3 MCP 监控

```
interface McpOrchestrationMetrics {
  totalServers: number;
  healthyServers: number;
  unhealthyServers: number;
  totalTools: number;
  activeConnections: number;
  avgResponseTime: number;
  errorRate: number;
  restartedCount: number;
  switchedToBackup: number;
}
```

#### 7.4 告警规则

**高优先级**:
- ⚠️ 关键技能连续失败 > 5 次
- ⚠️ MCP 服务器完全不可用
- ⚠️ 技能安装后导致系统不稳定
- ⚠️ 检测到恶意技能

**中优先级**:
- 📊 技能成功率下降到 80% 以下
- 📊 MCP 响应时间超过阈值
- 📊 技能发现数量为 0（可能配置问题）

**低优先级**:
- ℹ️ 新技能可用但未安装
- ℹ️ MCP 服务器性能轻微下降
- ℹ️ 技能使用模式变化

---

### 8. 最佳实践

#### 8.1 技能发现最佳实践

**Do's**:
- ✅ 定期刷新发现源以获取最新技能
- ✅ 设置合理的质量阈值避免低质技能
- ✅ 优先选择官方和已验证来源
- ✅ 全面评估技能的安全性和兼容性
- ✅ 在沙盒中充分测试后再安装

**Don'ts**:
- ❌ 不要盲目安装未经验证的技能
- ❌ 不要忽略安全扫描结果
- ❌ 不要安装过多相似功能的技能
- ❌ 不要忘记更新技能索引
- ❌ 不要在高峰期批量安装技能

#### 8.2 技能调用最佳实践

**Do's**:
- ✅ 基于多维度评分智能选择技能
- ✅ 始终准备备选方案
- ✅ 监控技能性能并及时调整
- ✅ 缓存频繁使用的结果
- ✅ 记录每次调用用于学习优化

**Don'ts**:
- ❌ 不要硬编码技能选择
- ❌ 不要忽略超时和重试
- ❌ 不要假设技能永远可靠
- ❌ 不要忘记清理缓存
- ❌ 不要过度依赖单一技能

#### 8.3 MCP 调度最佳实践

**Do's**:
- ✅ 持续监控 MCP 服务器健康
- ✅ 配置备用服务器提高可用性
- ✅ 实现优雅的故障恢复
- ✅ 缓存 MCP 调用结果
- ✅ 限制并发调用数量

**Don'ts**:
- ❌ 不要假设 MCP 服务器永远在线
- ❌ 不要忽略连接超时
- ❌ 不要发送过大的请求
- ❌ 不要忘记关闭空闲连接
- ❌ 不要暴露敏感的 MCP 配置

---

### 9. 相关文档

- [Sentinel 代理蓝图](file://g:\项目\-\governance\charter\agents\sentinel.yaml)
- [Librarian 代理蓝图](file://g:\项目\-\governance\charter\agents\librarian.yaml)
- [Genesis Team 工作流](file://g:\项目\-\governance\charter\evolution\genesis-team.yaml)
- [能力资产注册表](file://g:\项目\-\governance\charter\capability\asset-registry.yaml)
- [MCP 协议规范](https://modelcontextprotocol.io/)

---

**技能自主发现、安装、调用及 MCP 自主调度是能力层自主的核心**，它让系统能够持续扩展自己的能力边界，智能选择和使用最合适的工具，同时保持安全可控。
```

```
---

## 🎨 技能自主创建机制

### 核心原则

**技能自主创建**是能力进化的最高级形式，让系统能够：
- ✅ **自主设计** - 从需求分析到架构设计全流程自主
- ✅ **自主实现** - 编写代码、测试、文档一体化
- ✅ **自主验证** - 多维度质量保障和安全性检查
- ✅ **自主发布** - 注册、索引、推广全流程自动化
- ✅ **持续进化** - 基于反馈不断优化和改进

---

### 1. 创建触发条件

Genesis Team 会在以下情况启动技能创建流程：

#### **条件 A: 全新能力缺口**

```
触发: Sentinel 检测到系统中完全不存在的功能
指标:
  - 任务失败原因: "无可用技能"
  - 用户明确要求新功能
  - 战略规划提出新方向
  
示例:
  任务: "生成数据可视化图表"
  现状: 无任何图表生成技能
  → 触发创建: "Data Visualization Skill"
```

#### **条件 B: 性能突破需求**

```
触发: 现有方案无法满足性能要求
指标:
  - 当前最佳方案性能 < 目标值 50%
  - 需要算法层面的创新
  - 需要新的技术栈支持
  
示例:
  需求: "实时处理 10万条/秒 数据流"
  现状: 现有技能最高 1万条/秒
  → 触发创建: "High-Performance Stream Processor"
```

#### **条件 C: 战略机会窗口**

```
触发: Strategist 识别市场或技术机会
指标:
  - 新技术成熟度达到采用阈值
  - 市场需求快速增长
  - 竞争优势明显
  
示例:
  战略: "利用最新的多模态模型"
  机会: "GPT-4o 发布，支持图像理解"
  → 触发创建: "Multimodal Analysis Skill"
```

#### **条件 D: 组织能力提升**

```
触发: Founder 规划组织能力扩展
指标:
  - 需要新的协作模式
  - 需要新的管理工具
  - 需要新的监控能力
  
示例:
  规划: "建立自动化运维体系"
  需求: "健康检查、告警、自愈"
  → 触发创建: "Auto-Ops Management Skill"
```

---

### 2. 创建流程（12个阶段）

```
┌──────────────────┐
│ 1. 需求分析       │ ← Archaeologist 深度分析
└──────┬───────────┘
       │ 需求规格说明书
       ▼
┌──────────────────┐
│ 2. 技术方案设计   │ ← TDD Developer 设计架构
└──────┬───────────┘
       │ 技术方案 + API 设计
       ▼
┌──────────────────┐
│ 3. 原型验证       │ ← 快速原型验证可行性
└──────┬───────────┘
       │ 原型 + 验证报告
       ▼
┌──────────────────┐
│ 4. 详细设计       │ ← 完整的系统设计
└──────┬───────────┘
       │ 详细设计文档
       ▼
┌──────────────────┐
│ 5. 沙盒实现       │ ← 在隔离环境中实现
└──────┬───────────┘
       │ 候选技能包
       ▼
┌──────────────────┐
│ 6. 单元测试       │ ← TDD 驱动开发
└──────┬───────────┘
       │ 测试覆盖率报告
       ▼
┌──────────────────┐
│ 7. 集成测试       │ ← 与其他技能协作测试
└──────┬───────────┘
       │ 集成测试报告
       ▼
┌──────────────────┐
│ 8. 性能测试       │ ← 基准测试和压力测试
└──────┬───────────┘
       │ 性能报告
       ▼
┌──────────────────┐
│ 9. 安全审计       │ ← 全面安全检查
└──────┬───────────┘
       │ 安全审计报告
       ▼
┌──────────────────┐
│ 10. QA 验证       │ ← 质量保障团队验收
└──────┬───────────┘
       │ QA 报告
       ▼
┌──────────────────┐
│ 11. 文档生成      │ ← 自动生成完整文档
└──────┬───────────┘
       │ 用户文档 + API 文档
       ▼
┌──────────────────┐
│ 12. 发布与推广    │ ← Publisher + Librarian
└──────────────────┘
```

---

### 3. 各阶段详细说明

#### **阶段 1: 需求分析**

Archaeologist 负责深度需求分析：

```typescript
interface RequirementAnalysis {
  // 问题定义
  problemStatement: {
    description: string;           // 问题描述
    impact: string[];              // 影响范围
    urgency: "critical" | "high" | "medium" | "low";
    stakeholders: string[];        // 利益相关者
  };
  
  // 需求规格
  requirements: {
    functional: Array<{
      id: string;
      description: string;
      priority: "must" | "should" | "could" | "won't";
      acceptanceCriteria: string[];
    }>;
    
    nonFunctional: {
      performance?: PerformanceRequirements;
      security?: SecurityRequirements;
      usability?: UsabilityRequirements;
      reliability?: ReliabilityRequirements;
    };
  };
  
  // 约束条件
  constraints: {
    technical: string[];           // 技术约束
    business: string[];            // 业务约束
    regulatory: string[];          // 法规约束
  };
  
  // 成功标准
  successMetrics: Array<{
    metric: string;
    target: number;
    measurement: string;
  }>;
}

// 执行需求分析
const analysis = await archaeologist.analyzeRequirements({
  triggerSignal: gapSignal,
  context: {
    taskHistory: recentFailures,
    userFeedback: collectedFeedback,
    strategicGoals: currentStrategy,
  },
});

// 生成需求规格说明书
const spec = await archaeologist.generateSpec({
  analysis,
  format: "structured",
  includeExamples: true,
});
```

#### **阶段 2: 技术方案设计**

TDD Developer 设计技术架构：

```
interface TechnicalDesign {
  // 架构设计
  architecture: {
    pattern: "microservice" | "library" | "plugin" | "agent";
    layers: string[];
    components: Array<{
      name: string;
      responsibility: string;
      interfaces: string[];
      dependencies: string[];
    }>;
  };
  
  // API 设计
  apiDesign: {
    inputSchema: JsonSchema;
    outputSchema: JsonSchema;
    errorHandling: ErrorHandlingStrategy;
    versioning: VersioningStrategy;
  };
  
  // 技术选型
  technologyStack: {
    language: string;
    framework?: string;
    libraries: Array<{
      name: string;
      version: string;
      purpose: string;
    }>;
    runtime: RuntimeRequirements;
  };
  
  // 数据设计
  dataDesign?: {
    storage: StorageStrategy;
    schema?: DataSchema;
    caching?: CacheStrategy;
  };
  
  // 部署设计
  deploymentDesign: {
    resourceRequirements: ResourceRequirements;
    scalingStrategy?: ScalingStrategy;
    monitoringPoints: string[];
  };
}

// 执行技术设计
const design = await tddDeveloper.designTechnicalSolution({
  requirements: spec.requirements,
  constraints: spec.constraints,
  existingSkills: await librarian.getAvailableSkills(),
  designPrinciples: [
    "separation_of_concerns",
    "single_responsibility",
    "open_closed_principle",
    "dependency_inversion",
  ],
});

// 生成设计文档
const designDoc = await tddDeveloper.generateDesignDocument({
  design,
  includeDiagrams: true,
  includeAlternativesConsidered: true,
});
```

#### **阶段 3: 原型验证**

快速验证技术可行性：

```
// 1. 创建最小可行原型
const prototype = await tddDeveloper.createPrototype({
  design: design.architecture,
  scope: "minimal",
  timeBudget: "2h",
});

// 2. 验证核心假设
const validation = await tddDeveloper.validateAssumptions({
  prototype,
  assumptions: design.riskAssumptions,
  testCases: criticalPathTests,
});

// 3. 评估可行性
const feasibility = await tddDeveloper.assessFeasibility({
  validationResults: validation,
  criteria: {
    technicalFeasibility: validation.successRate > 0.8,
    performanceViability: validation.meetsPerformanceTargets,
    complexityAcceptable: validation.complexityScore < 7,
  },
});

if (!feasibility.viable) {
  // 返回重新设计
  await archaeologist.reviseRequirements({
    feedback: feasibility.blockers,
    alternativeApproaches: feasibility.alternatives,
  });
  return; // 重新开始流程
}
```

#### **阶段 4: 详细设计**

完善系统设计细节：

```
const detailedDesign = await tddDeveloper.createDetailedDesign({
  baseDesign: design,
  prototypeFeedback: validation,
  details: {
    // 接口契约
    interfaceContracts: generateInterfaceContracts(design.apiDesign),
    
    // 错误处理策略
    errorHandling: designErrorHandlingStrategy({
      errorTypes: identifyErrorTypes(design),
      recoveryStrategies: defineRecoveryStrategies(),
    }),
    
    // 日志和监控
    observability: designObservability({
      logLevels: defineLogLevels(),
      metrics: defineMetrics(),
      tracing: enableDistributedTracing(),
    }),
    
    // 配置管理
    configuration: designConfiguration({
      requiredConfigs: identifyConfigNeeds(),
      defaults: setSensibleDefaults(),
      validation: defineConfigValidation(),
    }),
  },
});
```

#### **阶段 5: 沙盒实现**

在隔离环境中实现技能：

```
// 1. 创建沙盒环境
const sandbox = await sandbox.createEnvironment({
  isolationLevel: "full",
  resources: {
    memory: "1GB",
    cpu: "100%",
    network: "restricted",
    filesystem: "temporary",
  },
  duration: "24h",
});

// 2. 实现技能代码
const implementation = await tddDeveloper.implementSkill({
  design: detailedDesign,
  sandbox,
  developmentApproach: "test_driven",
  iterations: {
    maxIterations: 10,
    testFirst: true,
    refactoringAllowed: true,
  },
});

// 3. 代码质量保证
const codeQuality = await tddDeveloper.ensureCodeQuality({
  code: implementation.code,
  checks: {
    linting: true,
    formatting: true,
    typeChecking: true,
    complexityAnalysis: true,
    duplicateDetection: true,
  },
  thresholds: {
    maxComplexity: 10,
    maxDuplicateLines: 5,
    minTestCoverage: 0.9,
  },
});
```

#### **阶段 6-9: 测试阶段**

全面的测试验证：

```
// 6. 单元测试
const unitTests = await qa.runUnitTests({
  skill: implementation,
  coverage: {
    statements: 0.95,
    branches: 0.90,
    functions: 0.95,
    lines: 0.95,
  },
});

// 7. 集成测试
const integrationTests = await qa.runIntegrationTests({
  skill: implementation,
  scenarios: [
    "与其他技能协作",
    "资源竞争处理",
    "并发调用",
    "错误传播",
  ],
});

// 8. 性能测试
const performanceTests = await qa.runPerformanceTests({
  skill: implementation,
  benchmarks: {
    responseTime: detailedDesign.performanceTargets.responseTime,
    throughput: detailedDesign.performanceTargets.throughput,
    memoryUsage: detailedDesign.performanceTargets.memoryLimit,
    cpuUsage: detailedDesign.performanceTargets.cpuLimit,
  },
  loadPatterns: [
    "normal_load",
    "peak_load",
    "spike_load",
    "sustained_load",
  ],
});

// 9. 安全审计
const securityAudit = await qa.runSecurityAudit({
  skill: implementation,
  checks: {
    staticAnalysis: true,
    dependencyVulnerabilities: true,
    injectionVulnerabilities: true,
    authenticationAuthorization: true,
    dataProtection: true,
    networkSecurity: true,
  },
  compliance: [
    "OWASP_Top_10",
    "CWE_Top_25",
  ],
});
```

#### **阶段 10: QA 验证**

质量保障团队最终验收：

```
const qaReport = await qa.generateComprehensiveReport({
  unitTests,
  integrationTests,
  performanceTests,
  securityAudit,
  
  additionalChecks: {
    documentationCompleteness: checkDocumentation(implementation),
    apiConsistency: checkApiConsistency(implementation),
    errorMessagesClarity: checkErrorMessages(implementation),
    loggingAdequacy: checkLogging(implementation),
  },
  
  overallAssessment: {
    passed: allTestsPassed && securityClean,
    qualityScore: calculateQualityScore({
      tests: 0.40,
      performance: 0.25,
      security: 0.25,
      documentation: 0.10,
    }),
    recommendations: generateRecommendations(),
  },
});

if (!qaReport.overallAssessment.passed) {
  // 返回修复
  await tddDeveloper.fixIssues({
    issues: qaReport.failures,
    priority: "high",
  });
  // 重新运行相关测试
  return;
}
```

#### **阶段 11: 文档生成**

自动生成完整文档：

```
const documentation = await librarian.generateDocumentation({
  skill: implementation,
  types: {
    // 用户文档
    userGuide: {
      overview: true,
      installation: true,
      quickStart: true,
      examples: true,
      troubleshooting: true,
      faq: true,
    },
    
    // API 文档
    apiReference: {
      endpoints: true,
      parameters: true,
      responses: true,
      errorCodes: true,
      examples: true,
    },
    
    // 开发者文档
    developerGuide: {
      architecture: true,
      designDecisions: true,
      contributing: true,
      testing: true,
    },
    
    // 变更日志
    changelog: {
      version: "1.0.0",
      changes: ["initial_release"],
    },
  },
  
  formats: ["markdown", "html"],
  languages: ["zh-CN", "en-US"],
});
```

#### **阶段 12: 发布与推广**

Publisher 和 Librarian 协同完成发布：

```
// 1. 准备发布包
const releasePackage = await publisher.prepareRelease({
  skill: implementation,
  version: "1.0.0",
  artifacts: {
    code: implementation.code,
    tests: implementation.tests,
    documentation,
    metadata: {
      name: implementation.name,
      description: implementation.description,
      author: "Genesis Team (Autonomous)",
      license: "MIT",
      keywords: extractKeywords(implementation),
      category: categorizeSkill(implementation),
    },
  },
});

// 2. 创建发布提案
const proposal = await publisher.createProposal({
  package: releasePackage,
  evidence: {
    qaReport,
    performanceBenchmarks: performanceTests.results,
    securityAudit: securityAudit.report,
    userStories: generateUserStories(implementation),
  },
  promotionStrategy: {
    initialScope: "beta",
    rolloutPlan: [
      { phase: "internal", duration: "7d" },
      { phase: "beta_users", duration: "14d" },
      { phase: "general_availability", duration: "ongoing" },
    ],
  },
});

// 3. 提交审批（如需要）
if (proposal.riskLevel === "high") {
  const approval = await publisher.requestApproval({
    proposal,
    approvers: ["sovereignty_auditor", "human_sovereign"],
  });
  
  if (!approval.approved) {
    await publisher.rejectProposal({
      proposal,
      reason: approval.rejectionReason,
    });
    return;
  }
}

// 4. 注册到资产目录
await librarian.registerAsset({
  asset: releasePackage,
  proposal,
  metadata: {
    createdAt: new Date(),
    createdBy: "genesis_team",
    creationMethod: "autonomous",
    qaApproved: true,
    securityCleared: true,
  },
});

// 5. 更新索引
await librarian.rebuildIndex({
  scope: "incremental",
  includeNewSkill: implementation.id,
});

// 6. 通知相关方
await publisher.notifyStakeholders({
  release: releasePackage,
  recipients: [
    "executor",
    "strategist",
    "all_agents",
  ],
  message: `新技能 ${implementation.name} v${releasePackage.version} 已发布`,
});

// 7. 开始推广期
await publisher.startPromotion({
  skillId: implementation.id,
  strategy: proposal.promotionStrategy,
  monitoring: {
    trackAdoption: true,
    trackPerformance: true,
    trackIssues: true,
    alertThresholds: {
      errorRate: 0.05,
      negativeFeedback: 0.10,
    },
  },
});
```

---

### 4. 自主创建决策规则

#### **创建优先级评分**

```
interface CreationPriorityScore {
  // 业务价值 (30%)
  businessValue: {
    revenueImpact: number;        // 收入影响 0-10
    costReduction: number;        // 成本降低 0-10
    efficiencyGain: number;       // 效率提升 0-10
    competitiveAdvantage: number; // 竞争优势 0-10
  };
  
  // 技术必要性 (25%)
  technicalNecessity: {
    capabilityGap: number;        // 能力缺口严重性 0-10
    dependencyCriticality: number;// 依赖关键性 0-10
    architecturalFit: number;     // 架构适配度 0-10
  };
  
  // 实施可行性 (20%)
  implementationFeasibility: {
    technicalRisk: number;        // 技术风险（反向）0-10
    resourceAvailability: number; // 资源可用性 0-10
    timeToMarket: number;         // 上市时间合理性 0-10
  };
  
  // 战略对齐 (15%)
  strategicAlignment: {
    roadmapFit: number;           // 路线图匹配度 0-10
    longTermVision: number;       // 长期愿景契合度 0-10
  };
  
  // 风险评估 (10%)
  riskAssessment: {
    securityRisk: number;         // 安全风险（反向）0-10
    operationalRisk: number;      // 运营风险（反向）0-10
    complianceRisk: number;       // 合规风险（反向）0-10
  };
}

// 计算优先级分数
function calculateCreationPriority(score: CreationPriorityScore): number {
  const weightedScore = 
    calculateSubScore(score.businessValue) * 0.30 +
    calculateSubScore(score.technicalNecessity) * 0.25 +
    calculateSubScore(score.implementationFeasibility) * 0.20 +
    calculateSubScore(score.strategicAlignment) * 0.15 +
    calculateSubScore(score.riskAssessment) * 0.10;
  
  return normalizeScore(weightedScore, 0, 10);
}

// 决策阈值
const DECISION_THRESHOLDS = {
  AUTO_CREATE: 8.5,      // ≥ 8.5: 自动创建
  PROPOSE_FOR_APPROVAL: 7.0,  // 7.0-8.4: 提案等待审批
  DEFER: 5.0,            // 5.0-6.9: 暂缓
  REJECT: 0,             // < 5.0: 拒绝
};
```

---

### 5. 实施示例

#### **完整创建流程示例**

```
// Sentinel 检测到全新能力缺口
const gapSignal = await sentinel.detectCapabilityGap({
  task: "real-time sentiment analysis of social media",
  missingCapability: "sentiment_analysis",
  urgency: "high",
});

// Genesis Team 启动创建流程

// 阶段 1: 需求分析
const requirements = await archaeologist.analyzeRequirements({
  triggerSignal: gapSignal,
  context: {
    marketTrends: analyzeMarketTrends(),
    competitorAnalysis: analyzeCompetitors(),
    userNeeds: collectUserNeeds(),
  },
});

// 阶段 2: 技术方案设计
const design = await tddDeveloper.designTechnicalSolution({
  requirements,
  constraints: {
    latency: "< 100ms",
    accuracy: "> 90%",
    languages: ["en", "zh", "ja", "ko"],
  },
});

// 阶段 3: 原型验证
const prototype = await tddDeveloper.createPrototype({
  design,
  scope: "core_algorithm_only",
});

const validation = await tddDeveloper.validatePrototype({
  prototype,
  testDataset: labeledSentimentData,
  accuracyThreshold: 0.85,
});

if (!validation.meetsThreshold) {
  // 调整设计方案
  design.algorithm = "transformer_based";
  // 重新验证...
}

// 阶段 4-5: 详细设计 + 沙盒实现
const detailedDesign = await tddDeveloper.createDetailedDesign({ design });
const sandbox = await sandbox.createEnvironment({ isolationLevel: "full" });
const implementation = await tddDeveloper.implementSkill({
  design: detailedDesign,
  sandbox,
  approach: "test_driven_development",
});

// 阶段 6-9: 全面测试
const testResults = await qa.runComprehensiveTests({
  skill: implementation,
  testSuites: ["unit", "integration", "performance", "security"],
});

// 阶段 10: QA 验收
const qaReport = await qa.generateReport({ testResults });

if (qaReport.qualityScore >= 0.90) {
  // 阶段 11: 文档生成
  const docs = await librarian.generateDocumentation({
    skill: implementation,
    types: ["user_guide", "api_reference", "developer_guide"],
  });
  
  // 阶段 12: 发布
  const release = await publisher.prepareRelease({
    skill: implementation,
    version: "1.0.0",
    documentation: docs,
  });
  
  await librarian.registerAsset({
    asset: release,
    metadata: {
      createdBy: "genesis_team",
      creationMethod: "autonomous",
      qaApproved: true,
    },
  });
  
  await publisher.startPromotion({
    skillId: implementation.id,
    strategy: {
      initialScope: "beta",
      rolloutPhases: ["internal", "beta", "ga"],
    },
  });
  
  log.info(`✅ 技能创建成功: ${implementation.name} v1.0.0`);
} else {
  log.warn(`❌ QA 未通过，需要修复: 质量分数 ${qaReport.qualityScore}`);
  // 返回修复...
}
```

---

### 6. 创建后监控与优化

#### **监控指标**

```
interface SkillCreationMetrics {
  // 创建过程指标
  creationProcess: {
    totalCreationsAttempted: number;
    successfulCreations: number;
    failedCreations: number;
    avgCreationTime: number;        // 小时
    avgIterations: number;          // 平均迭代次数
  };
  
  // 质量指标
  quality: {
    avgQaScore: number;
    avgTestCoverage: number;
    avgSecurityScore: number;
    postReleaseBugs: number;
  };
  
  // 采用指标
  adoption: {
    activeUsers: number;
    usageFrequency: number;
    userSatisfaction: number;       // 0-5
    retentionRate: number;          // 30天留存率
  };
  
  // 性能指标
  performance: {
    avgResponseTime: number;
    errorRate: number;
    resourceEfficiency: number;
  };
}
```

#### **持续优化循环**

```
// 定期评估已创建技能
setInterval(async () => {
  const skills = await librarian.getAllCreatedSkills({
    createdBy: "genesis_team",
    age: "< 90d", // 90天内创建的
  });
  
  for (const skill of skills) {
    const metrics = await collectSkillMetrics({
      skillId: skill.id,
      period: "7d",
    });
    
    // 检测需要优化的信号
    const optimizationSignals = detectOptimizationSignals({
      metrics,
      thresholds: {
        lowUsage: metrics.activeUsers < 10,
        highErrorRate: metrics.errorRate > 0.05,
        poorPerformance: metrics.avgResponseTime > skill.sla.responseTime,
        negativeFeedback: metrics.userSatisfaction < 3.5,
      },
    });
    
    if (optimizationSignals.length > 0) {
      // 触发优化流程
      await genesisTeam.optimizeSkill({
        skillId: skill.id,
        signals: optimizationSignals,
        optimizationType: determineOptimizationType(optimizationSignals),
      });
    }
  }
}, 86400000); // 每天检查
```

---

### 7. 配置选项

```
# .zhushou/config.yaml
autonomy:
  skill_creation:
    enabled: true
    
    # 触发条件
    triggers:
      capability_gap:
        enabled: true
        min_urgency: "medium"
      
      performance_breakthrough:
        enabled: true
        improvement_threshold: 0.50  # 50% 提升
      
      strategic_opportunity:
        enabled: true
        min_confidence: 0.80
      
      organizational_need:
        enabled: true
    
    # 创建策略
    creation_strategy:
      max_concurrent_creations: 3
      resource_budget_per_creation:
        time: "48h"
        compute: "high"
        memory: "2GB"
      
      quality_requirements:
        min_test_coverage: 0.90
        min_qa_score: 0.85
        require_security_audit: true
        require_performance_test: true
    
    # 审批策略
    approval_policy:
      auto_approve_threshold: 8.5
      require_human_approval_for:
        - "high_risk_skills"
        - "privileged_access_skills"
        - "external_integration_skills"
    
    # 发布策略
    release_policy:
      default_versioning: "semver"
      initial_scope: "beta"
      rollout_phases:
        - name: "internal"
          duration: "7d"
          audience: "internal_agents"
        - name: "beta"
          duration: "14d"
          audience: "beta_users"
        - name: "ga"
          duration: "ongoing"
          audience: "all_users"
    
    # 监控配置
    monitoring:
      track_creation_metrics: true
      track_adoption_metrics: true
      track_performance_metrics: true
      optimization_check_interval: "24h"
      alert_on_failure: true
```

---

### 8. 最佳实践

#### **Do's**:

- ✅ 从明确的需求出发，避免盲目创建
- ✅ 充分进行原型验证，降低技术风险
- ✅ 采用 TDD 方法，确保测试覆盖
- ✅ 进行全面的安全审计
- ✅ 生成完整的文档
- ✅ 制定清晰的推广计划
- ✅ 持续监控和优化
- ✅ 记录创建过程和决策依据

#### **Don'ts**:

- ❌ 不要创建功能重叠的技能
- ❌ 不要跳过原型验证阶段
- ❌ 不要忽视安全性和性能测试
- ❌ 不要发布未经充分测试的技能
- ❌ 不要忘记生成文档
- ❌ 不要一次性创建过多技能
- ❌ 不要忽略用户反馈
- ❌ 不要忘记持续优化

---

### 9. 相关文档

- [Genesis Team 工作流](file://g:\项目\-\governance\charter\evolution\genesis-team.yaml)
- [Archaeologist 代理蓝图](file://g:\项目\-\governance\charter\agents\archaeologist.yaml)
- [TDD Developer 代理蓝图](file://g:\项目\-\governance\charter\agents\tdd-developer.yaml)
- [QA 代理蓝图](file://g:\项目\-\governance\charter\agents\qa.yaml)
- [Publisher 代理蓝图](file://g:\项目\-\governance\charter\agents\publisher.yaml)
- [Librarian 代理蓝图](file://g:\项目\-\governance\charter\agents\librarian.yaml)
- [沙盒宇宙控制器](file://g:\项目\-\src\sandbox\universe-controller.ts)

---

**技能自主创建是能力进化的最高级形式**，它让系统能够从零开始创造全新的能力，实现真正的自我进化和自我完善，同时保持高质量标准和安全性。