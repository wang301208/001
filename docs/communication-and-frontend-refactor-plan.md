# 助手通讯层与前端重构方案

## 📋 重构目标

将助手的通讯层和前端从当前的分散架构重构为**统一、可扩展、实时化的现代化通讯与交互系统**，支持：
- 多渠道统一消息流
- 实时双向通信（WebSocket）
- 响应式前端 UI
- 组织态势可视化
- 自治系统状态监控

---

## 🎯 当前状态评估

### ✅ 现有基础设施

#### 1. 通讯层（Communication Layer）

**Gateway 服务** (`src/gateway/`):
- ✅ HTTP 服务器实现 (server-http.ts, 39.8KB)
- ✅ WebSocket 支持 (ws-log.ts, server-ws-runtime.ts)
- ✅ ACP (Agent Control Protocol) 集成
- ✅ 多渠道适配器 (Matrix, Slack, Discord, Telegram, WhatsApp 等)
- ✅ 会话管理 (session-utils.ts, 42.7KB)
- ✅ 认证与授权 (auth.ts, 19.4KB)
- ✅ 速率限制 (auth-rate-limit.ts)
- ✅ 健康检查端点 (/healthz, /readyz)

**Channels 模块** (`src/channels/`):
- ✅ 渠道配置管理 (channel-config.ts)
- ✅ 消息路由 (routing/)
- ✅ 允许列表 (allow-from.ts, allowlist-match.ts)
- ✅ 会话元数据 (session-meta.ts, session.ts)
- ✅ 输入防抖 (inbound-debounce-policy.ts)
- ✅ 提及门控 (mention-gating.ts)

**Canvas Host** (`src/canvas-host/`):
- ✅ HTTP 文件服务器 (server.ts, 16.5KB)
- ✅ WebSocket 支持 (ws)
- ✅ A2UI 集成 (a2ui.ts)
- ✅ 实时重载 (live reload)

#### 2. 前端（Frontend）

**TUI (Terminal UI)** (`src/tui/`):
- ✅ 终端界面主逻辑 (tui.ts, 24.3KB)
- ✅ 组件系统 (components/, 17 个组件)
- ✅ 主题系统 (theme/)
- ✅ 命令处理 (commands.ts, tui-command-handlers.ts)
- ✅ 事件处理 (tui-event-handlers.ts)
- ✅ 会话操作 (tui-session-actions.ts)
- ✅ 流组装器 (tui-stream-assembler.ts)

**Web UI**:
- ⚠️ 当前仅有 canvas-host 提供静态文件服务
- ⚠️ 缺少现代化的响应式 Web 前端
- ⚠️ 无组织态势可视化面板
- ⚠️ 无实时状态监控 Dashboard

### ⚠️ 关键缺口

#### 通讯层缺口

1. **统一消息总线缺失**
   - ❌ 各渠道消息流未统一到单一事件总线
   - ❌ 缺少消息标准化层（不同渠道消息格式差异大）
   - ❌ 缺少消息持久化和回放机制

2. **WebSocket 实时通信不完善**
   - ❌ 当前 ws-log.ts 仅用于日志传输
   - ❌ 缺少业务数据的实时推送（如自治状态、演化项目进度）
   - ❌ 缺少订阅/发布机制

3. **治理层事件未暴露**
   - ❌ Sandbox Universe 状态变化未实时推送
   - ❌ Genesis Team 流水线状态未暴露
   - ❌ Promotion Manifest 进度未可视化

4. **移动端支持不足**
   - ❌ 无专门的移动端 API 优化
   - ❌ 无推送通知集成（iOS/Android）
   - ❌ 无离线缓存策略

#### 前端缺口

1. **Web UI 几乎不存在**
   - ❌ 无现代化前端框架（React/Vue/Svelte）
   - ❌ 无组件库
   - ❌ 无状态管理
   - ❌ 无路由系统

2. **组织态势不可视**
   - ❌ 代理组织图未展示
   - ❌ 演化项目状态未展示
   - ❌ 冻结状态未展示
   - ❌ 资产提升流水线未展示
   - ❌ 沙盒宇宙实验状态未展示

3. **TUI 功能有限**
   - ⚠️ 仅支持基础会话交互
   - ⚠️ 无治理层信息展示
   - ⚠️ 无实时监控能力
   - ⚠️ 无可扩展的插件系统

4. **缺乏设计系统**
   - ❌ 无统一的 UI/UX 规范
   - ❌ 无暗色/亮色主题切换
   - ❌ 无可访问性（Accessibility）支持
   - ❌ 无国际化（i18n）完整支持

---

## 🚀 重构实施路线图

### 第一阶段：统一消息总线与事件系统（Week 1-2）

**目标**: 建立统一的消息总线和事件系统，将所有渠道消息和治理层事件标准化

#### 任务 1.1: 消息总线核心
```typescript
// src/communication/message-bus.ts
export interface MessageBus {
  // 发布消息
  publish(event: BusEvent): Promise<void>;
  
  // 订阅事件
  subscribe(pattern: EventPattern, handler: EventHandler): Subscription;
  
  // 取消订阅
  unsubscribe(subscription: Subscription): void;
  
  // 获取历史消息
  getHistory(filter: HistoryFilter): Promise<BusEvent[]>;
}

export interface BusEvent {
  id: string;
  type: EventType;
  timestamp: number;
  source: EventSource;
  payload: unknown;
  metadata?: EventMetadata;
}

export type EventType =
  | 'channel.message.inbound'    // 渠道入站消息
  | 'channel.message.outbound'   // 渠道出站消息
  | 'gateway.session.created'    // 会话创建
  | 'gateway.session.closed'     // 会话关闭
  | 'governance.proposal.created' // 提案创建
  | 'governance.sandbox.stage.changed' // 沙盒阶段变更
  | 'governance.promotion.completed' // 提升完成
  | 'genesis.sentinel.gap.detected' // Sentinel 检测到缺口
  | 'genesis.qa.validation.completed' // QA 验证完成
  | 'system.freeze.activated'     // 系统冻结激活
  | 'system.freeze.released';     // 系统冻结释放
```

**验收标准**:
- ✅ 所有渠道消息通过 MessageBus 发布
- ✅ 治理层事件通过 MessageBus 发布
- ✅ 支持通配符订阅（如 `governance.*`）
- ✅ 消息持久化到 SQLite/LanceDB

#### 任务 1.2: 消息标准化层
```typescript
// src/communication/message-normalizer.ts
export interface NormalizedMessage {
  id: string;
  channelId: string;
  conversationId: string;
  sender: MessageSender;
  content: MessageContent;
  attachments: MessageAttachment[];
  timestamp: number;
  metadata: Record<string, unknown>;
}

export class MessageNormalizer {
  normalize(raw: RawChannelMessage, channelType: ChannelType): NormalizedMessage {
    // 1. 提取通用字段
    // 2. 转换附件格式
    // 3. 标准化 sender 信息
    // 4. 添加渠道特定元数据
    // 5. 返回标准化消息
  }
}
```

**验收标准**:
- ✅ 支持所有现有渠道（Matrix, Slack, Discord, Telegram, WhatsApp 等）
- ✅ 统一的消息格式
- ✅ 保留渠道特定元数据

#### 任务 1.3: 事件持久化与回放
```typescript
// src/communication/event-store.ts
export class EventStore {
  async store(event: BusEvent): Promise<void> {
    // 1. 序列化事件
    // 2. 存储到 SQLite/LanceDB
    // 3. 建立索引（按 type, source, timestamp）
  }
  
  async replay(filter: ReplayFilter, handler: EventHandler): Promise<void> {
    // 1. 查询匹配的事件
    // 2. 按时间排序
    // 3. 逐个调用 handler
  }
}
```

**验收标准**:
- ✅ 事件持久化延迟 < 10ms
- ✅ 支持时间范围查询
- ✅ 支持事件类型过滤
- ✅ 回放速度 > 1000 events/s

---

### 第二阶段：WebSocket 实时通信增强（Week 3-4）

**目标**: 建立完善的 WebSocket 实时通信系统，支持业务数据实时推送

#### 任务 2.1: WebSocket 服务器重构
```typescript
// src/communication/ws-server.ts
export class WSServer {
  private wss: WebSocketServer;
  private subscriptions: Map<string, Set<WebSocket>>;
  
  constructor(opts: WSServerOptions) {
    // 1. 初始化 WebSocketServer
    // 2. 设置认证中间件
    // 3. 设置心跳检测
    // 4. 设置断线重连机制
  }
  
  async handleConnection(ws: WebSocket, req: IncomingMessage): Promise<void> {
    // 1. 验证 token
    // 2. 解析订阅请求
    // 3. 注册订阅关系
    // 4. 发送欢迎消息
    // 5. 开始心跳检测
  }
  
  async broadcast(event: BusEvent, filter?: BroadcastFilter): Promise<void> {
    // 1. 查找匹配的订阅者
    // 2. 序列化事件
    // 3. 发送给所有匹配的客户端
    // 4. 记录发送日志
  }
}
```

**验收标准**:
- ✅ 支持并发连接数 > 1000
- ✅ 消息推送延迟 < 50ms
- ✅ 自动断线重连
- ✅ 心跳检测（30s 间隔）

#### 任务 2.2: 订阅协议定义
```typescript
// src/communication/ws-protocol.ts
export type WSMessage =
  | SubscribeMessage
  | UnsubscribeMessage
  | EventMessage
  | HeartbeatMessage
  | ErrorMessage;

export interface SubscribeMessage {
  type: 'subscribe';
  id: string;
  patterns: EventPattern[];
}

export interface EventMessage {
  type: 'event';
  event: BusEvent;
}

export interface HeartbeatMessage {
  type: 'heartbeat';
  timestamp: number;
}
```

**验收标准**:
- ✅ 定义完整的 WebSocket 协议
- ✅ 支持批量订阅
- ✅ 支持动态取消订阅
- ✅ 错误处理完善

#### 任务 2.3: 客户端 SDK
```typescript
// packages/ws-client/src/index.ts
export class WSClient {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private subscriptions: Map<string, EventHandler> = new Map();
  
  async connect(url: string, token: string): Promise<void> {
    // 1. 建立 WebSocket 连接
    // 2. 发送认证信息
    // 3. 设置事件处理器
    // 4. 启动心跳检测
  }
  
  subscribe(pattern: EventPattern, handler: EventHandler): Subscription {
    // 1. 本地注册 handler
    // 2. 发送 subscribe 消息到服务器
    // 3. 返回 Subscription 对象
  }
  
  async disconnect(): Promise<void> {
    // 1. 取消所有订阅
    // 2. 关闭 WebSocket 连接
    // 3. 清理资源
  }
}
```

**验收标准**:
- ✅ 提供 TypeScript 客户端 SDK
- ✅ 自动重连（指数退避）
- ✅ 支持浏览器和 Node.js 环境
- ✅ 完整的类型定义

---

### 第三阶段：现代化 Web 前端架构（Week 5-7）

**目标**: 构建基于 React + Vite 的现代化 Web 前端，支持响应式设计和实时数据更新

#### 任务 3.1: 前端项目初始化
```bash
# 创建前端项目
cd web
pnpm create vite@latest . --template react-ts

# 安装依赖
pnpm add react-router-dom @tanstack/react-query zustand
pnpm add @mantine/core @mantine/hooks @tabler/icons-react
pnpm add recharts date-fns clsx
pnpm add -D tailwindcss postcss autoprefixer
```

**目录结构**:
```
web/
├── src/
│   ├── components/        # UI 组件
│   │   ├── layout/        # 布局组件
│   │   ├── dashboard/     # Dashboard 相关
│   │   ├── governance/    # 治理层相关
│   │   ├── channels/      # 渠道相关
│   │   └── common/        # 通用组件
│   ├── pages/             # 页面组件
│   ├── hooks/             # 自定义 Hooks
│   ├── stores/            # Zustand stores
│   ├── services/          # API 服务
│   ├── types/             # TypeScript 类型
│   ├── utils/             # 工具函数
│   └── App.tsx
├── public/                # 静态资源
├── index.html
├── vite.config.ts
└── package.json
```

**验收标准**:
- ✅ Vite 构建配置完成
- ✅ TypeScript 严格模式
- ✅ ESLint + Prettier 配置
- ✅ Tailwind CSS 集成
- ✅ Mantine UI 组件库集成

#### 任务 3.2: 状态管理架构
```typescript
// web/src/stores/useAppStore.ts
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

interface AppState {
  // 用户状态
  user: User | null;
  token: string | null;
  
  // 连接状态
  wsConnected: boolean;
  wsReconnecting: boolean;
  
  // 治理层状态
  governanceStatus: GovernanceStatus | null;
  sandboxExperiments: SandboxExperiment[];
  evolutionProjects: EvolutionProject[];
  
  // 渠道状态
  channels: ChannelStatus[];
  
  // Actions
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  setWSConnected: (connected: boolean) => void;
  updateGovernanceStatus: (status: GovernanceStatus) => void;
  addSandboxExperiment: (experiment: SandboxExperiment) => void;
  // ... more actions
}

export const useAppStore = create<AppState>()(
  subscribeWithSelector((set, get) => ({
    user: null,
    token: null,
    wsConnected: false,
    wsReconnecting: false,
    governanceStatus: null,
    sandboxExperiments: [],
    evolutionProjects: [],
    channels: [],
    
    setUser: (user) => set({ user }),
    setToken: (token) => set({ token }),
    setWSConnected: (connected) => set({ wsConnected: connected }),
    updateGovernanceStatus: (status) => set({ governanceStatus: status }),
    addSandboxExperiment: (experiment) => 
      set((state) => ({ 
        sandboxExperiments: [...state.sandboxExperiments, experiment] 
      })),
  }))
);
```

**验收标准**:
- ✅ Zustand 状态管理
- ✅ 支持持久化（localStorage）
- ✅ 支持 DevTools
- ✅ 类型安全

#### 任务 3.3: WebSocket 集成
```typescript
// web/src/hooks/useWebSocket.ts
import { useEffect, useRef } from 'react';
import { WSClient } from '@zhushou/ws-client';
import { useAppStore } from '../stores/useAppStore';

export function useWebSocket() {
  const clientRef = useRef<WSClient | null>(null);
  const { token, setWSConnected, updateGovernanceStatus } = useAppStore();
  
  useEffect(() => {
    if (!token) return;
    
    const client = new WSClient();
    clientRef.current = client;
    
    client.connect('ws://localhost:18789/ws', token).then(() => {
      setWSConnected(true);
      
      // 订阅治理层事件
      client.subscribe('governance.*', (event) => {
        switch (event.type) {
          case 'governance.status.updated':
            updateGovernanceStatus(event.payload as GovernanceStatus);
            break;
          // ... handle other events
        }
      });
      
      // 订阅沙盒实验事件
      client.subscribe('governance.sandbox.*', (event) => {
        // 更新沙盒实验状态
      });
    });
    
    return () => {
      client.disconnect();
      setWSConnected(false);
    };
  }, [token]);
  
  return clientRef.current;
}
```

**验收标准**:
- ✅ 自动连接和断开
- ✅ 事件订阅和取消订阅
- ✅ 状态自动同步到 Zustand
- ✅ 错误处理和重连

#### 任务 3.4: 路由系统
```typescript
// web/src/App.tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { MainLayout } from './components/layout/MainLayout';
import { DashboardPage } from './pages/DashboardPage';
import { GovernancePage } from './pages/GovernancePage';
import { ChannelsPage } from './pages/ChannelsPage';
import { SettingsPage } from './pages/SettingsPage';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="governance" element={<GovernancePage />} />
          <Route path="channels" element={<ChannelsPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
```

**验收标准**:
- ✅ React Router v6 配置
- ✅ 嵌套路由支持
- ✅ 路由守卫（认证检查）
- ✅ 懒加载支持

---

### 第四阶段：组织态势面板开发（Week 8-10）

**目标**: 开发完整的组织态势可视化面板，展示代理组织、演化项目、冻结状态等

#### 任务 4.1: Dashboard 首页
```tsx
// web/src/pages/DashboardPage.tsx
import { Grid, Card, Title, Text } from '@mantine/core';
import { useAppStore } from '../stores/useAppStore';
import { AgentTopologyGraph } from '../components/dashboard/AgentTopologyGraph';
import { SystemHealthCard } from '../components/dashboard/SystemHealthCard';
import { RecentEventsList } from '../components/dashboard/RecentEventsList';

export function DashboardPage() {
  const { governanceStatus, channels, wsConnected } = useAppStore();
  
  return (
    <div>
      <Title order={1}>系统 Dashboard</Title>
      <Text c="dimmed">实时监控系统状态</Text>
      
      <Grid mt="md">
        <Grid.Col span={4}>
          <SystemHealthCard 
            connected={wsConnected}
            channels={channels}
            governanceStatus={governanceStatus}
          />
        </Grid.Col>
        
        <Grid.Col span={8}>
          <AgentTopologyGraph agents={governanceStatus?.agents || []} />
        </Grid.Col>
        
        <Grid.Col span={12}>
          <RecentEventsList limit={20} />
        </Grid.Col>
      </Grid>
    </div>
  );
}
```

**验收标准**:
- ✅ 展示系统健康状态
- ✅ 展示代理拓扑图
- ✅ 展示最近事件列表
- ✅ 实时更新（< 1s 延迟）

#### 任务 4.2: 代理组织图
```tsx
// web/src/components/governance/AgentTopologyGraph.tsx
import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { AgentNode } from '../../types/governance';

interface AgentTopologyGraphProps {
  agents: AgentNode[];
}

export function AgentTopologyGraph({ agents }: AgentTopologyGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  
  useEffect(() => {
    if (!svgRef.current || agents.length === 0) return;
    
    const width = svgRef.current.clientWidth;
    const height = 400;
    
    // 使用 D3 力导向图
    const simulation = d3.forceSimulation(agents)
      .force('link', d3.forceLink().id((d: any) => d.id))
      .force('charge', d3.forceManyBody())
      .force('center', d3.forceCenter(width / 2, height / 2));
    
    // 绘制节点和连线
    // ...
    
    return () => {
      simulation.stop();
    };
  }, [agents]);
  
  return (
    <Card>
      <Title order={3}>代理组织图</Title>
      <svg ref={svgRef} width="100%" height={height} />
    </Card>
  );
}
```

**验收标准**:
- ✅ 使用 D3.js 力导向图
- ✅ 节点可拖拽
- ✅ 显示代理角色和状态
- ✅ 支持缩放和平移

#### 任务 4.3: 演化项目列表
```tsx
// web/src/components/governance/EvolutionProjectList.tsx
import { Table, Badge, Progress } from '@mantine/core';
import { EvolutionProject } from '../../types/governance';

interface EvolutionProjectListProps {
  projects: EvolutionProject[];
}

export function EvolutionProjectList({ projects }: EvolutionProjectListProps) {
  return (
    <Table>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>项目名称</Table.Th>
          <Table.Th>类型</Table.Th>
          <Table.Th>状态</Table.Th>
          <Table.Th>进度</Table.Th>
          <Table.Th>创建时间</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {projects.map((project) => (
          <Table.Tr key={project.id}>
            <Table.Td>{project.title}</Table.Td>
            <Table.Td>
              <Badge color={getMutationClassColor(project.mutationClass)}>
                {project.mutationClass}
              </Badge>
            </Table.Td>
            <Table.Td>
              <Badge color={getStatusColor(project.status)}>
                {project.status}
              </Badge>
            </Table.Td>
            <Table.Td>
              <Progress value={project.progress} size="sm" />
            </Table.Td>
            <Table.Td>
              {new Date(project.createdAt).toLocaleString()}
            </Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}
```

**验收标准**:
- ✅ 展示所有演化项目
- ✅ 显示项目状态和进度
- ✅ 支持筛选和排序
- ✅ 点击可查看详细信息

#### 任务 4.4: 沙盒宇宙监控
```tsx
// web/src/components/governance/SandboxUniverseMonitor.tsx
import { Tabs, Card, Timeline } from '@mantine/core';
import { SandboxExperiment } from '../../types/governance';

interface SandboxUniverseMonitorProps {
  experiments: SandboxExperiment[];
}

export function SandboxUniverseMonitor({ experiments }: SandboxUniverseMonitorProps) {
  return (
    <Card>
      <Title order={3}>沙盒宇宙监控</Title>
      
      <Tabs defaultValue="active">
        <Tabs.List>
          <Tabs.Tab value="active">进行中</Tabs.Tab>
          <Tabs.Tab value="completed">已完成</Tabs.Tab>
          <Tabs.Tab value="failed">已失败</Tabs.Tab>
        </Tabs.List>
        
        <Tabs.Panel value="active">
          {experiments
            .filter((exp) => exp.status === 'running')
            .map((exp) => (
              <Card key={exp.id} mb="md">
                <Title order={4}>{exp.title}</Title>
                <Timeline active={getCurrentStageIndex(exp)} bulletSize={24}>
                  {exp.stages.map((stage) => (
                    <Timeline.Item
                      key={stage.id}
                      title={stage.title}
                      bullet={getStageBullet(stage.status)}
                    >
                      <Text size="sm">{stage.description}</Text>
                    </Timeline.Item>
                  ))}
                </Timeline>
              </Card>
            ))}
        </Tabs.Panel>
        
        {/* ... other panels */}
      </Tabs>
    </Card>
  );
}
```

**验收标准**:
- ✅ 展示所有沙盒实验
- ✅ 显示实验阶段和时间线
- ✅ 支持查看实验详情
- ✅ 实时状态更新

#### 任务 4.5: 冻结状态指示器
```tsx
// web/src/components/governance/FreezeStatusIndicator.tsx
import { Alert, Badge, Button } from '@mantine/core';
import { IconAlertTriangle, IconCheck } from '@tabler/icons-react';
import { FreezeStatus } from '../../types/governance';

interface FreezeStatusIndicatorProps {
  freezeStatus: FreezeStatus;
  onRelease?: () => void;
}

export function FreezeStatusIndicator({ freezeStatus, onRelease }: FreezeStatusIndicatorProps) {
  if (!freezeStatus.active) {
    return (
      <Alert icon={<IconCheck />} color="green" title="系统正常">
        所有子系统运行正常，无冻结状态
      </Alert>
    );
  }
  
  return (
    <Alert icon={<IconAlertTriangle />} color="red" title="系统冻结">
      <Text mb="md">{freezeStatus.reason}</Text>
      <Text size="sm" mb="md">
        冻结时间: {new Date(freezeStatus.activatedAt).toLocaleString()}
      </Text>
      <Text size="sm" mb="md">
        影响子系统: {freezeStatus.affectedSubsystems.join(', ')}
      </Text>
      {onRelease && (
        <Button onClick={onRelease} color="red" variant="filled">
          解除冻结
        </Button>
      )}
    </Alert>
  );
}
```

**验收标准**:
- ✅ 清晰显示冻结状态
- ✅ 显示冻结原因和影响范围
- ✅ 授权用户可解除冻结
- ✅ 高优先级告警

---

### 第五阶段：TUI 增强与移动端支持（Week 11-12）

**目标**: 增强 TUI 功能，并添加移动端 API 支持和推送通知

#### 任务 5.1: TUI 治理层信息展示
```typescript
// src/tui/components/governance-panel.ts
export function renderGovernancePanel(status: GovernanceStatus): string {
  return `
╔══════════════════════════════════════╗
║       治理层状态面板                 ║
╠══════════════════════════════════════╣
║ 主权边界: ${status.sovereigntyBoundary ? '✅ 正常' : '❌ 异常'}
║ 活跃代理: ${status.activeAgents.length}
║ 演化项目: ${status.evolutionProjects.length}
║ 沙盒实验: ${status.sandboxExperiments.length}
║ 冻结状态: ${status.freezeActive ? '🔴 冻结' : '🟢 正常'}
╚══════════════════════════════════════╝
  `.trim();
}
```

**验收标准**:
- ✅ TUI 展示治理层状态
- ✅ 支持快捷键刷新
- ✅ 颜色区分状态

#### 任务 5.2: 移动端 API 优化
```typescript
// src/gateway/mobile-api.ts
export class MobileAPI {
  async getCompactStatus(): Promise<MobileStatusResponse> {
    // 1. 返回精简的状态信息
    // 2. 减少 payload 大小
    // 3. 优化网络传输
  }
  
  async subscribeToPushNotifications(deviceId: string): Promise<void> {
    // 1. 注册设备
    // 2. 设置推送订阅
    // 3. 返回 subscription_id
  }
}
```

**验收标准**:
- ✅ 移动端专用 API 端点
- ✅ Payload 大小减少 50%
- ✅ 支持分页和增量更新

#### 任务 5.3: 推送通知集成
```typescript
// src/infra/push-notifications.ts
export class PushNotificationService {
  async sendToDevice(deviceId: string, notification: PushNotification): Promise<void> {
    // iOS: 使用 APNs
    // Android: 使用 FCM
    
    if (device.platform === 'ios') {
      await this.sendViaAPNs(device.token, notification);
    } else if (device.platform === 'android') {
      await this.sendViaFCM(device.token, notification);
    }
  }
  
  async notifyOnFreezeActivated(freezeStatus: FreezeStatus): Promise<void> {
    // 1. 查找所有订阅了冻结事件的设备
    // 2. 发送推送通知
    // 3. 记录发送日志
  }
}
```

**验收标准**:
- ✅ 支持 iOS APNs
- ✅ 支持 Android FCM
- ✅ 关键事件自动推送
- ✅ 推送成功率 > 95%

---

## 📊 技术栈选型

### 前端技术栈
- **框架**: React 18 + TypeScript
- **构建工具**: Vite 5
- **路由**: React Router v6
- **状态管理**: Zustand
- **数据获取**: @tanstack/react-query
- **UI 组件库**: Mantine v7
- **图标**: Tabler Icons
- **图表**: Recharts + D3.js
- **样式**: Tailwind CSS + CSS Modules
- **HTTP 客户端**: Axios
- **WebSocket**: 自定义客户端（基于 ws）

### 后端技术栈（扩展现有）
- **WebSocket**: ws ^8.16.0（已有）
- **消息总线**: 自定义实现（基于 EventEmitter + SQLite）
- **推送通知**: 
  - iOS: node-apn
  - Android: firebase-admin

---

## 🎨 设计系统规范

### 颜色方案
```typescript
// web/src/theme/colors.ts
export const colors = {
  primary: '#FF5A36',
  secondary: '#FF8A6B',
  success: '#40C057',
  warning: '#FCC419',
  error: '#FA5252',
  info: '#228BE6',
  
  // 治理层专用颜色
  sovereignty: '#E64980',
  evolution: '#7950F2',
  capability: '#20C997',
  execution: '#339AF0',
};
```

### 暗色/亮色主题
```typescript
// web/src/theme/index.ts
import { createTheme } from '@mantine/core';

export const lightTheme = createTheme({
  colorScheme: 'light',
  primaryColor: 'primary',
  // ...
});

export const darkTheme = createTheme({
  colorScheme: 'dark',
  primaryColor: 'primary',
  // ...
});
```

### 响应式断点
```typescript
// web/src/theme/breakpoints.ts
export const breakpoints = {
  xs: '0px',
  sm: '576px',
  md: '768px',
  lg: '992px',
  xl: '1200px',
};
```

---

## 📈 成功指标

### 技术指标
- ✅ WebSocket 消息推送延迟 < 50ms
- ✅ 前端首屏加载时间 < 2s
- ✅ 页面切换时间 < 500ms
- ✅ 移动端 API payload 减少 50%
- ✅ 推送通知成功率 > 95%

### 用户体验指标
- ✅ Dashboard 实时状态更新延迟 < 1s
- ✅ 代理组织图加载时间 < 1s
- ✅ 演化项目列表支持秒级筛选
- ✅ TUI 治理层信息刷新 < 2s
- ✅ 移动端推送到达时间 < 5s

### 业务指标
- ✅ 人类主权者可随时查看系统状态
- ✅ 90% 的关键事件通过推送通知及时送达
- ✅ 治理层透明度提升 80%
- ✅ 故障检测和响应时间缩短 60%

---

## ⚠️ 风险与缓解

### 风险 1: WebSocket 连接稳定性
**缓解**:
- 实现指数退避重连
- 添加心跳检测
- 支持离线缓存和消息重放

### 风险 2: 前端性能瓶颈
**缓解**:
- 使用虚拟滚动处理大数据列表
- 实现组件懒加载
- 使用 React.memo 和 useMemo 优化渲染

### 风险 3: 移动端网络不稳定
**缓解**:
- 实现离线优先策略
- 使用 Service Worker 缓存
- 支持增量数据同步

### 风险 4: 推送通知权限被拒绝
**缓解**:
- 提供友好的权限请求说明
- 支持应用内通知作为备选
- 允许用户自定义通知偏好

---

## 📅 里程碑

| 阶段 | 时间 | 交付物 | 验收标准 |
|------|------|--------|----------|
| 第一阶段 | Week 1-2 | 统一消息总线 | 所有渠道消息和治理层事件通过 MessageBus 发布 |
| 第二阶段 | Week 3-4 | WebSocket 实时通信 | 支持 1000+ 并发连接，推送延迟 < 50ms |
| 第三阶段 | Week 5-7 | 现代化 Web 前端 | React + Vite 架构，完整的路由和状态管理 |
| 第四阶段 | Week 8-10 | 组织态势面板 | 完整的 Dashboard、代理组织图、演化项目列表 |
| 第五阶段 | Week 11-12 | TUI 增强与移动端 | TUI 治理层信息、移动端 API、推送通知 |

---

## 🎓 学习与文档

### 必读文档
1. `docs/institutional-system-refactor-plan.md` - 制度化系统重构方案
2. `src/gateway/server-http.ts` - 现有 HTTP 服务器实现
3. `src/channels/` - 现有渠道模块
4. `src/tui/tui.ts` - 现有 TUI 实现

### 参考项目
- [Mantine UI](https://mantine.dev/)
- [Zustand](https://zustand-demo.pmnd.rs/)
- [React Query](https://tanstack.com/query/latest)
- [D3.js](https://d3js.org/)

### 关键代码文件
1. `src/communication/message-bus.ts` (待创建)
2. `src/communication/ws-server.ts` (待创建)
3. `web/src/stores/useAppStore.ts` (待创建)
4. `web/src/hooks/useWebSocket.ts` (待创建)

---

## 🤝 协作指南

### 开发者角色
- **后端工程师**: 负责消息总线、WebSocket 服务器、移动端 API
- **前端工程师**: 负责 Web UI、组件开发、状态管理
- **移动开发工程师**: 负责推送通知集成、移动端优化
- **UI/UX 设计师**: 负责设计系统、交互设计、视觉设计

### 工作流程
1. 所有 API 变更必须先更新 OpenAPI 文档
2. 所有前端组件必须有 Storybook 文档
3. 所有 WebSocket 消息必须有类型定义
4. 所有推送通知必须经过用户测试

---

## 📝 附录

### A. 术语表
- **MessageBus**: 消息总线，统一的消息发布订阅系统
- **WebSocket**: 双向实时通信协议
- **Dashboard**: 系统仪表板，展示关键指标和状态
- **Push Notification**: 推送通知，向移动设备发送实时消息

### B. 常见问题
**Q: 为什么选择 React 而不是 Vue 或 Svelte？**
A: React 生态系统更成熟，社区支持更好，且有更多企业级组件库（如 Mantine）。

**Q: 为什么不直接使用现有的 TUI 作为主要界面？**
A: TUI 适合快速交互，但无法提供丰富的可视化和实时监控能力。Web UI 更适合复杂的数据展示。

**Q: 推送通知是否会影响系统性能？**
A: 推送通知是异步的，且只在关键事件时触发，对系统性能影响极小。

### C. 参考资料
- [WebSocket RFC 6455](https://datatracker.ietf.org/doc/html/rfc6455)
- [React Documentation](https://react.dev/)
- [Mantine Documentation](https://mantine.dev/)
- [Zustand Documentation](https://zustand-demo.pmnd.rs/)

---

**文档版本**: 1.0  
**最后更新**: 2026-04-16  
**维护者**: 助手治理团队
