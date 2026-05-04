import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { GovernanceStatus, ChannelStatus, User } from '../types';

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
  
  // Actions
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  setWSConnected: (connected: boolean) => void;
  setWSReconnecting: (reconnecting: boolean) => void;
  updateGovernanceStatus: (status: GovernanceStatus) => void;
  setChannels: (channels: ChannelStatus[]) => void;
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
    
    // Actions
    setUser: (user) => set({ user }),
    setToken: (token) => set({ token }),
    setWSConnected: (connected) => set({ wsConnected: connected }),
    setWSReconnecting: (reconnecting) => set({ wsReconnecting: reconnecting }),
    updateGovernanceStatus: (status) => set({ governanceStatus: status }),
    setChannels: (channels) => set({ channels }),
  }))
);
