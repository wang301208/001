import { 
  Card, 
  Title, 
  Text, 
  Table, 
  Badge, 
  Group, 
  Stack,
  ThemeIcon,
  ActionIcon,
  Tooltip,
  Divider,
} from '@mantine/core';
import { useAppStore } from '../stores/useAppStore';
import { 
  IconCircleCheck, 
  IconCircleX,
  IconRefresh,
  IconSettings,
  IconInfoCircle,
  IconPlug,
  IconPlugOff,
} from '@tabler/icons-react';
import { useCallback, useEffect } from 'react';

export function ChannelsPage() {
  const { channels, loadChannels, connectChannel, disconnectChannel } = useAppStore();
  
  // 组件挂载时加载渠道列表
  useEffect(() => {
    loadChannels();
  }, [loadChannels]);
  
  // 连接/断开渠道
  const handleToggleChannel = useCallback(async (channelId: string, connected: boolean) => {
    if (connected) {
      await disconnectChannel(channelId);
    } else {
      await connectChannel(channelId);
    }
  }, [connectChannel, disconnectChannel]);
  
  const formatDate = (timestamp?: number) => {
    if (!timestamp) return '-';
    return new Date(timestamp).toLocaleString('zh-CN');
  };
  
  const activeChannels = channels.filter(c => c.connected).length;
  const totalChannels = channels.length;
  
  if (channels.length === 0) {
    return (
      <div>
        <Title order={1} mb="md">渠道管理</Title>
        <Text c="dimmed" mb="xl">消息渠道状态和配置</Text>
        
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Stack align="center" gap="md" py="xl">
            <ThemeIcon size="xl" variant="light" color="gray">
              <IconInfoCircle size={32} />
            </ThemeIcon>
            <Text c="dimmed">暂无渠道数据</Text>
            <Text size="sm" c="dimmed">请先配置消息渠道</Text>
          </Stack>
        </Card>
      </div>
    );
  }
  
  return (
    <div>
      {/* 页面标题区域 */}
      <Group justify="space-between" align="flex-start" mb="xl">
        <div>
          <Title order={1} style={{ letterSpacing: '-0.5px' }}>渠道管理</Title>
          <Text c="dimmed" mt="xs" size="sm">消息渠道状态和配置</Text>
        </div>
        <Group>
          <Badge variant="light" color="green" leftSection={<IconCircleCheck size={14} />}>
            活跃: {activeChannels}
          </Badge>
          <Badge variant="light" color="gray" leftSection={<IconCircleX size={14} />}>
            离线: {totalChannels - activeChannels}
          </Badge>
          <ActionIcon variant="light" size="lg">
            <IconRefresh size={18} />
          </ActionIcon>
        </Group>
      </Group>
      
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Group justify="space-between" mb="md">
          <Title order={3}>渠道列表</Title>
          <Text size="sm" c="dimmed">共 {totalChannels} 个渠道</Text>
        </Group>
        
        <Divider mb="md" />
        
        <Table striped highlightOnHover withTableBorder withColumnBorders>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>渠道名称</Table.Th>
              <Table.Th>类型</Table.Th>
              <Table.Th>连接状态</Table.Th>
              <Table.Th>最后活动</Table.Th>
              <Table.Th style={{ width: '100px' }}>操作</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {channels.map((channel) => (
              <Table.Tr key={channel.id}>
                <Table.Td>
                  <Stack gap={2}>
                    <Text fw={600}>{channel.name}</Text>
                    <Text size="xs" c="dimmed" style={{ fontFamily: 'monospace' }}>
                      {channel.id}
                    </Text>
                  </Stack>
                </Table.Td>
                <Table.Td>
                  <Badge variant="light" color="blue">
                    {channel.type}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Group gap="xs">
                    {channel.connected ? (
                      <>
                        <IconCircleCheck color="#40c057" size={18} />
                        <Badge color="green" variant="light">已连接</Badge>
                      </>
                    ) : (
                      <>
                        <IconCircleX color="#fa5252" size={18} />
                        <Badge color="red" variant="light">未连接</Badge>
                      </>
                    )}
                  </Group>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" c="dimmed">
                    {formatDate(channel.lastActivity)}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Group gap="xs">
                    <Tooltip label={channel.connected ? '断开连接' : '连接'}>
                      <ActionIcon 
                        variant="subtle" 
                        color={channel.connected ? 'red' : 'green'}
                        onClick={() => handleToggleChannel(channel.id, channel.connected)}
                        loading={false} // 可以添加loading状态
                      >
                        {channel.connected ? <IconPlugOff size={18} /> : <IconPlug size={18} />}
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label="配置">
                      <ActionIcon variant="subtle" color="blue">
                        <IconSettings size={18} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                </Table.Td>

              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Card>
    </div>
  );
}
