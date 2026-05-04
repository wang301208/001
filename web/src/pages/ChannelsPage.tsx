import { Card, Title, Text, Table, Badge, Group } from '@mantine/core';
import { useAppStore } from '../stores/useAppStore';
import { IconCircleCheck, IconCircleX } from '@tabler/icons-react';

export function ChannelsPage() {
  const { channels } = useAppStore();
  
  const formatDate = (timestamp?: number) => {
    if (!timestamp) return '-';
    return new Date(timestamp).toLocaleString('zh-CN');
  };
  
  if (channels.length === 0) {
    return (
      <div>
        <Title order={1} mb="md">渠道管理</Title>
        <Text c="dimmed" mb="xl">消息渠道状态和配置</Text>
        
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Text c="dimmed">暂无渠道数据</Text>
        </Card>
      </div>
    );
  }
  
  return (
    <div>
      <Title order={1} mb="md">渠道管理</Title>
      <Text c="dimmed" mb="xl">消息渠道状态和配置</Text>
      
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Group justify="space-between" mb="md">
          <Title order={3}>渠道列表</Title>
          <Group gap="xs">
            <Badge color="green">
              活跃: {channels.filter(c => c.connected).length}
            </Badge>
            <Badge color="gray">
              离线: {channels.filter(c => !c.connected).length}
            </Badge>
          </Group>
        </Group>
        
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>渠道名称</Table.Th>
              <Table.Th>类型</Table.Th>
              <Table.Th>连接状态</Table.Th>
              <Table.Th>最后活动</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {channels.map((channel) => (
              <Table.Tr key={channel.id}>
                <Table.Td>
                  <Text fw={500}>{channel.name}</Text>
                  <Text size="xs" c="dimmed">{channel.id}</Text>
                </Table.Td>
                <Table.Td>
                  <Badge variant="light">{channel.type}</Badge>
                </Table.Td>
                <Table.Td>
                  <Group gap="xs">
                    {channel.connected ? (
                      <>
                        <IconCircleCheck color="#20C997" size={16} />
                        <Text size="sm" c="green">已连接</Text>
                      </>
                    ) : (
                      <>
                        <IconCircleX color="#E64980" size={16} />
                        <Text size="sm" c="red">未连接</Text>
                      </>
                    )}
                  </Group>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" c="dimmed">{formatDate(channel.lastActivity)}</Text>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Card>
    </div>
  );
}
