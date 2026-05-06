type WSEventHandler = (event: { type: string; payload: any }) => void;

interface PendingRequest {
  resolve: (data: any) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

class WebSocketManager {
  private ws: WebSocket | null = null;
  private token: string | null = null;
  private pendingRequests = new Map<string, PendingRequest>();
  private eventHandlers = new Map<string, Set<WSEventHandler>>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 20;
  private reconnectInterval = 3000;
  private authenticated = false;
  private connecting = false;
  private requestId = 0;
  private defaultTimeout = 30000;

  onConnectionChange?: (connected: boolean) => void;
  onAuthChange?: (authenticated: boolean) => void;

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN && this.authenticated;
  }

  get isConnecting(): boolean {
    return this.connecting;
  }

  setToken(token: string | null): void {
    this.token = token;
  }

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN || this.connecting) return;

    this.connecting = true;
    this.clearReconnectTimer();

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      console.log('[WSManager] 连接到:', wsUrl);

      const ws = new WebSocket(wsUrl);
      this.ws = ws;

      ws.onopen = () => {
        console.log('[WSManager] 连接已建立，等待认证挑战...');
        this.reconnectAttempts = 0;
        this.onConnectionChange?.(true);
        this.startHeartbeat();
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleMessage(data);
        } catch (err) {
          console.error('[WSManager] 解析消息失败:', err);
        }
      };

      ws.onerror = () => {
        console.error('[WSManager] 连接错误');
      };

      ws.onclose = (event) => {
        console.log(`[WSManager] 连接关闭: code=${event.code}`);
        this.connecting = false;
        this.authenticated = false;
        this.onConnectionChange?.(false);
        this.onAuthChange?.(false);
        this.stopHeartbeat();
        this.rejectAllPending('连接已断开');

        if (event.code !== 1008 && event.code !== 1000) {
          this.scheduleReconnect();
        }
      };
    } catch (err) {
      console.error('[WSManager] 连接失败:', err);
      this.connecting = false;
    }
  }

  disconnect(): void {
    this.clearReconnectTimer();
    this.stopHeartbeat();
    this.rejectAllPending('主动断开连接');

    if (this.ws) {
      this.ws.close(1000, 'Client disconnecting');
      this.ws = null;
    }

    this.authenticated = false;
    this.connecting = false;
    this.onConnectionChange?.(false);
    this.onAuthChange?.(false);
  }

  async request(method: string, params?: any, timeout?: number): Promise<any> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket 未连接');
    }

    if (!this.authenticated && method !== 'connect') {
      throw new Error('WebSocket 未认证');
    }

    const reqId = `req_${++this.requestId}_${Date.now()}`;
    const requestTimeout = timeout ?? this.defaultTimeout;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(reqId);
        reject(new Error(`请求超时: ${method} (${requestTimeout}ms)`));
      }, requestTimeout);

      this.pendingRequests.set(reqId, { resolve, reject, timer });

      this.ws!.send(JSON.stringify({
        type: 'req',
        id: reqId,
        method,
        params: params ?? {},
      }));
    });
  }

  subscribe(pattern: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.authenticated) return;

    this.ws.send(JSON.stringify({
      type: 'subscribe',
      patterns: [pattern],
    }));
  }

  unsubscribe(pattern: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    this.ws.send(JSON.stringify({
      type: 'unsubscribe',
      patterns: [pattern],
    }));
  }

  onEvent(pattern: string, handler: WSEventHandler): () => void {
    if (!this.eventHandlers.has(pattern)) {
      this.eventHandlers.set(pattern, new Set());
    }
    this.eventHandlers.get(pattern)!.add(handler);

    return () => {
      this.eventHandlers.get(pattern)?.delete(handler);
    };
  }

  private handleMessage(data: any): void {
    switch (data.type) {
      case 'event': {
        const eventType = data.event?.type;
        const payload = data.event?.payload;

        if (eventType === 'connect.challenge') {
          this.handleAuthChallenge();
        } else {
          this.dispatchEvent(eventType, payload);
        }
        break;
      }

      case 'res': {
        const pending = this.pendingRequests.get(data.id);
        if (pending) {
          clearTimeout(pending.timer);
          this.pendingRequests.delete(data.id);

          if (data.ok || data.success) {
            pending.resolve(data.result ?? data.data ?? data);
          } else {
            pending.reject(new Error(data.error || `请求失败: ${data.id}`));
          }
        }
        break;
      }

      case 'heartbeat':
        break;

      case 'error':
        console.error('[WSManager] 服务端错误:', data.error);
        break;
    }
  }

  private handleAuthChallenge(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const currentToken = this.token
      || localStorage.getItem('gatewayToken')
      || (import.meta as any).env?.VITE_ZHUSHOU_GATEWAY_TOKEN
      || 'dev-token-123';

    this.request('connect', {
      minProtocol: 1,
      maxProtocol: 999,
      client: {
        id: 'web-console',
        displayName: '系统 Web Console',
        version: '2026.4.16',
        platform: 'web',
        mode: 'operator-ui',
      },
      auth: { token: currentToken },
    }, 10000)
      .then(() => {
        console.log('[WSManager] 认证成功');
        this.authenticated = true;
        this.connecting = false;
        this.onAuthChange?.(true);

        this.subscribe('governance.*');
        this.subscribe('session.*');
      })
      .catch((err) => {
        console.error('[WSManager] 认证失败:', err);
        this.authenticated = false;
        this.connecting = false;
        this.onAuthChange?.(false);
        this.ws?.close(1008, 'Auth failed');
      });
  }

  private dispatchEvent(eventType: string, payload: any): void {
    for (const [pattern, handlers] of this.eventHandlers) {
      if (this.matchPattern(pattern, eventType)) {
        handlers.forEach(handler => {
          try {
            handler({ type: eventType, payload });
          } catch (err) {
            console.error('[WSManager] 事件处理器错误:', err);
          }
        });
      }
    }
  }

  private matchPattern(pattern: string, eventType: string): boolean {
    if (pattern === '*') return true;
    if (pattern.endsWith('.*')) {
      return eventType.startsWith(pattern.slice(0, -2));
    }
    return pattern === eventType;
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'heartbeat', timestamp: Date.now() }));
      }
    }, 30000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[WSManager] 达到最大重连次数');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(this.reconnectInterval * Math.pow(1.5, this.reconnectAttempts - 1), 30000);

    console.log(`[WSManager] ${delay / 1000}s 后重连 (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private rejectAllPending(reason: string): void {
    for (const [, pending] of this.pendingRequests) {
      clearTimeout(pending.timer);
      pending.reject(new Error(reason));
    }
    this.pendingRequests.clear();
  }
}

export const wsManager = new WebSocketManager();
