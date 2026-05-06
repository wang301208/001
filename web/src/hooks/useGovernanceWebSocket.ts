import { useEffect, useCallback, useRef, useState } from 'react';
import { useAppStore } from '../stores/useAppStore';
import { wsManager } from '../services/ws-manager';
import { adaptGovernanceStatus } from '../services/api';
import type { GovernanceStatus } from '../types';

interface UseGovernanceWebSocketReturn {
  connected: boolean;
  error: Error | null;
  reconnect: () => void;
  disconnect: () => void;
  lastUpdate: number | null;
}

export function useGovernanceWebSocket(): UseGovernanceWebSocketReturn {
  const { updateGovernanceStatus } = useAppStore();
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);
  const error = useRef<Error | null>(null);

  const handleGovernanceEvent = useCallback((event: { type: string; payload: any }) => {
    if (event.type.startsWith('governance.') && event.payload) {
      updateGovernanceStatus(adaptGovernanceStatus(event.payload) as GovernanceStatus);
      setLastUpdate(Date.now());
      error.current = null;
    }
  }, [updateGovernanceStatus]);

  useEffect(() => {
    const unsub = wsManager.onEvent('governance.*', handleGovernanceEvent);
    return unsub;
  }, [handleGovernanceEvent]);

  const reconnect = useCallback(() => {
    wsManager.disconnect();
    setTimeout(() => {
      wsManager.connect();
    }, 100);
  }, []);

  const disconnect = useCallback(() => {
    wsManager.disconnect();
  }, []);

  return {
    connected: wsManager.isConnected,
    error: error.current,
    reconnect,
    disconnect,
    lastUpdate,
  };
}

export function useGovernanceCache() {
  const { governanceStatus, updateGovernanceStatus: setStatus } = useAppStore();
  const cacheKey = 'governance_status_cache';

  const loadFromCache = useCallback(() => {
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const data = JSON.parse(cached);
        setStatus(data);
        return data;
      }
    } catch (err) {
      console.error('[useGovernanceCache] 加载缓存失败:', err);
    }
    return null;
  }, [setStatus]);

  const saveToCache = useCallback((status: GovernanceStatus) => {
    try {
      localStorage.setItem(cacheKey, JSON.stringify(status));
    } catch (err) {
      console.error('[useGovernanceCache] 保存缓存失败:', err);
    }
  }, []);

  const clearCache = useCallback(() => {
    try {
      localStorage.removeItem(cacheKey);
    } catch (err) {
      console.error('[useGovernanceCache] 清除缓存失败:', err);
    }
  }, []);

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
