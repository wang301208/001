import { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '../stores/useAppStore';
import type { TimeSeriesData, ChartDataPoint } from '../types';

export function useRealTimeChartData() {
  const { governanceStatus, wsConnected, channels, runningTasks } = useAppStore();

  const generateTrendData = useCallback((): TimeSeriesData[] => {
    const now = Date.now();
    const points: TimeSeriesData[] = [];
    const agentCount = governanceStatus?.activeAgents?.length ?? 0;
    const projectCount = governanceStatus?.evolutionProjects?.length ?? 0;

    for (let i = 19; i >= 0; i--) {
      points.push({
        timestamp: now - i * 60000,
        value: wsConnected
          ? Math.min(100, (agentCount * 15 + projectCount * 10 + Math.sin(i / 3) * 10 + 30))
          : 0,
      });
    }
    return points;
  }, [governanceStatus, wsConnected]);

  const generateBarData = useCallback((): ChartDataPoint[] => {
    if (!governanceStatus?.activeAgents?.length) {
      return [
        { name: '无数据', value: 0 },
      ];
    }
    return governanceStatus.activeAgents.slice(0, 8).map(agent => ({
      name: agent.name || agent.id,
      value: agent.status === 'active' ? 80 : agent.status === 'frozen' ? 30 : 10,
    }));
  }, [governanceStatus]);

  const generatePieData = useCallback((): ChartDataPoint[] => {
    const active = governanceStatus?.activeAgents?.filter(a => a.status === 'active').length ?? 0;
    const frozen = governanceStatus?.activeAgents?.filter(a => a.status === 'frozen').length ?? 0;
    const inactive = governanceStatus?.activeAgents?.filter(a => a.status === 'inactive').length ?? 0;
    const projects = governanceStatus?.evolutionProjects?.length ?? 0;
    const experiments = governanceStatus?.sandboxExperiments?.length ?? 0;

    return [
      { name: '活跃代理', value: active || 1 },
      { name: '冻结代理', value: frozen },
      { name: '离线代理', value: inactive },
      { name: '演化项目', value: projects },
      { name: '沙盒实验', value: experiments },
    ];
  }, [governanceStatus]);

  const generateAreaData = useCallback((): TimeSeriesData[] => {
    const now = Date.now();
    const totalTasks = runningTasks.length;
    const completedTasks = runningTasks.filter(t => t.status === 'completed').length;
    const base = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 50;

    return Array.from({ length: 20 }, (_, i) => ({
      timestamp: now - (19 - i) * 300000,
      value: Math.max(0, Math.min(100, base + Math.sin(i / 2) * 15 + i * 0.5)),
    }));
  }, [runningTasks]);

  const generateRadarData = useCallback(() => {
    const agentCount = governanceStatus?.activeAgents?.length ?? 0;
    const projectCount = governanceStatus?.evolutionProjects?.length ?? 0;
    const experimentCount = governanceStatus?.sandboxExperiments?.length ?? 0;
    const channelCount = channels.filter(c => c.connected).length;
    const taskCompletion = runningTasks.length > 0
      ? (runningTasks.filter(t => t.status === 'completed').length / runningTasks.length) * 100
      : 50;

    return [
      { subject: '代理活跃度', value: Math.min(100, agentCount * 20), fullMark: 100 },
      { subject: '演化能力', value: Math.min(100, projectCount * 25 + 20), fullMark: 100 },
      { subject: '实验能力', value: Math.min(100, experimentCount * 15 + 30), fullMark: 100 },
      { subject: '连通性', value: Math.min(100, channelCount * 20 + 20), fullMark: 100 },
      { subject: '任务完成率', value: taskCompletion, fullMark: 100 },
      { subject: '系统稳定性', value: governanceStatus?.freezeActive ? 40 : 85, fullMark: 100 },
    ];
  }, [governanceStatus, channels, runningTasks]);

  const generateScatterData = useCallback(() => {
    return governanceStatus?.activeAgents?.map(agent => ({
      x: agent.status === 'active' ? 60 + Math.random() * 35 : Math.random() * 40,
      y: agent.status === 'active' ? 50 + Math.random() * 40 : Math.random() * 30,
      z: 200 + Math.random() * 300,
      name: agent.name || agent.id,
    })) ?? [];
  }, [governanceStatus]);

  const [trendData, setTrendData] = useState<TimeSeriesData[]>(generateTrendData);
  const [barData, setBarData] = useState<ChartDataPoint[]>(generateBarData);
  const [pieData, setPieData] = useState<ChartDataPoint[]>(generatePieData);
  const [areaData, setAreaData] = useState<TimeSeriesData[]>(generateAreaData);
  const [radarData, setRadarData] = useState(generateRadarData);
  const [scatterData, setScatterData] = useState(generateScatterData);

  useEffect(() => {
    setTrendData(generateTrendData());
    setBarData(generateBarData());
    setPieData(generatePieData());
    setAreaData(generateAreaData());
    setRadarData(generateRadarData());
    setScatterData(generateScatterData());
  }, [generateTrendData, generateBarData, generatePieData, generateAreaData, generateRadarData, generateScatterData]);

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
