import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { apiService } from '../services/api';
import { wsManager } from '../services/ws-manager';
import type { GovernanceStatus, Notification, NotificationType, User, ChannelStatus } from '../types';

export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
export type TaskPriority = 'high' | 'medium' | 'low';
export type TaskGroup = 'system' | 'data' | 'network' | 'file' | 'ai' | 'custom';
export type TaskDuration = 'short' | 'medium' | 'long';

export interface RunningTask {
  id: string;
  name: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  group: TaskGroup;
  duration: TaskDuration;
  progress?: number;
  startTime: number;
  endTime?: number;
  estimatedEndTime?: number;
  error?: string;
  metadata?: Record<string, any>;
  dependencies?: string[];
  retryCount?: number;
  maxRetries?: number;
}

interface AppState {
  user: User | null;
  token: string | null;
  wsConnected: boolean;
  wsReconnecting: boolean;
  wsAuthenticated: boolean;
  governanceStatus: GovernanceStatus | null;
  channels: ChannelStatus[];
  notifications: Notification[];
  unreadCount: number;
  runningTasks: RunningTask[];
  taskSearchQuery: string;
  taskGroupFilter: TaskGroup | 'all';
  taskDurationFilter: TaskDuration | 'all';
  systemInfo: { version: string; uptime: number; memory?: { used: number; total: number } } | null;
  healthStatus: 'healthy' | 'degraded' | 'unhealthy' | null;

  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  setWSConnected: (connected: boolean) => void;
  setWSReconnecting: (reconnecting: boolean) => void;
  setWSAuthenticated: (authenticated: boolean) => void;
  updateGovernanceStatus: (status: GovernanceStatus) => void;
  setChannels: (channels: ChannelStatus[]) => void;

  addNotification: (type: NotificationType, title: string, message: string, action?: Notification['action']) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;

  addTask: (task: Omit<RunningTask, 'id' | 'startTime' | 'status'>) => string;
  updateTaskProgress: (taskId: string, progress: number) => void;
  completeTask: (taskId: string, error?: string) => void;
  cancelTask: (taskId: string) => void;
  removeTask: (taskId: string) => void;
  clearCompletedTasks: () => void;
  retryTask: (taskId: string) => string;
  setTaskSearchQuery: (query: string) => void;
  setTaskGroupFilter: (group: TaskGroup | 'all') => void;
  setTaskDurationFilter: (duration: TaskDuration | 'all') => void;

  loadGovernanceStatus: () => Promise<boolean>;
  loadChannels: () => Promise<boolean>;
  connectChannel: (channelId: string) => Promise<boolean>;
  disconnectChannel: (channelId: string) => Promise<boolean>;
  checkHealth: () => Promise<boolean>;
  loadSystemInfo: () => Promise<boolean>;
  loadTasks: () => Promise<boolean>;
  cancelBackendTask: (taskId: string) => Promise<boolean>;
}

export const useAppStore = create<AppState>()(
  subscribeWithSelector((set, get) => ({
    user: null,
    token: null,
    wsConnected: false,
    wsReconnecting: false,
    wsAuthenticated: false,
    governanceStatus: null,
    channels: [],
    notifications: [],
    unreadCount: 0,
    runningTasks: [],
    taskSearchQuery: '',
    taskGroupFilter: 'all',
    taskDurationFilter: 'all',
    systemInfo: null,
    healthStatus: null,

    setUser: (user) => set({ user }),
    setToken: (token) => {
      wsManager.setToken(token);
      const shouldReconnect = wsManager.isConnected || wsManager.isConnecting;
      if (shouldReconnect) {
        wsManager.disconnect();
        setTimeout(() => wsManager.connect(), 100);
      }
      set({ token });
    },
    setWSConnected: (connected) => set({ wsConnected: connected }),
    setWSReconnecting: (reconnecting) => set({ wsReconnecting: reconnecting }),
    setWSAuthenticated: (authenticated) => set({ wsAuthenticated: authenticated }),
    updateGovernanceStatus: (status) => set({ governanceStatus: status }),
    setChannels: (channels) => set({ channels }),

    addNotification: (type, title, message, action) => {
      const id = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const notification: Notification = {
        id, type, title, message, timestamp: Date.now(), read: false, action,
      };

      set((state: AppState) => ({
        notifications: [notification, ...state.notifications].slice(0, 50),
        unreadCount: state.unreadCount + 1,
      }));

      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, { body: message, icon: '/icon.png' });
      }
    },

    markAsRead: (id) => {
      set((state: AppState) => {
        const notification = state.notifications.find((n: Notification) => n.id === id);
        if (!notification || notification.read) return state;
        return {
          notifications: state.notifications.map((n: Notification) => n.id === id ? { ...n, read: true } : n),
          unreadCount: Math.max(0, state.unreadCount - 1),
        };
      });
    },

    markAllAsRead: () => {
      set((state: AppState) => ({
        notifications: state.notifications.map((n: Notification) => ({ ...n, read: true })),
        unreadCount: 0,
      }));
    },

    removeNotification: (id) => {
      set((state: AppState) => {
        const notification = state.notifications.find((n: Notification) => n.id === id);
        if (!notification) return state;
        return {
          notifications: state.notifications.filter((n: Notification) => n.id !== id),
          unreadCount: notification.read ? state.unreadCount : Math.max(0, state.unreadCount - 1),
        };
      });
    },

    clearNotifications: () => set({ notifications: [], unreadCount: 0 }),

    addTask: (task) => {
      const id = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const newTask: RunningTask = { ...task, id, status: 'running', startTime: Date.now(), progress: 0 };
      set((state: AppState) => ({ runningTasks: [newTask, ...state.runningTasks] }));
      return id;
    },

    updateTaskProgress: (taskId, progress) => {
      set((state: AppState) => ({
        runningTasks: state.runningTasks.map((task: RunningTask) =>
          task.id === taskId ? { ...task, progress: Math.min(100, Math.max(0, progress)) } : task
        ),
      }));
    },

    completeTask: (taskId, error) => {
      set((state: AppState) => ({
        runningTasks: state.runningTasks.map((task: RunningTask) =>
          task.id === taskId
            ? { ...task, status: error ? 'failed' : 'completed', progress: error ? task.progress : 100, endTime: Date.now(), error }
            : task
        ),
      }));
    },

    cancelTask: (taskId) => {
      set((state: AppState) => ({
        runningTasks: state.runningTasks.map((task: RunningTask) =>
          task.id === taskId ? { ...task, status: 'cancelled', endTime: Date.now() } : task
        ),
      }));
    },

    removeTask: (taskId) => {
      set((state: AppState) => ({
        runningTasks: state.runningTasks.filter((task: RunningTask) => task.id !== taskId),
      }));
    },

    clearCompletedTasks: () => {
      set((state: AppState) => ({
        runningTasks: state.runningTasks.filter((task: RunningTask) =>
          task.status !== 'completed' && task.status !== 'failed' && task.status !== 'cancelled'
        ),
      }));
    },

    retryTask: (taskId) => {
      let newTaskId = '';
      set((state: AppState) => {
        const task = state.runningTasks.find((t: RunningTask) => t.id === taskId);
        if (!task || task.status !== 'failed') return state;
        newTaskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const retriedTask: RunningTask = {
          ...task, id: newTaskId, status: 'running', progress: 0,
          startTime: Date.now(), endTime: undefined, error: undefined,
          retryCount: (task.retryCount || 0) + 1,
        };
        return { runningTasks: [retriedTask, ...state.runningTasks] };
      });
      return newTaskId;
    },

    setTaskSearchQuery: (query) => set({ taskSearchQuery: query }),
    setTaskGroupFilter: (group) => set({ taskGroupFilter: group }),
    setTaskDurationFilter: (duration) => set({ taskDurationFilter: duration }),

    loadGovernanceStatus: async () => {
      try {
        const response = await apiService.getGovernanceStatus();
        if (response.success && response.data) {
          set({ governanceStatus: response.data });
          return true;
        }
        get().addNotification('error', '加载失败', '获取治理状态失败: ' + (response.error || '未知错误'));
        return false;
      } catch (error) {
        console.error('[useAppStore] 加载治理状态失败:', error);
        get().addNotification('error', '加载失败', '获取治理状态异常');
        return false;
      }
    },

    loadChannels: async () => {
      try {
        const response = await apiService.getChannels();
        if (response.success && response.data) {
          set({ channels: response.data as any });
          return true;
        }
        get().addNotification('error', '加载失败', '获取渠道列表失败: ' + (response.error || '未知错误'));
        return false;
      } catch (error) {
        console.error('[useAppStore] 加载渠道列表失败:', error);
        return false;
      }
    },

    connectChannel: async (channelId: string) => {
      try {
        const response = await apiService.connectChannel(channelId);
        if (response.success) {
          set((state: AppState) => ({
            channels: state.channels.map((ch: any) => ch.id === channelId ? { ...ch, connected: true } : ch),
          }));
          get().addNotification('success', '连接成功', '渠道已连接');
          return true;
        }
        get().addNotification('error', '连接失败', response.error || '连接渠道失败');
        return false;
      } catch (error) {
        console.error('[useAppStore] 连接渠道失败:', error);
        return false;
      }
    },

    disconnectChannel: async (channelId: string) => {
      try {
        const response = await apiService.disconnectChannel(channelId);
        if (response.success) {
          set((state: AppState) => ({
            channels: state.channels.map((ch: any) => ch.id === channelId ? { ...ch, connected: false } : ch),
          }));
          get().addNotification('success', '断开成功', '渠道已断开');
          return true;
        }
        get().addNotification('error', '断开失败', response.error || '断开渠道失败');
        return false;
      } catch (error) {
        console.error('[useAppStore] 断开渠道失败:', error);
        return false;
      }
    },

    checkHealth: async () => {
      try {
        const response = await apiService.healthCheck();
        const healthy = response.success;
        set({ healthStatus: healthy ? 'healthy' : 'unhealthy' });
        return healthy;
      } catch (error) {
        set({ healthStatus: 'unhealthy' });
        return false;
      }
    },

    loadSystemInfo: async () => {
      try {
        const response = await apiService.getSystemInfo();
        if (response.success && response.data) {
          set({ systemInfo: response.data as any });
          return true;
        }
        return false;
      } catch (error) {
        console.error('[useAppStore] 加载系统信息失败:', error);
        return false;
      }
    },

    loadTasks: async () => {
      try {
        const response = await apiService.getTasks();
        if (response.success && response.data) {
          const existingLocalTasks = get().runningTasks.filter(t => !t.id.startsWith('be_'));
          const backendTasks: RunningTask[] = (response.data as any[]).map(t => ({
            id: `be_${t.id}`,
            name: t.name,
            description: '',
            status: t.status as TaskStatus,
            priority: 'medium' as TaskPriority,
            group: 'system' as TaskGroup,
            duration: 'medium' as TaskDuration,
            progress: t.progress,
            startTime: t.createdAt,
            endTime: t.completedAt,
          }));
          set({ runningTasks: [...backendTasks, ...existingLocalTasks] });
          return true;
        }
        return false;
      } catch (error) {
        console.error('[useAppStore] 加载任务列表失败:', error);
        return false;
      }
    },

    cancelBackendTask: async (taskId: string) => {
      try {
        const response = await apiService.cancelTask(taskId);
        if (response.success) {
          get().cancelTask(taskId);
          get().addNotification('success', '取消成功', '任务已取消');
          return true;
        }
        return false;
      } catch (error) {
        return false;
      }
    },
  }))
);
