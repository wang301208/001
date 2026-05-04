/**
 * 监控告警完善模块
 * 
 * 提供指标收集、通知渠道、告警规则等功能
 */

import { createSubsystemLogger } from '../logging/subsystem.js';
import type { EvolutionProject } from './proposals.js';
import type { SandboxUniverse } from './sandbox-universe.js';

const log = createSubsystemLogger('monitoring-alerting');

// ==================== 指标收集器 ====================

export interface MetricData {
  name: string;
  value: number;
  labels?: Record<string, string>;
  timestamp?: number;
}

export class MetricsCollector {
  private metrics: MetricData[] = [];
  private maxMetrics: number;
  private listeners: Array<(metric: MetricData) => void> = [];

  constructor(maxMetrics: number = 100000) {
    this.maxMetrics = maxMetrics;
  }

  /**
   * 记录指标
   */
  record(metric: MetricData): void {
    const data: MetricData = {
      ...metric,
      timestamp: metric.timestamp ?? Date.now(),
    };

    this.metrics.push(data);

    // 限制指标数量
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }

    // 通知监听器
    this.listeners.forEach((listener) => {
      try {
        listener(data);
      } catch (error) {
        log.error('Metric listener error:', error);
      }
    });
  }

  /**
   * 记录计数器指标
   */
  increment(name: string, value: number = 1, labels?: Record<string, string>): void {
    this.record({ name, value, labels });
  }

  /**
   * 记录仪表盘指标
   */
  gauge(name: string, value: number, labels?: Record<string, string>): void {
    this.record({ name, value, labels });
  }

  /**
   * 记录直方图指标
   */
  histogram(name: string, value: number, labels?: Record<string, string>): void {
    this.record({ name, value, labels });
  }

  /**
   * 查询指标
   */
  query(
    name: string,
    timeRange?: { start: number; end: number },
    labels?: Record<string, string>
  ): MetricData[] {
    let result = this.metrics.filter((m) => m.name === name);

    if (timeRange) {
      result = result.filter(
        (m) => m.timestamp! >= timeRange.start && m.timestamp! <= timeRange.end
      );
    }

    if (labels) {
      result = result.filter((m) => {
        if (!m.labels) return false;
        return Object.entries(labels).every(([key, value]) => m.labels![key] === value);
      });
    }

    return result;
  }

  /**
   * 聚合指标
   */
  aggregate(
    name: string,
    aggregation: 'sum' | 'avg' | 'min' | 'max' | 'count',
    timeRange?: { start: number; end: number }
  ): number {
    const metrics = this.query(name, timeRange);
    const values = metrics.map((m) => m.value);

    if (values.length === 0) {
      return 0;
    }

    switch (aggregation) {
      case 'sum':
        return values.reduce((a, b) => a + b, 0);
      case 'avg':
        return values.reduce((a, b) => a + b, 0) / values.length;
      case 'min':
        return Math.min(...values);
      case 'max':
        return Math.max(...values);
      case 'count':
        return values.length;
      default:
        return 0;
    }
  }

  /**
   * 添加监听器
   */
  onMetric(listener: (metric: MetricData) => void): () => void {
    this.listeners.push(listener);

    // 返回取消订阅函数
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index !== -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * 清除指标
   */
  clear(): void {
    this.metrics = [];
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    totalMetrics: number;
    uniqueNames: number;
    oldestTimestamp: number | null;
    newestTimestamp: number | null;
  } {
    if (this.metrics.length === 0) {
      return {
        totalMetrics: 0,
        uniqueNames: 0,
        oldestTimestamp: null,
        newestTimestamp: null,
      };
    }

    const names = new Set(this.metrics.map((m) => m.name));
    const timestamps = this.metrics.map((m) => m.timestamp!).filter((t) => t != null);

    return {
      totalMetrics: this.metrics.length,
      uniqueNames: names.size,
      oldestTimestamp: Math.min(...timestamps),
      newestTimestamp: Math.max(...timestamps),
    };
  }
}

// ==================== 通知渠道 ====================

export interface NotificationChannel {
  id: string;
  name: string;
  type: 'email' | 'slack' | 'webhook' | 'console' | 'custom';
  config: Record<string, any>;
  enabled: boolean;
}

export interface AlertNotification {
  alertId: string;
  alertName: string;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  metadata?: Record<string, any>;
  timestamp: number;
}

export class NotificationManager {
  private channels: Map<string, NotificationChannel> = new Map();
  private notificationHistory: AlertNotification[] = [];
  private maxHistory: number;

  constructor(maxHistory: number = 10000) {
    this.maxHistory = maxHistory;
  }

  /**
   * 注册通知渠道
   */
  registerChannel(channel: NotificationChannel): void {
    this.channels.set(channel.id, channel);
    log.info(`Notification channel registered: ${channel.name} (${channel.type})`);
  }

  /**
   * 注销通知渠道
   */
  unregisterChannel(channelId: string): boolean {
    const deleted = this.channels.delete(channelId);
    if (deleted) {
      log.info(`Notification channel unregistered: ${channelId}`);
    }
    return deleted;
  }

  /**
   * 发送通知
   */
  async send(notification: AlertNotification, channelIds?: string[]): Promise<void> {
    // 记录到历史
    this.notificationHistory.push(notification);
    if (this.notificationHistory.length > this.maxHistory) {
      this.notificationHistory = this.notificationHistory.slice(-this.maxHistory);
    }

    // 确定要使用的渠道
    const targetChannels = channelIds
      ? channelIds
          .map((id) => this.channels.get(id))
          .filter((c): c is NotificationChannel => c != null && c.enabled)
      : Array.from(this.channels.values()).filter((c) => c.enabled);

    if (targetChannels.length === 0) {
      log.warn('No enabled notification channels available');
      return;
    }

    // 并行发送到所有渠道
    const promises = targetChannels.map((channel) =>
      this.sendToChannel(channel, notification).catch((error) => {
        log.error(`Failed to send notification to channel ${channel.name}:`, error);
      })
    );

    await Promise.allSettled(promises);
  }

  /**
   * 发送到特定渠道
   */
  private async sendToChannel(
    channel: NotificationChannel,
    notification: AlertNotification
  ): Promise<void> {
    switch (channel.type) {
      case 'console':
        this.sendToConsole(notification);
        break;
      case 'webhook':
        await this.sendToWebhook(channel, notification);
        break;
      case 'email':
        await this.sendToEmail(channel, notification);
        break;
      case 'slack':
        await this.sendToSlack(channel, notification);
        break;
      case 'custom':
        await this.sendToCustom(channel, notification);
        break;
      default:
        log.warn(`Unsupported channel type: ${channel.type}`);
    }
  }

  /**
   * 控制台输出
   */
  private sendToConsole(notification: AlertNotification): void {
    const emoji =
      notification.severity === 'critical'
        ? '🚨'
        : notification.severity === 'warning'
        ? '⚠️'
        : 'ℹ️';

    console.log(
      `${emoji} [${notification.severity.toUpperCase()}] ${notification.alertName}: ${notification.message}`
    );

    if (notification.metadata) {
      console.log('Metadata:', notification.metadata);
    }
  }

  /**
   * Webhook 通知
   */
  private async sendToWebhook(
    channel: NotificationChannel,
    notification: AlertNotification
  ): Promise<void> {
    const url = channel.config.url;
    if (!url) {
      throw new Error('Webhook URL not configured');
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...channel.config.headers,
      },
      body: JSON.stringify(notification),
    });

    if (!response.ok) {
      throw new Error(`Webhook request failed: ${response.status} ${response.statusText}`);
    }
  }

  /**
   * 邮件通知（需要配置 SMTP）
   */
  private async sendToEmail(
    channel: NotificationChannel,
    notification: AlertNotification
  ): Promise<void> {
    // TODO: 实现 SMTP 邮件发送
    log.warn('Email notification not yet implemented');
  }

  /**
   * Slack 通知
   */
  private async sendToSlack(
    channel: NotificationChannel,
    notification: AlertNotification
  ): Promise<void> {
    const webhookUrl = channel.config.webhookUrl;
    if (!webhookUrl) {
      throw new Error('Slack webhook URL not configured');
    }

    const color =
      notification.severity === 'critical'
        ? '#ff0000'
        : notification.severity === 'warning'
        ? '#ffa500'
        : '#36a64f';

    const payload = {
      attachments: [
        {
          color,
          title: notification.alertName,
          text: notification.message,
          fields: [
            {
              title: 'Severity',
              value: notification.severity,
              short: true,
            },
            {
              title: 'Time',
              value: new Date(notification.timestamp).toISOString(),
              short: true,
            },
          ],
          ...(notification.metadata && {
            fields: [
              ...Object.entries(notification.metadata).map(([key, value]) => ({
                title: key,
                value: String(value),
                short: true,
              })),
            ],
          }),
        },
      ],
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Slack webhook failed: ${response.status} ${response.statusText}`);
    }
  }

  /**
   * 自定义通知
   */
  private async sendToCustom(
    channel: NotificationChannel,
    notification: AlertNotification
  ): Promise<void> {
    const handler = channel.config.handler;
    if (typeof handler === 'function') {
      await handler(notification);
    } else {
      throw new Error('Custom channel handler not configured');
    }
  }

  /**
   * 获取通知历史
   */
  getHistory(filter?: {
    severity?: AlertNotification['severity'];
    alertName?: string;
    limit?: number;
  }): AlertNotification[] {
    let result = [...this.notificationHistory];

    if (filter?.severity) {
      result = result.filter((n) => n.severity === filter.severity);
    }

    if (filter?.alertName) {
      result = result.filter((n) => n.alertName === filter.alertName);
    }

    if (filter?.limit) {
      result = result.slice(-filter.limit);
    }

    return result;
  }

  /**
   * 获取所有渠道
   */
  getChannels(): NotificationChannel[] {
    return Array.from(this.channels.values());
  }
}

// ==================== 告警规则引擎 ====================

export interface AlertRule {
  id: string;
  name: string;
  description?: string;
  condition: (metrics: MetricsCollector) => boolean;
  severity: 'critical' | 'warning' | 'info';
  cooldownMs: number; // 冷却时间，防止频繁告警
  channels?: string[]; // 指定通知渠道
  enabled: boolean;
}

interface AlertState {
  lastTriggered: number;
  triggeredCount: number;
}

export class AlertEngine {
  private rules: Map<string, AlertRule> = new Map();
  private states: Map<string, AlertState> = new Map();
  private metricsCollector: MetricsCollector;
  private notificationManager: NotificationManager;
  private checkInterval: NodeJS.Timeout | null = null;

  constructor(
    metricsCollector: MetricsCollector,
    notificationManager: NotificationManager,
    checkIntervalMs: number = 60000 // 默认每分钟检查一次
  ) {
    this.metricsCollector = metricsCollector;
    this.notificationManager = notificationManager;

    // 启动定期检查
    this.startChecking(checkIntervalMs);
  }

  /**
   * 注册告警规则
   */
  registerRule(rule: AlertRule): void {
    this.rules.set(rule.id, rule);
    this.states.set(rule.id, { lastTriggered: 0, triggeredCount: 0 });
    log.info(`Alert rule registered: ${rule.name}`);
  }

  /**
   * 注销告警规则
   */
  unregisterRule(ruleId: string): boolean {
    const deleted = this.rules.delete(ruleId);
    this.states.delete(ruleId);
    if (deleted) {
      log.info(`Alert rule unregistered: ${ruleId}`);
    }
    return deleted;
  }

  /**
   * 手动触发检查
   */
  async check(): Promise<void> {
    const now = Date.now();

    for (const [ruleId, rule] of this.rules.entries()) {
      if (!rule.enabled) {
        continue;
      }

      const state = this.states.get(ruleId)!;

      // 检查冷却时间
      if (now - state.lastTriggered < rule.cooldownMs) {
        continue;
      }

      try {
        // 评估条件
        const triggered = rule.condition(this.metricsCollector);

        if (triggered) {
          // 触发告警
          await this.triggerAlert(rule);
          state.lastTriggered = now;
          state.triggeredCount++;
        }
      } catch (error) {
        log.error(`Error evaluating alert rule ${rule.name}:`, error);
      }
    }
  }

  /**
   * 触发告警
   */
  private async triggerAlert(rule: AlertRule): Promise<void> {
    const notification: AlertNotification = {
      alertId: rule.id,
      alertName: rule.name,
      severity: rule.severity,
      message: rule.description ?? `Alert triggered: ${rule.name}`,
      timestamp: Date.now(),
    };

    log.warn(`Alert triggered: ${rule.name} (${rule.severity})`);

    await this.notificationManager.send(notification, rule.channels);
  }

  /**
   * 启动定期检查
   */
  private startChecking(intervalMs: number): void {
    this.checkInterval = setInterval(() => {
      this.check().catch((error) => {
        log.error('Alert check failed:', error);
      });
    }, intervalMs);
  }

  /**
   * 停止定期检查
   */
  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      log.info('Alert engine stopped');
    }
  }

  /**
   * 获取告警规则列表
   */
  getRules(): AlertRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * 获取告警状态
   */
  getStates(): Record<string, AlertState> {
    const result: Record<string, AlertState> = {};
    for (const [ruleId, state] of this.states.entries()) {
      result[ruleId] = { ...state };
    }
    return result;
  }
}

// ==================== 预定义告警规则 ====================

export function createCommonAlertRules(
  metricsCollector: MetricsCollector
): AlertRule[] {
  return [
    // 高错误率告警
    {
      id: 'high-error-rate',
      name: 'High Error Rate',
      description: 'Error rate exceeds 5% in the last 5 minutes',
      condition: (collector) => {
        const errors = collector.aggregate('error_count', 'sum', {
          start: Date.now() - 5 * 60 * 1000,
          end: Date.now(),
        });
        const total = collector.aggregate('request_count', 'sum', {
          start: Date.now() - 5 * 60 * 1000,
          end: Date.now(),
        });
        return total > 0 && errors / total > 0.05;
      },
      severity: 'critical',
      cooldownMs: 5 * 60 * 1000, // 5 minutes
      enabled: true,
    },

    // 高延迟告警
    {
      id: 'high-latency',
      name: 'High Latency',
      description: 'Average latency exceeds 1000ms in the last 5 minutes',
      condition: (collector) => {
        const avgLatency = collector.aggregate('request_latency', 'avg', {
          start: Date.now() - 5 * 60 * 1000,
          end: Date.now(),
        });
        return avgLatency > 1000;
      },
      severity: 'warning',
      cooldownMs: 5 * 60 * 1000,
      enabled: true,
    },

    // 资源使用率告警
    {
      id: 'high-resource-usage',
      name: 'High Resource Usage',
      description: 'Resource usage exceeds 90%',
      condition: (collector) => {
        const usage = collector.aggregate('resource_usage_percent', 'avg', {
          start: Date.now() - 5 * 60 * 1000,
          end: Date.now(),
        });
        return usage > 90;
      },
      severity: 'warning',
      cooldownMs: 10 * 60 * 1000, // 10 minutes
      enabled: true,
    },

    // 沙盒失败告警
    {
      id: 'sandbox-failure',
      name: 'Sandbox Failure',
      description: 'Sandbox execution failures detected',
      condition: (collector) => {
        const failures = collector.aggregate('sandbox_failure_count', 'sum', {
          start: Date.now() - 5 * 60 * 1000,
          end: Date.now(),
        });
        return failures > 0;
      },
      severity: 'critical',
      cooldownMs: 5 * 60 * 1000,
      enabled: true,
    },

    // Genesis Team 异常告警
    {
      id: 'genesis-team-anomaly',
      name: 'Genesis Team Anomaly',
      description: 'Genesis Team automation loop has issues',
      condition: (collector) => {
        const stalledProjects = collector.aggregate(
          'genesis_stalled_projects',
          'sum',
          {
            start: Date.now() - 30 * 60 * 1000,
            end: Date.now(),
          }
        );
        return stalledProjects > 3;
      },
      severity: 'warning',
      cooldownMs: 15 * 60 * 1000, // 15 minutes
      enabled: true,
    },
  ];
}

// ==================== 导出单例实例 ====================

export const metricsCollector = new MetricsCollector();

export const notificationManager = new NotificationManager();

export const alertEngine = new AlertEngine(metricsCollector, notificationManager);

// 注册常用告警规则
createCommonAlertRules(metricsCollector).forEach((rule) => {
  alertEngine.registerRule(rule);
});

// 注册默认控制台通知渠道
notificationManager.registerChannel({
  id: 'console-default',
  name: 'Console Output',
  type: 'console',
  config: {},
  enabled: true,
});
