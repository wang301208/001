# 系统 Web 控制台

助手项目的现代化 Web 前端控制台，提供实时系统监控和治理层可视化。

## 🚀 快速开始

### 安装依赖

```bash
cd web
pnpm install
```

### 开发模式

```bash
pnpm dev
```

访问 http://localhost:3000

### 构建生产版本

```bash
pnpm build
```

### 预览生产构建

```bash
pnpm preview
```

## 📁 项目结构

```
web/
├── src/
│   ├── components/        # UI 组件
│   │   └── layout/        # 布局组件
│   ├── pages/             # 页面组件
│   │   ├── DashboardPage.tsx    # Dashboard 首页
│   │   ├── GovernancePage.tsx   # 治理层监控
│   │   ├── ChannelsPage.tsx     # 渠道管理
│   │   └── SettingsPage.tsx     # 系统设置
│   ├── hooks/             # 自定义 Hooks
│   │   └── useWebSocket.ts       # WebSocket 连接
│   ├── stores/            # Zustand stores
│   │   └── useAppStore.ts        # 应用状态
│   ├── types/             # TypeScript 类型
│   │   └── index.ts              # 治理层类型定义
│   ├── App.tsx            # 主应用组件
│   ├── main.tsx           # 入口文件
│   └── index.css          # 全局样式
├── index.html             # HTML 入口
├── vite.config.ts         # Vite 配置
├── tsconfig.json          # TypeScript 配置
├── tailwind.config.js     # Tailwind CSS 配置
└── package.json           # 项目配置
```

## 🎨 技术栈

- **框架**: React 18 + TypeScript
- **构建工具**: Vite 5
- **路由**: React Router v6
- **状态管理**: Zustand
- **数据获取**: @tanstack/react-query
- **UI 组件库**: Mantine v7
- **图标**: Tabler Icons
- **图表**: Recharts（待集成）
- **样式**: Tailwind CSS + CSS Modules

## 📊 功能模块

### 1. Dashboard 首页
- ✅ WebSocket 连接状态
- ✅ 渠道状态概览
- ✅ 治理层状态
- ✅ 系统统计信息

### 2. 治理层监控（开发中）
- ⏳ 代理组织图
- ⏳ 演化项目列表
- ⏳ 沙盒宇宙监控
- ⏳ 冻结状态指示器

### 3. 渠道管理（开发中）
- ⏳ 渠道连接状态
- ⏳ 渠道配置管理
- ⏳ 消息统计
- ⏳ 会话管理

### 4. 系统设置（开发中）
- ⏳ 用户认证管理
- ⏳ WebSocket 连接配置
- ⏳ 通知偏好设置
- ⏳ 主题切换

## 🔌 WebSocket 集成

前端通过 WebSocket 与后端实时通信，接收治理层事件推送。

**当前状态**: 
- ✅ WebSocket Hook 已创建
- ⏳ 需要实现浏览器兼容的 WebSocket 客户端
- ⏳ 需要配置 Vite 正确处理 Node.js 模块

## 🎯 下一步计划

1. **完善 WebSocket 集成**
   - 创建浏览器兼容的 WS 客户端
   - 实现事件订阅和状态同步
   - 添加重连逻辑

2. **开发治理层可视化**
   - 使用 D3.js 实现代理组织图
   - 实现演化项目时间线
   - 实现沙盒实验状态监控

3. **完善渠道管理**
   - 渠道状态实时监控
   - 消息流量统计图表
   - 会话列表和详情

4. **优化用户体验**
   - 添加加载状态
   - 添加错误处理
   - 添加暗色主题支持
   - 响应式设计优化

## 📝 开发注意事项

### 路径别名

使用 `@/` 作为 `src/` 的别名：

```typescript
import { useAppStore } from '@/stores/useAppStore';
```

### 组件命名

- 组件文件使用 PascalCase：`DashboardPage.tsx`
- 组件导出使用 named export：`export function DashboardPage()`

### 样式方案

- 优先使用 Mantine 组件
- 复杂布局使用 Tailwind CSS
- 自定义样式使用 CSS Modules

### 状态管理

- 全局状态使用 Zustand (`useAppStore`)
- 服务端状态使用 React Query
- 本地状态使用 useState/useReducer

## 🔧 配置说明

### Vite 代理

开发模式下，Vite 会代理以下请求到后端：

- `/api` → `http://localhost:18789`
- `/ws` → `ws://localhost:18789`

### 环境变量

创建 `.env.local` 文件配置环境变量：

```env
VITE_API_URL=http://localhost:18789
VITE_WS_URL=ws://localhost:18789/ws
```

## 📚 相关文档

- [Mantine UI 文档](https://mantine.dev/)
- [Zustand 文档](https://zustand-demo.pmnd.rs/)
- [React Query 文档](https://tanstack.com/query/latest)
- [Vite 文档](https://vitejs.dev/)

---

**最后更新**: 2026-04-16  
**版本**: 1.0.0
