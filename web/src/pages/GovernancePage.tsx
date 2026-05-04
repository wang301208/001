import { Title, Text, Grid, Alert, LoadingOverlay } from '@mantine/core';
import { IconWifi, IconWifiOff, IconInfoCircle } from '@tabler/icons-react';
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
        <Title order={1} mb="md">治理层监控</Title>
        <Text c="dimmed">正在加载治理层状态...</Text>
      </div>
    );
  }
  
  return (
    <div>
      <Title order={1} mb="md">治理层监控</Title>
      <Text c="dimmed" mb="xl">代理组织、演化项目、沙盒实验状态</Text>
      
      {/* 连接状态提示 */}
      {!connected && (
        <Alert
          icon={<IconWifiOff size={16} />}
          title="WebSocket 连接断开"
          color="yellow"
          mb="md"
          action={
            <button onClick={reconnect} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
              <IconWifi size={16} />
            </button>
          }
        >
          无法连接到服务器，显示的是缓存数据。{error?.message}
        </Alert>
      )}
      
      {connected && lastUpdate && (
        <Alert
          icon={<IconWifi size={16} />}
          title="实时连接正常"
          color="green"
          mb="md"
        >
          最后更新: {new Date(lastUpdate).toLocaleTimeString()}
        </Alert>
      )}
      
      <Grid>
        {/* 冻结状态指示器 */}
        <Grid.Col span={12}>
          <FreezeStatusIndicator
            freezeActive={governanceStatus.freezeActive}
            freezeStatus={governanceStatus.freezeStatus}
          />
        </Grid.Col>
        
        {/* 代理组织图 */}
        <Grid.Col span={12}>
          <AgentTopologyGraph agents={governanceStatus.activeAgents} />
        </Grid.Col>
        
        {/* 演化项目列表 */}
        <Grid.Col span={12}>
          <EvolutionProjectList projects={governanceStatus.evolutionProjects} />
        </Grid.Col>
        
        {/* 沙盒宇宙监控 */}
        <Grid.Col span={12}>
          <SandboxUniverseMonitor experiments={governanceStatus.sandboxExperiments} />
        </Grid.Col>
      </Grid>
    </div>
  );
}
