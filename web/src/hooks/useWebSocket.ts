import { useEffect, useRef, useCallback } from 'react';
import { useAppStore } from '../stores/useAppStore';

// WebSocket 消息类型定义
interface WSMessage {
  type: 'event' | 'heartbeat' | 'error' | 'auth_response' | 'res';
  id?: string;
  event?: {
    type: string;
    payload: any;
  };
  success?: boolean;
  error?: string;
  ok?: boolean;
  method?: string;
  params?: any;
}

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const heartbeatTimerRef = useRef<number | null>(null);
  
  const { 
    token, 
    wsConnected, 
    setWSConnected, 
    setWSReconnecting
  } = useAppStore();
  
  // 连接状态引用，用于在回调中访问最新状态
  const stateRef = useRef({
    token,
    wsConnected,
  });
  
  useEffect(() => {
    stateRef.current = { token, wsConnected };
  }, [token, wsConnected]);

  /**
   * 建立 WebSocket 连接
   */
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    // 清除之前的重连定时器
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

    // 获取 Token
    let currentToken = stateRef.current.token;
    
    // [DEBUG] 如果未设置 Token，尝试使用环境变量或默认 Dev Token
    if (!currentToken) {
      // 优先从环境变量获取，如果没有则使用一个明显的开发用占位符，方便识别
      currentToken = (import.meta as any).env?.VITE_WS_TOKEN || 'dev-token-debug';
      console.warn('[useWebSocket] No token in store, using fallback/dev token:', currentToken);
    }

    if (!currentToken) {
      console.error('[useWebSocket] No token available, cannot connect. Please set VITE_WS_TOKEN or login.');
      return;
    }

    try {
      // 构建 WebSocket URL - 连接到同一端口的 /ws 路径
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      
      console.log(`[useWebSocket] Attempting to connect to ${wsUrl}...`);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[useWebSocket] Connection established. Waiting for challenge...');
        setWSConnected(true);
        setWSReconnecting(false);
        
        // 启动心跳
        startHeartbeat();
      };

      ws.onmessage = (event) => {
        try {
          const data: WSMessage = JSON.parse(event.data);
          // console.debug('[useWebSocket] Received message:', data.type);
          
          switch (data.type) {
            case 'event':
              // 处理服务器发送的事件
              if (data.event?.type === 'connect.challenge') {
                console.log('[useWebSocket] Received connect challenge. Sending connect request...');
                
                // 响应挑战，发送 connect 请求
                ws.send(JSON.stringify({
                  type: 'req',
                  id: `connect-${Date.now()}`,
                  method: 'connect',
                  params: {
                    minProtocol: 1,
                    maxProtocol: 999,
                    client: {
                      id: 'web-console',
                      displayName: '系统 Web Console',
                      version: '2026.4.16',
                      platform: 'web',
                      mode: 'operator-ui',
                    },
                    auth: {
                      token: currentToken,
                    },
                  },
                }));
              } else if (data.event?.type === 'tick') {
                // 心跳响应，忽略
              } else {
                console.log('[useWebSocket] Received event:', data.event?.type);
              }
              break;
              
            case 'res':
              // 处理响应
              if (data.ok) {
                console.log('[useWebSocket] Authentication successful.');
                // 订阅治理层事件
                ws.send(JSON.stringify({
                  type: 'subscribe',
                  patterns: ['governance.*'],
                }));
              } else {
                console.error('[useWebSocket] Authentication failed:', data.error);
                ws.close(1008, 'Auth failed');
              }
              break;
              
            case 'heartbeat':
              // 收到心跳响应，无需特殊处理
              break;
              
            case 'error':
              console.error('[useWebSocket] Server error:', data.error);
              break;
          }
        } catch (err) {
          console.error('[useWebSocket] Failed to parse message:', err, event.data);
        }
      };

      ws.onerror = (error) => {
        console.error('[useWebSocket] Connection error occurred. Check if backend is running on port 18789.', error);
      };

      ws.onclose = (event) => {
        console.log(`[useWebSocket] Connection closed: code=${event.code}, reason=${event.reason || 'No reason provided'}`);
        setWSConnected(false);
        stopHeartbeat();
        
        // 尝试重连 (如果是非正常关闭且不是手动断开)
        if (!event.wasClean && event.code !== 1008) { // 1008 is Auth Failed
          setWSReconnecting(true);
          console.log('[useWebSocket] Will attempt to reconnect in 5 seconds...');
          reconnectTimerRef.current = window.setTimeout(() => {
            connect();
          }, 5000);
        }
      };
    } catch (err) {
      console.error('[useWebSocket] Exception during connection setup:', err);
      setWSConnected(false);
    }
  }, [setWSConnected, setWSReconnecting]);

  /**
   * 启动心跳
   */
  const startHeartbeat = () => {
    stopHeartbeat();
    heartbeatTimerRef.current = window.setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'heartbeat',
          timestamp: Date.now(),
        }));
      }
    }, 30000); // 每30秒发送一次心跳
  };

  /**
   * 停止心跳
   */
  const stopHeartbeat = () => {
    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }
  };

  /**
   * 断开连接
   */
  const disconnect = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    
    stopHeartbeat();
    
    if (wsRef.current) {
      wsRef.current.close(1000, 'Client disconnecting');
      wsRef.current = null;
    }
    
    setWSConnected(false);
  }, [setWSConnected]);

  // 组件挂载时建立连接，卸载时断开
  useEffect(() => {
    // 只要组件挂载就尝试连接，connect 内部会检查 token
    connect();
    
    return () => {
      disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 仅在挂载/卸载时执行，connect 依赖 token 但我们在 connect 内部通过 ref 获取最新 token
  
  return {
    connected: wsConnected,
    reconnect: connect,
    disconnect,
  };
}