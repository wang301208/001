import { Card, Title, Text, Badge, Alert, Group, Stack, ThemeIcon } from '@mantine/core';
import { IconAlertTriangle, IconShieldCheck, IconClock } from '@tabler/icons-react';
import type { FreezeStatus } from '../../types';

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
      <Card 
        shadow="sm" 
        padding="lg" 
        radius="md" 
        withBorder
        style={{
          background: 'linear-gradient(135deg, #d3f9d8 0%, #b2f2bb 100%)',
          border: '2px solid #69db7c',
        }}
      >
        <Group justify="space-between" align="center">
          <Group>
            <ThemeIcon size="xl" radius="xl" variant="white" color="green">
              <IconShieldCheck size={24} />
            </ThemeIcon>
            <div>
              <Title order={3}>系统冻结状态</Title>
              <Text size="sm" c="dimmed" mt="xs">当前系统运行正常，所有功能可用</Text>
            </div>
          </Group>
          <Badge color="green" size="xl" variant="filled" leftSection={<IconShieldCheck size={16} />}>
            正常运行
          </Badge>
        </Group>
      </Card>
    );
  }
  
  return (
    <Card 
      shadow="sm" 
      padding="lg" 
      radius="md" 
      withBorder 
      style={{ 
        border: '2px solid #fa5252',
        background: 'linear-gradient(135deg, #ffe3e3 0%, #ffc9c9 100%)',
      }}
    >
      <Alert
        icon={<IconAlertTriangle size={24} />}
        title="⚠️ 系统已冻结"
        color="red"
        variant="filled"
        mb="md"
      >
        <Text fw={500}>{freezeStatus?.reason || '系统因安全原因被冻结'}</Text>
      </Alert>
      
      <Stack gap="md" mt="md">
        <Group justify="space-between">
          <Text fw={600}>冻结时间</Text>
          <Group gap="xs">
            <IconClock size={16} />
            <Text fw={500}>{formatDate(freezeStatus?.activatedAt)}</Text>
          </Group>
        </Group>
        
        <div>
          <Text fw={600} mb="xs">受影响的子系统：</Text>
          <Group gap="xs">
            {freezeStatus?.affectedSubsystems.map((subsystem: string) => (
              <Badge key={subsystem} color="red" variant="light">
                {subsystem}
              </Badge>
            ))}
          </Group>
        </div>
        
        <Alert color="yellow" variant="light" mt="md">
          <Text size="sm">
            <strong>注意：</strong> 系统冻结期间，所有演化项目和沙盒实验将被暂停。
            请联系管理员解除冻结状态。
          </Text>
        </Alert>
      </Stack>
    </Card>
  );
}
