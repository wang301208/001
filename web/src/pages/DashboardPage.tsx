import { 
  Grid, 
  Card, 
  Title, 
  Text, 
  Badge, 
  Group, 
  Stack, 
  SimpleGrid,
  ThemeIcon,
  Divider,
  Skeleton,
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
  IconServer,
  IconClock,
} from '@tabler/icons-react';
import { useMemo, useEffect, useState } from 'react';

export function DashboardPage() {
  const { 
    governanceStatus, 
    channels, 
    runningTasks,
    loadGovernanceStatus,
    loadChannels,
    checkHealth,
  } = useAppStore();
  
  // WebSocket 连接状态
  const { connected: wsConnectedReal } = useGovernanceWebSocket({
    autoReconnect: true,
    reconnectInterval: 5000,
  });

  // 加载状态
  const [loading, setLoading] = useState(true);

  // 组件挂载时加载真实数据
  useEffect(() => {
    console.log('[DashboardPage] 开始加载真实数据...');
    setLoading(true);
    
    Promise.all([
      loadGovernanceStatus(),
      loadChannels(),
      checkHealth(),
    ]).finally(() => {
      setTimeout(() => setLoading(false), 500); // 最小加载时间，避免闪烁
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

  // 计算真实业务统计数据
  const stats = useMemo(() => {
    // 渠道统计
    const activeChannels = channels.filter(c => c.connected).length;
    const totalChannels = channels.length;
    
    // 任务统计
    const runningTasksCount = runningTasks.filter(t => t.status === 'running').length;
    const completedTasksCount = runningTasks.filter(t => t.status === 'completed').length;
    const failedTasksCount = runningTasks.filter(t => t.status === 'failed').length;
    const totalTasksCount = runningTasks.length;
    
    // 治理状态统计
    const activeAgents = governanceStatus?.activeAgents?.length || 0;
    const evolutionProjects = governanceStatus?.evolutionProjects?.length || 0;
    const sandboxExperiments = governanceStatus?.sandboxExperiments?.length || 0;
    const freezeActive = governanceStatus?.freezeActive || false;
    
    return {
      channels: { active: activeChannels, total: totalChannels },
      tasks: { 
        running: runningTasksCount, 
        completed: completedTasksCount, 
        failed: failedTasksCount,
        total: totalTasksCount 
      },
      governance: {
        agents: activeAgents,
        projects: evolutionProjects,
        experiments: sandboxExperiments,
        freezeActive,
      },
    };
  }, [channels, runningTasks, governanceStatus]);

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
          <Badge 
            size="lg" 
            variant="light" 
            leftSection={wsConnectedReal ? <IconCheck size={14} /> : <IconX size={14} />}
            color={wsConnectedReal ? 'green' : 'red'}
          >
            {wsConnectedReal ? '实时连接' : '离线模式'}
          </Badge>
          <NotificationCenter />
        </Group>
      </Group>
      
      {/* 关键指标卡片 */}
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md" mb="xl">
        {loading ? (
          <>
            <Skeleton height={120} radius="md" />
            <Skeleton height={120} radius="md" />
            <Skeleton height={120} radius="md" />
            <Skeleton height={120} radius="md" />
          </>
        ) : (
          <>
            {/* WebSocket 连接状态 */}
            <MetricCard
              title="WebSocket 状态"
              value={wsConnectedReal ? '已连接' : '未连接'}
              subtitle={wsConnectedReal ? '实时数据同步中' : '无法获取实时数据'}
              icon={wsConnectedReal ? <IconCheck size={24} /> : <IconX size={24} />}
              iconColor={wsConnectedReal ? 'green' : 'red'}
              gradientFrom={wsConnectedReal ? '#d3f9d8' : '#ffe3e3'}
              gradientTo={wsConnectedReal ? '#b2f2bb' : '#ffc9c9'}
              borderColor={wsConnectedReal ? '#69db7c' : '#ffa8a8'}
            />
            
            {/* 渠道活跃度 */}
            <MetricCard
              title="渠道活跃度"
              value={`${stats.channels.active}/${stats.channels.total}`}
              subtitle={`${stats.channels.total > 0 ? Math.round((stats.channels.active / stats.channels.total) * 100) : 0}% 活跃`}
              icon={<IconServer size={24} />}
              iconColor="blue"
              gradientFrom="#d0ebff"
              gradientTo="#a5d8ff"
              borderColor="#74c0fc"
            />
            
            {/* 任务执行状态 */}
            <MetricCard
              title="任务执行"
              value={stats.tasks.running.toString()}
              subtitle={`完成 ${stats.tasks.completed} · 失败 ${stats.tasks.failed}`}
              icon={<IconClock size={24} />}
              iconColor="violet"
              gradientFrom="#f3d9fa"
              gradientTo="#e5dbff"
              borderColor="#da77f2"
            />
            
            {/* 系统健康状态 */}
            <MetricCard
              title="系统状态"
              value={stats.governance.freezeActive ? '已冻结' : '正常'}
              subtitle={`${stats.governance.agents} 代理 · ${stats.governance.projects} 项目`}
              icon={stats.governance.freezeActive ? <IconAlertTriangle size={24} /> : <IconShieldCheck size={24} />}
              iconColor={stats.governance.freezeActive ? 'red' : 'green'}
              gradientFrom={stats.governance.freezeActive ? '#ffe3e3' : '#d3f9d8'}
              gradientTo={stats.governance.freezeActive ? '#ffc9c9' : '#b2f2bb'}
              borderColor={stats.governance.freezeActive ? '#ffa8a8' : '#69db7c'}
            />
          </>
        )}
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
              <Title order={3}>治理层概览</Title>
              <ThemeIcon variant="light" color="blue">
                <IconTrendingUp size={20} />
              </ThemeIcon>
            </Group>
            
            {loading ? (
              <Stack gap="md">
                <Skeleton height={40} radius="md" />
                <Divider />
                <Skeleton height={40} radius="md" />
                <Divider />
                <Skeleton height={40} radius="md" />
              </Stack>
            ) : (
              <Stack gap="md">
                <StatItem
                  icon={<IconUsers size={16} />}
                  iconColor="violet"
                  label="活跃代理"
                  value={stats.governance.agents}
                />
                
                <Divider />
                
                <StatItem
                  icon={<IconFlask size={16} />}
                  iconColor="teal"
                  label="演化项目"
                  value={stats.governance.projects}
                />
                
                <Divider />
                
                <StatItem
                  icon={<IconActivity size={16} />}
                  iconColor="orange"
                  label="沙盒实验"
                  value={stats.governance.experiments}
                />
                
                <Divider />
                
                <Group justify="space-between">
                  <Group gap="sm">
                    <ThemeIcon 
                      variant="light" 
                      color={stats.governance.freezeActive ? 'red' : 'green'} 
                      size="sm"
                    >
                      <IconShieldCheck size={16} />
                    </ThemeIcon>
                    <Text size="sm">主权边界</Text>
                  </Group>
                  <Badge 
                    color={stats.governance.freezeActive ? 'red' : 'green'}
                    variant="light"
                    size="lg"
                  >
                    {stats.governance.freezeActive ? '已冻结' : '正常'}
                  </Badge>
                </Group>
              </Stack>
            )}
          </Card>
        </Grid.Col>
        
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Group justify="space-between" mb="md">
              <Title order={3}>任务执行统计</Title>
              <ThemeIcon variant="light" color="violet">
                <IconClock size={20} />
              </ThemeIcon>
            </Group>
            
            {loading ? (
              <Stack gap="md">
                <Skeleton height={40} radius="md" />
                <Divider />
                <Skeleton height={40} radius="md" />
                <Divider />
                <Skeleton height={40} radius="md" />
              </Stack>
            ) : (
              <Stack gap="md">
                <StatItem
                  icon={<IconActivity size={16} />}
                  iconColor="blue"
                  label="运行中任务"
                  value={stats.tasks.running}
                />
                
                <Divider />
                
                <StatItem
                  icon={<IconCheck size={16} />}
                  iconColor="green"
                  label="已完成任务"
                  value={stats.tasks.completed}
                />
                
                <Divider />
                
                <StatItem
                  icon={<IconX size={16} />}
                  iconColor="red"
                  label="失败任务"
                  value={stats.tasks.failed}
                />
                
                <Divider />
                
                <Group justify="space-between">
                  <Text size="sm" fw={500}>总任务数</Text>
                  <Badge size="lg" variant="filled" color="gray">
                    {stats.tasks.total}
                  </Badge>
                </Group>
              </Stack>
            )}
          </Card>
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
