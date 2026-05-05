import { useState, useEffect, useCallback } from 'react';
import type { TimeSeriesData, ChartDataPoint } from '../types';

/**
 * 趋势数据 Hook
 * @param initialPoints 初始数据点数量
 * @param updateInterval 更新间隔（毫秒）
 */
export function useTrendData(initialPoints: number = 20, updateInterval: number = 5000) {
  const [data, setData] = useState<TimeSeriesData[]>(() => {
    const now = Date.now();
    return Array.from({ length: initialPoints }, (_, i) => ({
      timestamp: now - (initialPoints - 1 - i) * 300000,
      value: Math.floor(Math.random() * 100) + 20,
    }));
  });

  const updateData = useCallback(() => {
    setData(prev => {
      const newData = [...prev.slice(1), {
        timestamp: Date.now(),
        value: Math.floor(Math.random() * 100) + 20,
      }];
      return newData;
    });
  }, []);

  useEffect(() => {
    const interval = setInterval(updateData, updateInterval);
    return () => clearInterval(interval);
  }, [updateData, updateInterval]);

  return { data, updateData };
}

/**
 * 柱状图数据 Hook
 */
export function useBarData(agentCount: number = 5) {
  const [data, setData] = useState<ChartDataPoint[]>(() => 
    generateBarData(agentCount)
  );

  const refreshData = useCallback(() => {
    setData(generateBarData(agentCount));
  }, [agentCount]);

  return { data, refreshData };
}

/**
 * 饼图数据 Hook
 */
export function usePieData(categoryCount: number = 5) {
  const [data, setData] = useState<ChartDataPoint[]>(() => 
    generatePieData(categoryCount)
  );

  const refreshData = useCallback(() => {
    setData(generatePieData(categoryCount));
  }, [categoryCount]);

  return { data, refreshData };
}

// 辅助函数
function generateBarData(count: number): ChartDataPoint[] {
  return Array.from({ length: count }, (_, i) => ({
    name: `代理${String.fromCharCode(65 + i)}`,
    value: Math.floor(Math.random() * 50) + 10,
  }));
}

function generatePieData(count: number): ChartDataPoint[] {
  const values = Array.from({ length: count }, () => Math.random());
  const sum = values.reduce((a, b) => a + b, 0);
  
  return values.map((v, i) => ({
    name: `类型${String.fromCharCode(65 + i)}`,
    value: Math.round((v / sum) * 100),
  }));
}
