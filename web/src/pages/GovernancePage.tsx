import { 
  Title, 
  Text, 
  Alert, 
  Button, 
  Group, 
  Grid, 
  LoadingOverlay,
  Stack,
  Badge,
} from '@mantine/core';
import { IconWifi, IconWifiOff, IconRefresh } from '@tabler/icons-react';
import { useAppStore } from '../stores/useAppStore';
import { useGovernanceWebSocket, useGovernanceCache } from '../hooks/useGovernanceWebSocket';
import { AgentTopologyGraph } from '../components/governance/AgentTopologyGraph';
import { EvolutionProjectList } from '../components/governance/EvolutionProjectList';
import { SandboxUniverseMonitor } from '../components/governance/SandboxUniverseMonitor';
import { FreezeStatusIndicator } from '../components/governance/FreezeStatusIndicator';

export function GovernancePage() {
  const { governanceStatus } = useAppStore();
  const { connected, error, reconnect, lastUpdate } = useGovernanceWebSocket({
    autoReconnect: true,
    reconnectInterval: 5000,
  });
  const { loadFromCache } = useGovernanceCache();
  
  // 如果没有实时数据，尝试从缓存加载
  if (!governanceStatus) {
    loadFromCache();
  }
  
  if (!governanceStatus) {
    return (
      <div style={{ position: 'relative', minHeight: '400px' }}>
        <LoadingOverlay visible />
        <Stack gap="md">
          <Title order={1}>治理层监控</Title>
          <Text c="dimmed">正在加载治理层状态...</Text>
        </Stack>
      </div>
    );
  }
  
  return (
    <div>
      {/* 页面标题区域 */}
      <Group justify="space-between" align="flex-start" mb="xl">
        <div>
          <Title order={1} style={{ letterSpacing: '-0.5px' }}>治理层监控</Title>
          <Text c="dimmed" mt="xs" size="sm">代理组织、演化项目、沙盒实验状态</Text>
        </div>
        <Group>
          {connected && lastUpdate && (
            <Badge variant="light" color="green" leftSection={<IconWifi size={14} />}>
              实时更新: {new Date(lastUpdate).toLocaleTimeString()}
            </Badge>
          )}
          <Button 
            variant="light" 
            onClick={reconnect}
            leftSection={<IconRefresh size={16} />}
          >
            刷新
          </Button>
        </Group>
      </Group>
      
      {/* 连接状态提示 */}
      {!connected && (
        <Alert 
          icon={<IconWifiOff size={16} />} 
          title="WebSocket 连接断开" 
          color="yellow" 
          variant="light"
          mb="md"
        >
          <Group justify="space-between">
            <Text>无法连接到服务器，显示的是缓存数据。{error?.message}</Text>
            <Button variant="subtle" onClick={reconnect}>
              <IconWifi size={16} />
            </Button>
          </Group>
        </Alert>
      )}
      
      <Stack gap="md">
        {/* 冻结状态指示器 */}
        <FreezeStatusIndicator
          freezeActive={governanceStatus.freezeActive}
          freezeStatus={governanceStatus.freezeStatus}
        />
        
        {/* 代理组织图 */}
        <AgentTopologyGraph agents={governanceStatus.activeAgents} />
        
        {/* 两列布局 */}
        <Grid gutter="md">
          <Grid.Col span={{ base: 12, lg: 6 }}>
            {/* 演化项目列表 */}
            <EvolutionProjectList projects={governanceStatus.evolutionProjects} />
          </Grid.Col>
          
          <Grid.Col span={{ base: 12, lg: 6 }}>
            {/* 沙盒宇宙监控 */}
            <SandboxUniverseMonitor experiments={governanceStatus.sandboxExperiments} />
          </Grid.Col>
        </Grid>
      </Stack>
    </div>
  );
}
