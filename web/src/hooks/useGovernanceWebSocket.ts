import { useEffect, useCallback, useRef } from 'react';
import { useAppStore } from '../stores/useAppStore';
import type { GovernanceStatus } from '../types';

/**
 * 治理层 WebSocket Hook
 * 
 * 提供治理状态的实时更新功能，包括：
 * - 代理组织状态
 * - 演化项目状态
 * - 冻结状态
 * - 沙盒实验状态
 * - 资产提升流水线
 */

interface UseGovernanceWebSocketOptions {
  /** WebSocket 服务器地址，默认使用当前 host */
  wsUrl?: string;
  
  /** 是否启用自动重连，默认 true */
  autoReconnect?: boolean;
  
  /** 重连间隔（毫秒），默认 5000 */
  reconnectInterval?: number;
  
  /** 最大重连次数，默认 10 */
  maxReconnectAttempts?: number;
}

interface UseGovernanceWebSocketReturn {
  /** WebSocket 连接状态 */
  connected: boolean;
  
  /** 连接错误 */
  error: Error | null;
  
  /** 手动重新连接 */
  reconnect: () => void;
  
  /** 断开连接 */
  disconnect: () => void;
  
  /** 最后更新时间 */
  lastUpdate: number | null;
}

export function useGovernanceWebSocket(
  options: UseGovernanceWebSocketOptions = {}
): UseGovernanceWebSocketReturn {
  const {
    wsUrl,
    autoReconnect = true,
    reconnectInterval = 5000,
    maxReconnectAttempts = 10,
  } = options;
  
  const { setGovernanceStatus, governanceStatus } = useAppStore();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // 连接状态
  const connected = wsRef.current?.readyState === WebSocket.OPEN;
  const error = useRef<Error | null>(null);
  const lastUpdate = useRef<number | null>(null);
  
  /**
   * 建立 WebSocket 连接
   */
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log('[useGovernanceWebSocket] 已连接，无需重复连接');
      return;
    }
    
    // 清除之前的重连定时器
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    
    try {
      const url = wsUrl || `ws://${window.location.host}/ws/governance`;
      console.log(`[useGovernanceWebSocket] 连接到: ${url}`);
      
      const ws = new WebSocket(url);
      wsRef.current = ws;
      
      ws.onopen = () => {
        console.log('[useGovernanceWebSocket] 连接成功');
        reconnectAttemptsRef.current = 0;
        error.current = null;
        
        // 订阅治理状态更新
        ws.send(JSON.stringify({
          type: 'subscribe',
          channel: 'governance',
        }));
      };
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'governance_update') {
            console.log('[useGovernanceWebSocket] 收到治理状态更新');
            setGovernanceStatus(data.payload as GovernanceStatus);
            lastUpdate.current = Date.now();
          } else if (data.type === 'error') {
            console.error('[useGovernanceWebSocket] 收到错误:', data.message);
          }
        } catch (err) {
          console.error('[useGovernanceWebSocket] 解析消息失败:', err);
        }
      };
      
      ws.onerror = (event) => {
        console.error('[useGovernanceWebSocket] WebSocket 错误:', event);
        error.current = new Error('WebSocket connection error');
      };
      
      ws.onclose = (event) => {
        console.log(`[useGovernanceWebSocket] 连接关闭: code=${event.code}, reason=${event.reason}`);
        wsRef.current = null;
        
        // 自动重连
        if (autoReconnect && reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current++;
          console.log(`[useGovernanceWebSocket] ${reconnectInterval / 1000}秒后尝试重连 (${reconnectAttemptsRef.current}/${maxReconnectAttempts})`);
          
          reconnectTimerRef.current = setTimeout(() => {
            connect();
          }, reconnectInterval);
        } else if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
          console.error('[useGovernanceWebSocket] 达到最大重连次数，停止重连');
          error.current = new Error('Max reconnection attempts reached');
        }
      };
    } catch (err) {
      console.error('[useGovernanceWebSocket] 连接失败:', err);
      error.current = err instanceof Error ? err : new Error(String(err));
    }
  }, [wsUrl, autoReconnect, reconnectInterval, maxReconnectAttempts, setGovernanceStatus]);
  
  /**
   * 手动重新连接
   */
  const reconnect = useCallback(() => {
    console.log('[useGovernanceWebSocket] 手动重连');
    reconnectAttemptsRef.current = 0;
    disconnect();
    connect();
  }, [connect]);
  
  /**
   * 断开连接
   */
  const disconnect = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    
    if (wsRef.current) {
      console.log('[useGovernanceWebSocket] 断开连接');
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);
  
  // 组件挂载时建立连接
  useEffect(() => {
    connect();
    
    // 组件卸载时清理
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);
  
  return {
    connected,
    error: error.current,
    reconnect,
    disconnect,
    lastUpdate: lastUpdate.current,
  };
}

/**
 * 治理状态缓存 Hook
 * 
 * 提供离线缓存支持，当 WebSocket 断开时使用缓存数据
 */
export function useGovernanceCache() {
  const { governanceStatus, setGovernanceStatus } = useAppStore();
  const cacheKey = 'governance_status_cache';
  
  /**
   * 从缓存加载
   */
  const loadFromCache = useCallback(() => {
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const data = JSON.parse(cached);
        console.log('[useGovernanceCache] 从缓存加载治理状态');
        setGovernanceStatus(data);
        return data;
      }
    } catch (err) {
      console.error('[useGovernanceCache] 加载缓存失败:', err);
    }
    return null;
  }, [setGovernanceStatus]);
  
  /**
   * 保存到缓存
   */
  const saveToCache = useCallback((status: GovernanceStatus) => {
    try {
      localStorage.setItem(cacheKey, JSON.stringify(status));
      console.log('[useGovernanceCache] 治理状态已保存到缓存');
    } catch (err) {
      console.error('[useGovernanceCache] 保存缓存失败:', err);
    }
  }, []);
  
  /**
   * 清除缓存
   */
  const clearCache = useCallback(() => {
    try {
      localStorage.removeItem(cacheKey);
      console.log('[useGovernanceCache] 缓存已清除');
    } catch (err) {
      console.error('[useGovernanceCache] 清除缓存失败:', err);
    }
  }, []);
  
  // 当治理状态更新时自动缓存
  useEffect(() => {
    if (governanceStatus) {
      saveToCache(governanceStatus);
    }
  }, [governanceStatus, saveToCache]);
  
  return {
    loadFromCache,
    saveToCache,
    clearCache,
  };
}
