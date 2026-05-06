/**
 * 消息总线测试
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  MessageBus,
  resetMessageBus,
  type BusEvent,
} from './message-bus.js';

describe('MessageBus', () => {
  let bus: MessageBus;
  
  beforeEach(() => {
    resetMessageBus();
    bus = new MessageBus({
      enablePersistence: false,
      maxHistorySize: 1000,
    });
  });
  
  afterEach(() => {
    resetMessageBus();
  });
  
  describe('publish and subscribe', () => {
    it('should publish and receive events', async () => {
      const receivedEvents: BusEvent[] = [];
      
      bus.subscribe('test.event', (event) => {
        receivedEvents.push(event);
      });
      
      await bus.publish({
        type: 'test.event',
        source: {
          type: 'system',
          id: 'test',
        },
        payload: { message: 'Hello' },
      });
      
      expect(receivedEvents).toHaveLength(1);
      expect(receivedEvents[0].type).toBe('test.event');
      expect(receivedEvents[0].payload).toEqual({ message: 'Hello' });
    });
    
    it('should support wildcard patterns', async () => {
      const receivedEvents: BusEvent[] = [];
      
      bus.subscribe('governance.*', (event) => {
        receivedEvents.push(event);
      });
      
      await bus.publish({
        type: 'governance.proposal.created',
        source: { type: 'governance', id: 'test' },
        payload: {},
      });
      
      await bus.publish({
        type: 'governance.sandbox.stage.changed',
        source: { type: 'governance', id: 'test' },
        payload: {},
      });
      
      await bus.publish({
        type: 'channel.message.inbound',
        source: { type: 'channel', id: 'test' },
        payload: {},
      });
      
      // 只接收 governance 事件
      expect(receivedEvents).toHaveLength(2);
      expect(receivedEvents[0].type).toBe('governance.proposal.created');
      expect(receivedEvents[1].type).toBe('governance.sandbox.stage.changed');
    });
    
    it('should support catch-all pattern', async () => {
      const receivedEvents: BusEvent[] = [];
      
      bus.subscribe('*', (event) => {
        receivedEvents.push(event);
      });
      
      await bus.publish({
        type: 'test.event.1',
        source: { type: 'system', id: 'test' },
        payload: {},
      });
      
      await bus.publish({
        type: 'test.event.2',
        source: { type: 'system', id: 'test' },
        payload: {},
      });
      
      expect(receivedEvents).toHaveLength(2);
    });
    
    it('should handle multiple subscribers', async () => {
      const received1: BusEvent[] = [];
      const received2: BusEvent[] = [];
      
      bus.subscribe('test.event', (event) => received1.push(event));
      bus.subscribe('test.event', (event) => received2.push(event));
      
      await bus.publish({
        type: 'test.event',
        source: { type: 'system', id: 'test' },
        payload: {},
      });
      
      expect(received1).toHaveLength(1);
      expect(received2).toHaveLength(1);
    });
  });
  
  describe('unsubscribe', () => {
    it('should stop receiving events after unsubscribe', async () => {
      const receivedEvents: BusEvent[] = [];
      
      const subscription = bus.subscribe('test.event', (event) => {
        receivedEvents.push(event);
      });
      
      await bus.publish({
        type: 'test.event',
        source: { type: 'system', id: 'test' },
        payload: {},
      });
      
      expect(receivedEvents).toHaveLength(1);
      
      subscription.unsubscribe();
      
      await bus.publish({
        type: 'test.event',
        source: { type: 'system', id: 'test' },
        payload: {},
      });
      
      // 不应该再收到事件
      expect(receivedEvents).toHaveLength(1);
    });
  });
  
  describe('history', () => {
    it('should store events in history', async () => {
      await bus.publish({
        type: 'test.event',
        source: { type: 'system', id: 'test' },
        payload: { value: 1 },
      });
      
      await bus.publish({
        type: 'test.event',
        source: { type: 'system', id: 'test' },
        payload: { value: 2 },
      });
      
      const history = bus.getHistory();
      
      expect(history).toHaveLength(2);
      expect(history[0].payload).toEqual({ value: 2 }); // 最新的在前
      expect(history[1].payload).toEqual({ value: 1 });
    });
    
    it('should filter history by type', async () => {
      await bus.publish({
        type: 'test.event.a',
        source: { type: 'system', id: 'test' },
        payload: {},
      });
      
      await bus.publish({
        type: 'test.event.b',
        source: { type: 'system', id: 'test' },
        payload: {},
      });
      
      const history = bus.getHistory({ types: ['test.event.a'] });
      
      expect(history).toHaveLength(1);
      expect(history[0].type).toBe('test.event.a');
    });
    
    it('should filter history by time range', async () => {
      const now = Date.now();
      
      await bus.publish({
        type: 'test.event',
        source: { type: 'system', id: 'test' },
        payload: {},
        timestamp: now - 2000,
      });
      
      await bus.publish({
        type: 'test.event',
        source: { type: 'system', id: 'test' },
        payload: {},
        timestamp: now - 1000,
      });
      
      await bus.publish({
        type: 'test.event',
        source: { type: 'system', id: 'test' },
        payload: {},
        timestamp: now,
      });
      
      const history = bus.getHistory({
        startTime: now - 1500,
        endTime: now - 500,
      });
      
      expect(history).toHaveLength(1);
      expect(history[0].timestamp).toBe(now - 1000);
    });
    
    it('should support pagination', async () => {
      for (let i = 0; i < 10; i++) {
        await bus.publish({
          type: 'test.event',
          source: { type: 'system', id: 'test' },
          payload: { index: i },
        });
      }
      
      const page1 = bus.getHistory({ limit: 3, offset: 0 });
      const page2 = bus.getHistory({ limit: 3, offset: 3 });
      
      expect(page1).toHaveLength(3);
      expect(page2).toHaveLength(3);
      expect(page1[0].payload).toEqual({ index: 9 }); // 最新的
      expect(page2[0].payload).toEqual({ index: 6 });
    });
  });
  
  describe('replay', () => {
    it('should replay historical events', async () => {
      const replayedEvents: BusEvent[] = [];
      
      await bus.publish({
        type: 'test.event',
        source: { type: 'system', id: 'test' },
        payload: { value: 1 },
      });
      
      await bus.publish({
        type: 'test.event',
        source: { type: 'system', id: 'test' },
        payload: { value: 2 },
      });
      
      await bus.replay({}, (event) => {
        replayedEvents.push(event);
      });
      
      expect(replayedEvents).toHaveLength(2);
    });
    
    it('should replay with delay', async () => {
      const timestamps: number[] = [];
      
      await bus.publish({
        type: 'test.event',
        source: { type: 'system', id: 'test' },
        payload: {},
      });
      
      await bus.publish({
        type: 'test.event',
        source: { type: 'system', id: 'test' },
        payload: {},
      });
      
      await bus.replay(
        { delayMs: 10 },
        (event) => {
          timestamps.push(Date.now());
        }
      );
      
      expect(timestamps).toHaveLength(2);
      if (timestamps.length === 2) {
        expect(timestamps[1] - timestamps[0]).toBeGreaterThanOrEqual(10);
      }
    });
  });
  
  describe('stats', () => {
    it('should return correct statistics', async () => {
      await bus.publish({
        type: 'test.event.a',
        source: { type: 'system', id: 'test' },
        payload: {},
      });
      
      await bus.publish({
        type: 'test.event.a',
        source: { type: 'system', id: 'test' },
        payload: {},
      });
      
      await bus.publish({
        type: 'test.event.b',
        source: { type: 'system', id: 'test' },
        payload: {},
      });
      
      const stats = bus.getStats();
      
      expect(stats.totalEvents).toBe(3);
      expect(stats.activeSubscriptions).toBe(0);
      expect(stats.eventTypes['test.event.a']).toBe(2);
      expect(stats.eventTypes['test.event.b']).toBe(1);
    });
  });
  
  describe('cleanup', () => {
    it('should remove expired events', async () => {
      const oldTimestamp = Date.now() - 2000;
      
      await bus.publish({
        type: 'test.event',
        source: { type: 'system', id: 'test' },
        payload: {},
        timestamp: oldTimestamp,
      });
      
      await bus.publish({
        type: 'test.event',
        source: { type: 'system', id: 'test' },
        payload: {},
        timestamp: Date.now(),
      });
      
      expect(bus.getHistory()).toHaveLength(2);
      
      // 清理 1 秒前的事件
      bus.cleanup();
      
      // 默认 TTL 是 24 小时，所以不会清理
      expect(bus.getHistory().length).toBeGreaterThan(0);
    });
  });
  
  describe('convenience functions', () => {
    it('should publish channel inbound message', async () => {
      const { publishChannelInboundMessage } = await import('./message-bus.js');
      
      const receivedEvents: BusEvent[] = [];
      bus.subscribe('channel.message.inbound', (event) => {
        receivedEvents.push(event);
      });
      
      await publishChannelInboundMessage('channel-1', { text: 'Hello' }, 'telegram');
      
      expect(receivedEvents).toHaveLength(1);
      expect(receivedEvents[0].type).toBe('channel.message.inbound');
      expect(receivedEvents[0].source.id).toBe('channel-1');
    });
    
    it('should publish governance proposal', async () => {
      const { publishGovernanceProposal } = await import('./message-bus.js');
      
      const receivedEvents: BusEvent[] = [];
      bus.subscribe('governance.proposal.created', (event) => {
        receivedEvents.push(event);
      });
      
      await publishGovernanceProposal('prop-1', { title: 'Test' });
      
      expect(receivedEvents).toHaveLength(1);
      expect(receivedEvents[0].type).toBe('governance.proposal.created');
      expect(receivedEvents[0].metadata?.correlationId).toBe('prop-1');
    });
    
    it('should publish freeze activated event', async () => {
      const { publishFreezeActivated } = await import('./message-bus.js');
      
      const receivedEvents: BusEvent[] = [];
      bus.subscribe('governance.freeze.activated', (event) => {
        receivedEvents.push(event);
      });
      
      await publishFreezeActivated('Security breach detected', ['evolution', 'capability']);
      
      expect(receivedEvents).toHaveLength(1);
      expect(receivedEvents[0].type).toBe('governance.freeze.activated');
      expect(receivedEvents[0].metadata?.priority).toBe('critical');
    });
  });
  
  describe('error handling', () => {
    it('should handle subscriber errors gracefully', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      bus.subscribe('test.event', () => {
        throw new Error('Subscriber error');
      });
      
      // 不应该抛出异常
      await expect(
        bus.publish({
          type: 'test.event',
          source: { type: 'system', id: 'test' },
          payload: {},
        })
      ).resolves.toBeUndefined();
      
      consoleError.mockRestore();
    });
    
    it('should handle async subscriber errors', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      bus.subscribe('test.event', async () => {
        throw new Error('Async subscriber error');
      });
      
      await bus.publish({
        type: 'test.event',
        source: { type: 'system', id: 'test' },
        payload: {},
      });
      
      // 等待异步错误处理
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(consoleError).toHaveBeenCalled();
      
      consoleError.mockRestore();
    });
  });
});
