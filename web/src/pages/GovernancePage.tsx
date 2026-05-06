import { 
  Title, 
  Text, 
  Alert, 
  Button, 
  Group, 
  Grid, 
  Stack,
  Badge,
  Modal,
  TextInput,
  Textarea,
  Select,
} from '@mantine/core';
import { IconWifi, IconWifiOff, IconRefresh, IconPlus } from '@tabler/icons-react';
import { useAppStore } from '../stores/useAppStore';
import { useGovernanceWebSocket, useGovernanceCache } from '../hooks/useGovernanceWebSocket';
import { AgentTopologyGraph } from '../components/governance/AgentTopologyGraph';
import { EvolutionProjectList } from '../components/governance/EvolutionProjectList';
import { SandboxUniverseMonitor } from '../components/governance/SandboxUniverseMonitor';
import { FreezeStatusIndicator } from '../components/governance/FreezeStatusIndicator';
import { LoadingState } from '../components/ui/LoadingState';
import { ErrorState } from '../components/ui/ErrorState';
import { EmptyState } from '../components/ui/EmptyState';
import { useState } from 'react';
import { apiService } from '../services/api';

export function GovernancePage() {
  const { governanceStatus, addNotification } = useAppStore();
  const { connected, error, reconnect, lastUpdate } = useGovernanceWebSocket();
  const { loadFromCache } = useGovernanceCache();
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newProposal, setNewProposal] = useState({ title: '', description: '', type: 'evolution' });

  if (!governanceStatus) {
    const cached = loadFromCache();
    if (!cached) {
      return (
        <div>
          <Group justify="space-between" align="flex-start" mb="xl">
            <div>
              <Title order={1} style={{ letterSpacing: '-0.5px' }}>治理层监控</Title>
              <Text c="dimmed" mt="xs" size="sm">代理组织、演化项目、沙盒实验状态</Text>
            </div>
          </Group>
          {error ? (
            <ErrorState 
              title="连接失败" 
              message={`无法连接后端: ${error.message}`}
              onRetry={reconnect}
            />
          ) : (
            <LoadingState message="正在加载治理层状态..." />
          )}
        </div>
      );
    }
  }

  const handleCreateProposal = async () => {
    if (!newProposal.title.trim()) {
      addNotification('warning', '标题不能为空', '请输入提案标题');
      return;
    }

    setCreating(true);
    try {
      const response = await apiService.createProposal(newProposal);
      if (response.success) {
        addNotification('success', '提案已创建', '新提案已提交审核');
        setShowCreateModal(false);
        setNewProposal({ title: '', description: '', type: 'evolution' });
        reconnect();
      } else {
        addNotification('error', '创建失败', response.error || '创建提案失败');
      }
    } catch (err) {
      addNotification('error', '创建异常', '创建提案时发生错误');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div>
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
            onClick={() => setShowCreateModal(true)}
            leftSection={<IconPlus size={16} />}
          >
            新建提案
          </Button>
          <Button 
            variant="light" 
            onClick={reconnect}
            leftSection={<IconRefresh size={16} />}
          >
            刷新
          </Button>
        </Group>
      </Group>
      
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
            <Button variant="subtle" onClick={reconnect}><IconWifi size={16} /></Button>
          </Group>
        </Alert>
      )}
      
      {governanceStatus ? (
        <Stack gap="md">
          <FreezeStatusIndicator
            freezeActive={governanceStatus.freezeActive}
            freezeStatus={governanceStatus.freezeStatus}
          />
          
          {governanceStatus.activeAgents.length === 0 && 
           governanceStatus.evolutionProjects.length === 0 && 
           governanceStatus.sandboxExperiments.length === 0 ? (
            <EmptyState
              icon={<IconWifi size={32} />}
              title="暂无治理数据"
              description="当前没有活跃的代理、演化项目或沙盒实验"
            />
          ) : (
            <>
              <AgentTopologyGraph agents={governanceStatus.activeAgents} />
              <Grid gutter="md">
                <Grid.Col span={{ base: 12, lg: 6 }}>
                  <EvolutionProjectList projects={governanceStatus.evolutionProjects} />
                </Grid.Col>
                <Grid.Col span={{ base: 12, lg: 6 }}>
                  <SandboxUniverseMonitor experiments={governanceStatus.sandboxExperiments} />
                </Grid.Col>
              </Grid>
            </>
          )}
        </Stack>
      ) : (
        <LoadingState message="加载治理数据..." />
      )}

      <Modal
        opened={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="新建治理提案"
        size="lg"
      >
        <Stack gap="md">
          <TextInput
            label="提案标题"
            placeholder="输入提案标题"
            value={newProposal.title}
            onChange={(e) => setNewProposal({ ...newProposal, title: e.target.value })}
            required
          />
          <Textarea
            label="提案描述"
            placeholder="详细描述提案内容"
            value={newProposal.description}
            onChange={(e) => setNewProposal({ ...newProposal, description: e.target.value })}
            minRows={3}
          />
          <Select
            label="提案类型"
            data={[
              { value: 'evolution', label: '演化' },
              { value: 'mutation', label: '变异' },
              { value: 'reconfiguration', label: '重配置' },
              { value: 'optimization', label: '优化' },
            ]}
            value={newProposal.type}
            onChange={(val) => setNewProposal({ ...newProposal, type: val || 'evolution' })}
          />
          <Group justify="flex-end">
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>取消</Button>
            <Button onClick={handleCreateProposal} loading={creating}>提交提案</Button>
          </Group>
        </Stack>
      </Modal>
    </div>
  );
}
