import { useState, useEffect } from 'react';
import { useAppStore } from '../stores/useAppStore';
import type { TimeSeriesData, ChartDataPoint } from '../types';

/**
 * WebSocket 实时数据 Hook
 * 
 * 从 WebSocket 连接获取实时数据，用于图表展示
 */
export function useRealTimeChartData() {
  const { governanceStatus, wsConnected } = useAppStore();
  
  // 趋势数据 - 从治理状态中提取
  const trendData = useState<TimeSeriesData[]>(() => {
    if (!governanceStatus) return [];
    
    // 模拟从代理活动中提取时间序列数据
    const now = Date.now();
    return governanceStatus.activeAgents.map((_, index) => ({
      timestamp: now - (governanceStatus.activeAgents.length - 1 - index) * 60000,
      value: Math.floor(Math.random() * 100) + 20, // TODO: 替换为真实数据
    }));
  })[0];
  
  // 柱状图数据 - 代理活动统计
  const barData = useState<ChartDataPoint[]>(() => {
    if (!governanceStatus || !governanceStatus.activeAgents.length) return [];
    
    return governanceStatus.activeAgents.slice(0, 5).map(agent => ({
      name: agent.name || `代理${Math.random().toString(36).substr(2, 4)}`,
      value: Math.floor(Math.random() * 50) + 10, // TODO: 替换为真实数据
    }));
  })[0];
  
  // 饼图数据 - 资源分配
  const pieData = useState<ChartDataPoint[]>(() => {
    if (!governanceStatus) return [];
    
    const categories = ['计算', '存储', '网络', '内存', '其他'];
    return categories.map((category) => ({
      name: category,
      value: Math.floor(Math.random() * 30) + 10, // TODO: 替换为真实数据
    }));
  })[0];
  
  // 面积图数据 - 累积性能
  const areaData = useState<TimeSeriesData[]>(() => {
    if (!governanceStatus) return [];
    
    const now = Date.now();
    return Array.from({ length: 20 }, (_, i) => ({
      timestamp: now - (19 - i) * 300000,
      value: Math.floor(Math.random() * 100) + 20, // TODO: 替换为真实数据
    }));
  })[0];
  
  // 雷达图数据 - 能力维度
  const radarData = useState(() => {
    const dimensions = [
      { subject: '计算能力', value: 85, fullMark: 100 },
      { subject: '存储能力', value: 70, fullMark: 100 },
      { subject: '网络能力', value: 90, fullMark: 100 },
      { subject: '学习能力', value: 75, fullMark: 100 },
      { subject: '协作能力', value: 80, fullMark: 100 },
      { subject: '创新能力', value: 65, fullMark: 100 },
    ];
    return dimensions;
  })[0];
  
  // 散点图数据 - 性能分布
  const scatterData = useState(() => {
    return Array.from({ length: 30 }, () => ({
      x: Math.random() * 100,
      y: Math.random() * 100,
      z: Math.random() * 500 + 100,
      name: `节点${Math.floor(Math.random() * 100)}`,
    }));
  })[0];
  
  // 当 WebSocket 连接或治理状态更新时，刷新数据
  useEffect(() => {
    if (wsConnected && governanceStatus) {
      console.log('[useRealTimeChartData] 收到新的治理状态，更新图表数据');
      // TODO: 这里应该根据真实的 governanceStatus 数据结构来更新图表数据
    }
  }, [wsConnected, governanceStatus]);
  
  return {
    trendData,
    barData,
    pieData,
    areaData,
    radarData,
    scatterData,
    isConnected: wsConnected,
  };
}
