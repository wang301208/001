import { 
  Grid, 
  Card, 
  Title, 
  Text, 
  Badge, 
  Group, 
  RingProgress, 
  Stack, 
  SimpleGrid,
  ThemeIcon,
  Divider,
  Button,
} from '@mantine/core';
import { useAppStore } from '../stores/useAppStore';
import { NotificationCenter } from '../components/notifications/NotificationCenter';
import { TrendChart } from '../components/charts/TrendChart';
import { BarChartComponent } from '../components/charts/BarChartComponent';
import { PieChartComponent } from '../components/charts/PieChartComponent';
import { AreaChartComponent } from '../components/charts/AreaChartComponent';
import { RadarChartComponent } from '../components/charts/RadarChartComponent';
import { ScatterChartComponent } from '../components/charts/ScatterChartComponent';
import { useRealTimeChartData } from '../hooks/useRealTimeChartData';
import { useTaskManager } from '../hooks/useTaskManager';
import { useGovernanceWebSocket } from '../hooks/useGovernanceWebSocket';
import { 
  IconCheck, 
  IconX, 
  IconAlertTriangle,
  IconActivity,
  IconUsers,
  IconFlask,
  IconShieldCheck,
  IconTrendingUp,
  IconPlayerPlay,
  IconHourglass,
  IconHourglassHigh,
} from '@tabler/icons-react';
import { useMemo, useCallback, useEffect } from 'react';

export function DashboardPage() {
  const { 
    governanceStatus, 
    channels, 
    wsConnected,
    loadGovernanceStatus,
    loadChannels,
    checkHealth,
  } = useAppStore();
  const { startTask, updateProgress, finishTask, failTask } = useTaskManager();
  
  // 使用 WebSocket 连接治理状态
  useGovernanceWebSocket({
    autoReconnect: true,
    reconnectInterval: 5000,
  });

  // 组件挂载时加载真实数据
  useEffect(() => {
    console.log('[DashboardPage] 开始加载真实数据...');
    
    // 加载治理状态
    loadGovernanceStatus().then((success: boolean) => {
      if (success) {
        console.log('[DashboardPage] 治理状态加载成功');
      } else {
        console.warn('[DashboardPage] 治理状态加载失败，使用模拟数据');
      }
    });
    
    // 加载渠道列表
    loadChannels().then((success: boolean) => {
      if (success) {
        console.log('[DashboardPage] 渠道列表加载成功');
      } else {
        console.warn('[DashboardPage] 渠道列表加载失败');
      }
    });
    
    // 健康检查
    checkHealth().then((healthy: boolean) => {
      if (healthy) {
        console.log('[DashboardPage] 系统健康检查通过');
      } else {
        console.warn('[DashboardPage] 系统健康检查失败');
      }
    });
  }, [loadGovernanceStatus, loadChannels, checkHealth]);

  // 使用实时数据 Hook
  const { 
    trendData, 
    barData, 
    pieData, 
    areaData,
    radarData,
    scatterData
  } = useRealTimeChartData();

  // 演示任务：短期任务（快速完成）
  const handleDemoTask = useCallback(async () => {
    const taskId = startTask(
      '数据处理任务', 
      '正在处理系统数据...',
      'high', // 高优先级
      'data', // 数据分组
      'short', // 短期任务
      undefined, // 无预计时间
      undefined, // 无依赖
      3 // 最多重试3次
    );
    
    try {
      // 模拟异步操作
      for (let i = 0; i <= 100; i += 10) {
        await new Promise(resolve => setTimeout(resolve, 200));
        updateProgress(taskId, i);
      }
      
      finishTask(taskId);
    } catch (error) {
      failTask(taskId, error instanceof Error ? error.message : '未知错误');
    }
  }, [startTask, updateProgress, finishTask, failTask]);
  
  // 演示中期任务（需要几分钟）
  const handleMediumTask = useCallback(async () => {
    const taskId = startTask(
      '文件上传任务',
      '正在上传大型文件到服务器...',
      'medium',
      'file',
      'medium', // 中期任务
      5, // 预计5分钟
      undefined,
      2
    );
    
    // 模拟较慢的进度
    for (let i = 0; i <= 100; i += 5) {
      await new Promise(resolve => setTimeout(resolve, 500));
      updateProgress(taskId, i);
    }
    
    finishTask(taskId);
  }, [startTask, updateProgress, finishTask]);
  
  // 演示长期任务（需要几小时）
  const handleLongTask = useCallback(() => {
    const taskId = startTask(
      'AI 模型训练',
      '正在训练深度学习模型（预计需要数小时）...',
      'low',
      'ai',
      'long', // 长期任务
      180, // 预计3小时
      undefined,
      1 // 只重试1次
    );
    
    // 模拟非常缓慢的进度
    let progress = 0;
    const interval = setInterval(() => {
      progress += 1;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
        finishTask(taskId);
      } else {
        updateProgress(taskId, progress);
      }
    }, 3000); // 每3秒增加1%
  }, [startTask, updateProgress, finishTask]);

  // 演示失败任务（用于测试重试功能）
  const handleFailedTask = useCallback(() => {
    const taskId = startTask(
      '网络请求任务',
      '模拟网络请求失败...',
      'medium',
      'network',
      undefined,
      3
    );
    
    // 立即标记为失败
    setTimeout(() => {
      failTask(taskId, '网络连接超时');
    }, 1000);
  }, [startTask, failTask]);
  
  // 演示带依赖的任务
  const handleDependentTask = useCallback(async () => {
    // 先创建基础任务
    const baseTaskId = startTask(
      '数据导出',
      '正在导出数据...',
      'medium',
      'data'
    );
    
    // 等待基础任务完成
    setTimeout(() => {
      finishTask(baseTaskId);
      
      // 创建依赖任务
      const dependentTaskId = startTask(
        '数据压缩',
        '正在压缩导出的数据...',
        'low',
        'file',
        'short', // 短期任务
        undefined, // 无预计时间
        [baseTaskId] // 依赖基础任务
      );

      setTimeout(() => {
        finishTask(dependentTaskId);
      }, 2000);
    }, 3000);
  }, [startTask, finishTask]);

  // 计算渠道状态（使用 useMemo 优化性能）
  const channelStats = useMemo(() => {
    const activeChannels = channels.filter(c => c.connected).length;
    const totalChannels = channels.length;
    const percentage = totalChannels > 0 ? Math.round((activeChannels / totalChannels) * 100) : 0;
    return { activeChannels, totalChannels, percentage };
  }, [channels]);

  // 加载状态（暂时移除，等待后续实现）

  return (
    <div>
      {/* 页面标题区域 */}
      <Group justify="space-between" align="flex-start" mb="xl">
        <div>
          <Title order={1} style={{ letterSpacing: '-0.5px' }}>系统仪表盘</Title>
          <Text c="dimmed" mt="xs" size="sm">实时监控系统运行状态和关键指标</Text>
        </div>
        <Group>
          <Button 
            variant="light" 
            color="blue"
            leftSection={<IconPlayerPlay size={16} />}
            onClick={handleDemoTask}
          >
            短期任务
          </Button>
          <Button 
            variant="light" 
            color="cyan"
            leftSection={<IconHourglass size={16} />}
            onClick={handleMediumTask}
          >
            中期任务
          </Button>
          <Button 
            variant="light" 
            color="orange"
            leftSection={<IconHourglassHigh size={16} />}
            onClick={handleLongTask}
          >
            长期任务
          </Button>
          <Button 
            variant="light" 
            color="red"
            leftSection={<IconX size={16} />}
            onClick={handleFailedTask}
          >
            失败任务
          </Button>
          <Button 
            variant="light" 
            color="green"
            leftSection={<IconCheck size={16} />}
            onClick={handleDependentTask}
          >
            依赖任务
          </Button>
          <Badge 
            size="lg" 
            variant="light" 
            leftSection={wsConnected ? <IconCheck size={14} /> : <IconX size={14} />}
            color={wsConnected ? 'green' : 'red'}
          >
            {wsConnected ? '实时连接' : '离线模式'}
          </Badge>
          <NotificationCenter />
        </Group>
      </Group>
      
      {/* 关键指标卡片 */}
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md" mb="xl">
        {/* WebSocket 连接状态 */}
        <MetricCard
          title="WebSocket 状态"
          value={wsConnected ? '已连接' : '未连接'}
          subtitle={wsConnected ? '实时数据同步中' : '无法获取实时数据'}
          icon={wsConnected ? <IconCheck size={24} /> : <IconX size={24} />}
          iconColor={wsConnected ? 'green' : 'red'}
          gradientFrom={wsConnected ? '#d3f9d8' : '#ffe3e3'}
          gradientTo={wsConnected ? '#b2f2bb' : '#ffc9c9'}
          borderColor={wsConnected ? '#69db7c' : '#ffa8a8'}
        />
        
        {/* 渠道状态 */}
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Group justify="space-between" align="flex-start">
            <div>
              <Text size="xs" tt="uppercase" fw={700} c="dimmed">渠道活跃度</Text>
              <Group gap="xs" mt="xs">
                <Text fw={700} size="xl">{channelStats.activeChannels}</Text>
                <Text size="sm" c="dimmed">/ {channelStats.totalChannels}</Text>
              </Group>
              <Text size="xs" c="dimmed" mt="xs">活跃渠道数量</Text>
            </div>
            <RingProgress
              size={60}
              thickness={6}
              roundCaps
              sections={[{ value: channelStats.percentage, color: 'blue' }]}
              label={
                <Text ta="center" fw={700} size="xs">
                  {channelStats.percentage}%
                </Text>
              }
            />
          </Group>
        </Card>
        
        {/* 治理层状态 */}
        <MetricCard
          title="系统状态"
          value={governanceStatus?.freezeActive ? '已冻结' : '正常运行'}
          subtitle={governanceStatus?.freezeActive ? (governanceStatus.freezeStatus?.reason || '系统被冻结') : '所有子系统正常'}
          icon={governanceStatus?.freezeActive ? <IconAlertTriangle size={24} /> : <IconShieldCheck size={24} />}
          iconColor={governanceStatus?.freezeActive ? 'red' : 'blue'}
          gradientFrom={governanceStatus?.freezeActive ? '#ffe3e3' : '#d0ebff'}
          gradientTo={governanceStatus?.freezeActive ? '#ffc9c9' : '#a5d8ff'}
          borderColor={governanceStatus?.freezeActive ? '#ffa8a8' : '#74c0fc'}
        />
        
        {/* 代理数量 */}
        <MetricCard
          title="活跃代理"
          value={(governanceStatus?.activeAgents.length || 0).toString()}
          subtitle="当前运行中的代理"
          icon={<IconUsers size={24} />}
          iconColor="violet"
          gradientFrom="#f3d9fa"
          gradientTo="#e5dbff"
          borderColor="#da77f2"
        />
      </SimpleGrid>
      
      {/* 数据可视化图表区域 - 第一行 */}
      <Grid gutter="md" mb="xl">
        <Grid.Col span={{ base: 12, lg: 8 }}>
          <TrendChart 
            title="系统性能趋势（实时）" 
            data={trendData} 
            color="#228be6"
            unit="%"
          />
        </Grid.Col>
        
        <Grid.Col span={{ base: 12, lg: 4 }}>
          <PieChartComponent 
            title="资源分配占比" 
            data={pieData} 
          />
        </Grid.Col>
      </Grid>
      
      {/* 第二行：面积图和雷达图 */}
      <Grid gutter="md" mb="xl">
        <Grid.Col span={{ base: 12, lg: 8 }}>
          <AreaChartComponent 
            title="累积性能分析" 
            data={areaData} 
            color="#40c057"
            unit="分"
          />
        </Grid.Col>
        
        <Grid.Col span={{ base: 12, lg: 4 }}>
          <RadarChartComponent 
            title="能力维度评估" 
            data={radarData} 
            color="#fab005"
          />
        </Grid.Col>
      </Grid>
      
      {/* 第三行：柱状图和散点图 */}
      <Grid gutter="md" mb="xl">
        <Grid.Col span={{ base: 12, lg: 6 }}>
          <BarChartComponent 
            title="代理活动统计" 
            data={barData} 
            unit="次"
          />
        </Grid.Col>
        
        <Grid.Col span={{ base: 12, lg: 6 }}>
          <ScatterChartComponent 
            title="节点性能分布" 
            data={scatterData} 
            color="#fa5252"
            xAxisLabel="CPU 使用率"
            yAxisLabel="内存使用率"
          />
        </Grid.Col>
      </Grid>

      {/* 详细统计信息 */}
      <Grid gutter="md">
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Group justify="space-between" mb="md">
              <Title order={3}>系统概览</Title>
              <ThemeIcon variant="light" color="blue">
                <IconTrendingUp size={20} />
              </ThemeIcon>
            </Group>
            
            <Stack gap="md">
              <StatItem
                icon={<IconUsers size={16} />}
                iconColor="blue"
                label="演化项目"
                value={governanceStatus?.evolutionProjects.length || 0}
              />
              
              <Divider />
              
              <StatItem
                icon={<IconFlask size={16} />}
                iconColor="teal"
                label="沙盒实验"
                value={governanceStatus?.sandboxExperiments.length || 0}
              />
              
              <Divider />
              
              <Group justify="space-between">
                <Group gap="sm">
                  <ThemeIcon 
                    variant="light" 
                    color={governanceStatus?.sovereigntyBoundary ? 'green' : 'red'} 
                    size="sm"
                  >
                    <IconShieldCheck size={16} />
                  </ThemeIcon>
                  <Text size="sm">主权边界</Text>
                </Group>
                <Badge 
                  color={governanceStatus?.sovereigntyBoundary ? 'green' : 'red'}
                  variant="light"
                  size="lg"
                >
                  {governanceStatus?.sovereigntyBoundary ? '正常' : '异常'}
                </Badge>
              </Group>
            </Stack>
          </Card>
        </Grid.Col>
        
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Group justify="space-between" mb="md">
              <Title order={3}>快速操作</Title>
              <ThemeIcon variant="light" color="orange">
                <IconActivity size={20} />
              </ThemeIcon>
            </Group>
            
            <Stack gap="sm">
              <QuickActionTip icon="💡" text="您可以在左侧导航栏访问各个功能模块" />
              <QuickActionTip icon="📊" text="治理层监控：查看代理组织和演化项目状态" />
              <QuickActionTip icon="🔌" text="渠道管理：配置和管理消息渠道" />
              <QuickActionTip icon="⚙️" text="系统设置：调整系统配置和偏好" />
              <Button onClick={handleDemoTask} leftSection={<IconPlayerPlay size={16} />}>
                运行演示任务
              </Button>
            </Stack>
          </Card>
        </Grid.Col>
      </Grid>
    </div>
  );
}

// 辅助组件：指标卡片
interface MetricCardProps {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
  iconColor: string;
  gradientFrom: string;
  gradientTo: string;
  borderColor: string;
}

function MetricCard({ 
  title, 
  value, 
  subtitle, 
  icon, 
  iconColor,
  gradientFrom,
  gradientTo,
  borderColor,
}: MetricCardProps) {
  return (
    <Card 
      shadow="sm" 
      padding="lg" 
      radius="md" 
      withBorder
      style={{
        background: `linear-gradient(135deg, ${gradientFrom} 0%, ${gradientTo} 100%)`,
        border: `2px solid ${borderColor}`,
      }}
    >
      <Group justify="space-between" align="flex-start">
        <div>
          <Text size="xs" tt="uppercase" fw={700} c="dimmed">{title}</Text>
          <Text fw={700} size="xl" mt="xs" c={iconColor}>{value}</Text>
          <Text size="xs" c="dimmed" mt="xs">{subtitle}</Text>
        </div>
        <ThemeIcon 
          size="xl" 
          radius="xl" 
          variant="white"
          color={iconColor}
        >
          {icon}
        </ThemeIcon>
      </Group>
    </Card>
  );
}

// 辅助组件：统计项
interface StatItemProps {
  icon: React.ReactNode;
  iconColor: string;
  label: string;
  value: number;
}

function StatItem({ icon, iconColor, label, value }: StatItemProps) {
  return (
    <Group justify="space-between">
      <Group gap="sm">
        <ThemeIcon variant="light" color={iconColor} size="sm">
          {icon}
        </ThemeIcon>
        <Text size="sm">{label}</Text>
      </Group>
      <Text fw={700} size="lg">{value}</Text>
    </Group>
  );
}

// 辅助组件：快速操作提示
interface QuickActionTipProps {
  icon: string;
  text: string;
}

function QuickActionTip({ icon, text }: QuickActionTipProps) {
  return (
    <Text size="sm" c="dimmed">
      {icon} {text}
    </Text>
  );
}
