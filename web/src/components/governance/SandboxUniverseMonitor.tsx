import { Card, Title, Text, Badge, Timeline, Group, Stack, ThemeIcon } from '@mantine/core';
import type { SandboxExperiment } from '../../types';
import { IconFlask } from '@tabler/icons-react';

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
        <Stack align="center" gap="md" py="xl">
          <ThemeIcon size="xl" variant="light" color="gray">
            <IconFlask size={32} />
          </ThemeIcon>
          <Text c="dimmed">暂无沙盒实验</Text>
        </Stack>
      </Card>
    );
  }
  
  return (
    <Card shadow="sm" padding="lg" radius="md" withBorder>
      <Group justify="space-between" mb="md">
        <Title order={3}>沙盒宇宙监控</Title>
        <Badge variant="light" color="teal">{experiments.length} 个实验</Badge>
      </Group>
      
      <Stack gap="xl">
        {experiments.map((experiment) => (
          <div 
            key={experiment.id} 
            style={{ 
              paddingBottom: '24px', 
              borderBottom: experiments.indexOf(experiment) < experiments.length - 1 ? '1px solid #dee2e6' : 'none' 
            }}
          >
            <Group justify="space-between" align="flex-start" mb="md">
              <div>
                <Text fw={700} size="lg">{experiment.title}</Text>
                <Text size="xs" c="dimmed" mt="xs" style={{ fontFamily: 'monospace' }}>
                  ID: {experiment.id}
                </Text>
              </div>
              <Badge 
                color={getStatusColor(experiment.status)} 
                size="lg"
                variant="light"
              >
                {getStatusText(experiment.status)}
              </Badge>
            </Group>
            
            <Timeline 
              active={experiment.stages.findIndex((s: any) => s.status === 'running')} 
              bulletSize={28} 
              lineWidth={3}
            >
              {experiment.stages.map((stage: any) => (
                <Timeline.Item
                  key={stage.id}
                  title={<Text fw={600}>{stage.title}</Text>}
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
            
            <Group gap="xl" mt="md">
              <Text size="xs" c="dimmed">
                创建时间: {formatDate(experiment.createdAt)}
              </Text>
              {experiment.updatedAt && (
                <Text size="xs" c="dimmed">
                  更新时间: {formatDate(experiment.updatedAt)}
                </Text>
              )}
            </Group>
          </div>
        ))}
      </Stack>
    </Card>
  );
}
