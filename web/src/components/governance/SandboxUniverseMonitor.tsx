import { Card, Title, Text, Badge, Timeline } from '@mantine/core';
import type { SandboxExperiment } from '../types';

interface SandboxUniverseMonitorProps {
  experiments: SandboxExperiment[];
}

export function SandboxUniverseMonitor({ experiments }: SandboxUniverseMonitorProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'proposed': return 'blue';
      case 'provisioning': return 'yellow';
      case 'running': return 'cyan';
      case 'observing': return 'violet';
      case 'completed': return 'green';
      case 'rejected': return 'red';
      case 'promoted': return 'teal';
      case 'rolled_back': return 'orange';
      default: return 'gray';
    }
  };
  
  const getStatusText = (status: string) => {
    switch (status) {
      case 'proposed': return '提议中';
      case 'provisioning': return '配置中';
      case 'running': return '运行中';
      case 'observing': return '观察中';
      case 'completed': return '已完成';
      case 'rejected': return '已拒绝';
      case 'promoted': return '已提升';
      case 'rolled_back': return '已回滚';
      default: return status;
    }
  };
  
  const formatDate = (timestamp?: number) => {
    if (!timestamp) return '-';
    return new Date(timestamp).toLocaleString('zh-CN');
  };
  
  if (experiments.length === 0) {
    return (
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Text c="dimmed">暂无沙盒实验</Text>
      </Card>
    );
  }
  
  return (
    <Card shadow="sm" padding="lg" radius="md" withBorder>
      <Title order={3} mb="md">沙盒宇宙监控</Title>
      
      {experiments.map((experiment) => (
        <div key={experiment.id} style={{ marginBottom: '24px', paddingBottom: '24px', borderBottom: '1px solid #e9ecef' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <Text fw={700} size="lg">{experiment.title}</Text>
              <Text size="sm" c="dimmed">ID: {experiment.id}</Text>
            </div>
            <Badge color={getStatusColor(experiment.status)} size="lg">
              {getStatusText(experiment.status)}
            </Badge>
          </div>
          
          <Timeline active={experiment.stages.findIndex(s => s.status === 'running')} bulletSize={24} lineWidth={2}>
            {experiment.stages.map((stage) => (
              <Timeline.Item
                key={stage.id}
                title={stage.title}
                bullet={
                  stage.status === 'completed' ? '✓' :
                  stage.status === 'running' ? '●' :
                  stage.status === 'failed' ? '✗' : '○'
                }
              >
                <Text size="sm" c="dimmed">{stage.description}</Text>
                <div style={{ marginTop: '8px' }}>
                  <Badge 
                    variant="light" 
                    color={
                      stage.status === 'completed' ? 'green' :
                      stage.status === 'running' ? 'blue' :
                      stage.status === 'failed' ? 'red' : 'gray'
                    }
                  >
                    {stage.status === 'completed' ? '已完成' :
                     stage.status === 'running' ? '运行中' :
                     stage.status === 'failed' ? '失败' : '等待中'}
                  </Badge>
                  {stage.startedAt && (
                    <Text size="xs" c="dimmed" mt="xs">
                      开始: {formatDate(stage.startedAt)}
                    </Text>
                  )}
                  {stage.completedAt && (
                    <Text size="xs" c="dimmed">
                      完成: {formatDate(stage.completedAt)}
                    </Text>
                  )}
                </div>
              </Timeline.Item>
            ))}
          </Timeline>
          
          <div style={{ marginTop: '12px' }}>
            <Text size="xs" c="dimmed">
              创建时间: {formatDate(experiment.createdAt)}
            </Text>
            {experiment.updatedAt && (
              <Text size="xs" c="dimmed">
                更新时间: {formatDate(experiment.updatedAt)}
              </Text>
            )}
          </div>
        </div>
      ))}
    </Card>
  );
}
