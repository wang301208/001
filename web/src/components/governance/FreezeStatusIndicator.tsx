import { Card, Title, Text, Badge, Alert, Group } from '@mantine/core';
import { IconAlertTriangle, IconShieldCheck, IconClock } from '@tabler/icons-react';
import type { FreezeStatus } from '../types';

interface FreezeStatusIndicatorProps {
  freezeActive: boolean;
  freezeStatus?: FreezeStatus;
}

export function FreezeStatusIndicator({ freezeActive, freezeStatus }: FreezeStatusIndicatorProps) {
  const formatDate = (timestamp?: number) => {
    if (!timestamp) return '-';
    return new Date(timestamp).toLocaleString('zh-CN');
  };
  
  if (!freezeActive) {
    return (
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Group justify="space-between" align="center">
          <div>
            <Title order={3}>系统冻结状态</Title>
            <Text size="sm" c="dimmed" mt="xs">当前系统运行正常</Text>
          </div>
          <Badge color="green" size="xl" leftSection={<IconShieldCheck size={16} />}>
            正常运行
          </Badge>
        </Group>
      </Card>
    );
  }
  
  return (
    <Card shadow="sm" padding="lg" radius="md" withBorder style={{ border: '2px solid #E64980' }}>
      <Alert
        icon={<IconAlertTriangle size={24} />}
        title="⚠️ 系统已冻结"
        color="red"
        variant="filled"
        mb="md"
      >
        <Text>{freezeStatus?.reason || '系统因安全原因被冻结'}</Text>
      </Alert>
      
      <div style={{ marginTop: '16px' }}>
        <Group justify="space-between" mb="sm">
          <Text fw={500}>冻结时间</Text>
          <Group gap="xs">
            <IconClock size={16} />
            <Text>{formatDate(freezeStatus?.activatedAt)}</Text>
          </Group>
        </Group>
        
        <div style={{ marginBottom: '16px' }}>
          <Text fw={500} mb="xs">受影响的子系统：</Text>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {freezeStatus?.affectedSubsystems.map((subsystem) => (
              <Badge key={subsystem} color="red" variant="light">
                {subsystem}
              </Badge>
            ))}
          </div>
        </div>
        
        <Alert color="yellow" variant="light" mt="md">
          <Text size="sm">
            <strong>注意：</strong> 系统冻结期间，所有演化项目和沙盒实验将被暂停。
            请联系管理员解除冻结状态。
          </Text>
        </Alert>
      </div>
    </Card>
  );
}
