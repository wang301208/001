import { apiService } from '../services/api';

/**
 * 认证令牌管理
 */

const AUTH_TOKEN_KEY = 'gatewayToken'; // 与 SettingsPage 保持一致

/**
 * 获取认证令牌
 */
export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  
  // 1. 优先从 localStorage 获取用户配置的令牌
  const storedToken = localStorage.getItem(AUTH_TOKEN_KEY);
  if (storedToken) {
    console.log('[Auth] 从 localStorage 加载令牌');
    return storedToken;
  }
  
  // 2. 尝试从环境变量获取（开发环境）
  const envToken = import.meta.env.VITE_ZHUSHOU_GATEWAY_TOKEN;
  if (envToken) {
    console.log('[Auth] 从环境变量加载令牌');
    return envToken;
  }
  
  // 3. 默认使用开发环境令牌
  console.log('[Auth] 使用默认开发令牌');
  return 'dev-token-123';
}

/**
 * 设置认证令牌
 */
export function setAuthToken(token: string | null): void {
  if (typeof window === 'undefined') return;
  
  if (token) {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
    console.log('[Auth] 令牌已保存到 localStorage');
  } else {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    console.log('[Auth] 令牌已从 localStorage 清除');
  }
  
  // 同步更新 API 服务
  apiService.setToken(token);
}

/**
 * 初始化认证
 */
export function initializeAuth(): void {
  const token = getAuthToken();
  setAuthToken(token);
  console.log('[Auth] 认证初始化完成，令牌状态:', token ? '已配置' : '未配置');
}
