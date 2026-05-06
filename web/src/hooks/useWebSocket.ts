import { useEffect, useRef, useCallback, useState } from 'react';
import { useAppStore } from '../stores/useAppStore';
import { wsManager } from '../services/ws-manager';
import { adaptGovernanceStatus } from '../services/api';
import type { GovernanceStatus } from '../types';

export function useWebSocket() {
  const { setWSConnected, setWSReconnecting, updateGovernanceStatus } = useAppStore();
  const [authenticated, setAuthenticated] = useState(false);
  const initializedRef = useRef(false);

  const handleGovernanceEvent = useCallback((event: { type: string; payload: any }) => {
    if (event.type.startsWith('governance.')) {
      if (event.payload) {
        updateGovernanceStatus(adaptGovernanceStatus(event.payload) as GovernanceStatus);
      }
    }
  }, [updateGovernanceStatus]);

  useEffect(() => {
    wsManager.onConnectionChange = (connected) => {
      setWSConnected(connected);
      if (!connected) {
        setAuthenticated(false);
        setWSReconnecting(true);
      }
    };

    wsManager.onAuthChange = (auth) => {
      setAuthenticated(auth);
      if (auth) {
        setWSReconnecting(false);
      }
    };
  }, [setWSConnected, setWSReconnecting]);

  useEffect(() => {
    const unsub = wsManager.onEvent('governance.*', handleGovernanceEvent);
    return unsub;
  }, [handleGovernanceEvent]);

  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;

      const token = localStorage.getItem('gatewayToken')
        || (import.meta as any).env?.VITE_ZHUSHOU_GATEWAY_TOKEN
        || 'dev-token-123';
      wsManager.setToken(token);
      wsManager.connect();
    }
  }, []);

  const reconnect = useCallback(() => {
    wsManager.disconnect();
    setTimeout(() => wsManager.connect(), 100);
  }, []);

  const disconnect = useCallback(() => {
    wsManager.disconnect();
  }, []);

  return {
    connected: wsManager.isConnected,
    authenticated,
    reconnect,
    disconnect,
  };
}
