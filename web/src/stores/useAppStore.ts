import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { apiService } from '../services/api';
import type { GovernanceStatus, Notification, NotificationType, User, ChannelStatus } from '../types';

// 任务状态类型
export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

// 任务优先级
export type TaskPriority = 'high' | 'medium' | 'low';

// 任务分组类型
export type TaskGroup = 'system' | 'data' | 'network' | 'file' | 'ai' | 'custom';

// 任务持续时间类型
export type TaskDuration = 'short' | 'medium' | 'long';

// 任务接口
export interface RunningTask {
  id: string;
  name: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority; // 优先级
  group: TaskGroup; // 分组
  duration: TaskDuration; // 新增：任务持续时间类型
  progress?: number; // 0-100
  startTime: number;
  endTime?: number;
  estimatedEndTime?: number; // 新增：预计结束时间
  error?: string;
  metadata?: Record<string, any>;
  dependencies?: string[]; // 依赖的任务ID列表
  retryCount?: number; // 重试次数
  maxRetries?: number; // 最大重试次数
}

interface AppState {
  // 用户状态
  user: User | null;
  token: string | null;
  
  // 连接状态
  wsConnected: boolean;
  wsReconnecting: boolean;
  
  // 治理层状态
  governanceStatus: GovernanceStatus | null;
  
  // 渠道状态
  channels: ChannelStatus[];
  
  // 通知系统
  notifications: Notification[];
  unreadCount: number;
  
  // 任务状态
  runningTasks: RunningTask[];
  
  // UI 状态
  taskSearchQuery: string; // 任务搜索关键词
  taskGroupFilter: TaskGroup | 'all'; // 任务分组过滤
  taskDurationFilter: TaskDuration | 'all'; // 新增：任务时长过滤

  // Actions
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  setWSConnected: (connected: boolean) => void;
  setWSReconnecting: (reconnecting: boolean) => void;
  updateGovernanceStatus: (status: GovernanceStatus) => void;
  setChannels: (channels: ChannelStatus[]) => void;
  
  // 通知相关 Actions
  addNotification: (type: NotificationType, title: string, message: string, action?: Notification['action']) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
  
  // 任务相关 Actions
  addTask: (task: Omit<RunningTask, 'id' | 'startTime' | 'status'>) => string;
  updateTaskProgress: (taskId: string, progress: number) => void;
  completeTask: (taskId: string, error?: string) => void;
  cancelTask: (taskId: string) => void;
  removeTask: (taskId: string) => void;
  clearCompletedTasks: () => void;
  retryTask: (taskId: string) => string; // 新增：重试任务
  setTaskSearchQuery: (query: string) => void; // 设置搜索关键词
  setTaskGroupFilter: (group: TaskGroup | 'all') => void; // 设置分组过滤
  setTaskDurationFilter: (duration: TaskDuration | 'all') => void; // 新增：设置时长过滤
  
  // API 集成方法
  loadGovernanceStatus: () => Promise<boolean>;
  loadChannels: () => Promise<boolean>;
  connectChannel: (channelId: string) => Promise<boolean>;
  disconnectChannel: (channelId: string) => Promise<boolean>;
  checkHealth: () => Promise<boolean>;

}

export const useAppStore = create<AppState>()(
  subscribeWithSelector((set) => ({

    // 初始状态
    user: null,
    token: null,
    wsConnected: false,
    wsReconnecting: false,
    governanceStatus: null,
    channels: [],
    notifications: [],
    unreadCount: 0,
    runningTasks: [],
    taskSearchQuery: '',
    taskGroupFilter: 'all',
    taskDurationFilter: 'all',

    // Actions
    setUser: (user) => set({ user }),
    setToken: (token) => set({ token }),
    setWSConnected: (connected) => set({ wsConnected: connected }),
    setWSReconnecting: (reconnecting) => set({ wsReconnecting: reconnecting }),
    updateGovernanceStatus: (status) => set({ governanceStatus: status }),
    setChannels: (channels) => set({ channels }),
    
    // 通知相关 Actions
    addNotification: (type, title, message, action) => {
      const id = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const notification: Notification = {
        id,
        type,
        title,
        message,
        timestamp: Date.now(),
        read: false,
        action,
      };
      
      set((state: AppState) => ({
        notifications: [notification, ...state.notifications].slice(0, 50), // 最多保留50条
        unreadCount: state.unreadCount + 1,
      }));
      
      // 显示浏览器通知（如果权限允许）
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, {
          body: message,
          icon: '/icon.png',
        });
      }
    },
    
    markAsRead: (id) => {
      set((state: AppState) => {
        const notification = state.notifications.find((n: Notification) => n.id === id);
        if (!notification || notification.read) return state;
        
        return {
          notifications: state.notifications.map((n: Notification) =>
            n.id === id ? { ...n, read: true } : n
          ),
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
    
    clearNotifications: () => {
      set({ notifications: [], unreadCount: 0 });
    },
    
    // 任务相关 Actions
    addTask: (task) => {
      const id = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const newTask: RunningTask = {
        ...task,
        id,
        status: 'running',
        startTime: Date.now(),
        progress: 0,
      };
      
      set((state: AppState) => ({
        runningTasks: [newTask, ...state.runningTasks],
      }));
      
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
            ? {
                ...task,
                status: error ? 'failed' : 'completed',
                progress: error ? task.progress : 100,
                endTime: Date.now(),
                error,
              }
            : task
        ),
      }));
    },
    
    cancelTask: (taskId) => {
      set((state: AppState) => ({
        runningTasks: state.runningTasks.map((task: RunningTask) =>
          task.id === taskId
            ? {
                ...task,
                status: 'cancelled',
                endTime: Date.now(),
              }
            : task
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
    
    // 重试失败的任务
    retryTask: (taskId) => {
      let newTaskId = '';
      
      set((state: AppState) => {
        const task = state.runningTasks.find((t: RunningTask) => t.id === taskId);
        if (!task || task.status !== 'failed') {
          return state;
        }
        
        // 创建新任务（复制原任务的配置）
        newTaskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const retriedTask: RunningTask = {
          ...task,
          id: newTaskId,
          status: 'running',
          progress: 0,
          startTime: Date.now(),
          endTime: undefined,
          error: undefined,
          retryCount: (task.retryCount || 0) + 1,
        };
        
        return {
          runningTasks: [retriedTask, ...state.runningTasks],
        };
      });
      
      return newTaskId;
    },
    
    // 设置搜索关键词
    setTaskSearchQuery: (query) => {
      set({ taskSearchQuery: query });
    },
    
    // 设置分组过滤
    setTaskGroupFilter: (group) => {
      set({ taskGroupFilter: group });
    },
    
    // 设置时长过滤
    setTaskDurationFilter: (duration) => {
      set({ taskDurationFilter: duration });
    },
    
    // ==================== API 集成方法 ====================
    
    /**
     * 从后端加载治理状态
     */
    loadGovernanceStatus: async () => {
      try {
        const response = await apiService.getGovernanceStatus();
        if (response.success && response.data) {
          set({ governanceStatus: response.data });
          return true;
        }
        return false;
      } catch (error) {
        console.error('[useAppStore] 加载治理状态失败:', error);
        return false;
      }
    },
    
    /**
     * 从后端加载渠道列表
     */
    loadChannels: async () => {
      try {
        const response = await apiService.getChannels();
        if (response.success && response.data) {
          set({ channels: response.data as any });
          return true;
        }
        return false;
      } catch (error) {
        console.error('[useAppStore] 加载渠道列表失败:', error);
        return false;
      }
    },
    
    /**
     * 连接渠道
     */
    connectChannel: async (channelId: string) => {
      try {
        const response = await apiService.connectChannel(channelId);
        if (response.success) {
          // 更新本地状态
          set((state: AppState) => ({
            channels: state.channels.map((ch: any) =>
              ch.id === channelId ? { ...ch, connected: true } : ch
            ),
          }));
          return true;
        }
        return false;
      } catch (error) {
        console.error('[useAppStore] 连接渠道失败:', error);
        return false;
      }
    },
    
    /**
     * 断开渠道
     */
    disconnectChannel: async (channelId: string) => {
      try {
        const response = await apiService.disconnectChannel(channelId);
        if (response.success) {
          // 更新本地状态
          set((state: AppState) => ({
            channels: state.channels.map((ch: any) =>
              ch.id === channelId ? { ...ch, connected: false } : ch
            ),
          }));
          return true;
        }
        return false;
      } catch (error) {
        console.error('[useAppStore] 断开渠道失败:', error);
        return false;
      }
    },
    
    /**
     * 健康检查
     */
    checkHealth: async () => {
      try {
        const response = await apiService.healthCheck();
        return response.success;
      } catch (error) {
        console.error('[useAppStore] 健康检查失败:', error);
        return false;
      }
    },

  }))
);
