import { wsManager } from '../services/ws-manager';

const AUTH_TOKEN_KEY = 'gatewayToken';

export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;

  const storedToken = localStorage.getItem(AUTH_TOKEN_KEY);
  if (storedToken) return storedToken;

  const envToken = import.meta.env.VITE_ZHUSHOU_GATEWAY_TOKEN;
  if (envToken) return envToken;

  return 'dev-token-123';
}

export function setAuthToken(token: string | null): void {
  if (typeof window === 'undefined') return;

  if (token) {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
  } else {
    localStorage.removeItem(AUTH_TOKEN_KEY);
  }

  wsManager.setToken(token);
}

export function initializeAuth(): void {
  const token = getAuthToken();
  setAuthToken(token);
}
