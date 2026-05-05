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
  Alert,
  LoadingOverlay,
  Button,
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
  IconAlertCircle,
} from '@tabler/icons-react';
import { useCallback, useEffect, useState } from 'react';

export function ChannelsPage() {
  const { channels, loadChannels, connectChannel, disconnectChannel } = useAppStore();
  
  // 加载和操作状态
  const [loading, setLoading] = useState(false);
  const [operatingChannel, setOperatingChannel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // 组件挂载时加载渠道列表
  useEffect(() => {
    loadChannelsWithFeedback();
  }, []);
  
  // 带反馈的加载函数
  const loadChannelsWithFeedback = async () => {
    setLoading(true);
    setError(null);
    try {
      const success = await loadChannels();
      if (!success) {
        setError('加载渠道列表失败，请检查后端服务是否正常运行');
      }
    } catch (err) {
      setError('加载渠道时发生错误');
    } finally {
      setLoading(false);
    }
  };
  
  // 连接/断开渠道
  const handleToggleChannel = useCallback(async (channelId: string, connected: boolean) => {
    setOperatingChannel(channelId);
    setError(null);
    
    try {
      let success = false;
      if (connected) {
        success = await disconnectChannel(channelId);
      } else {
        success = await connectChannel(channelId);
      }
      
      if (!success) {
        setError(`${connected ? '断开' : '连接'}渠道失败`);
      }
    } catch (err) {
      setError(`操作渠道时发生错误`);
    } finally {
      setOperatingChannel(null);
    }
  }, [connectChannel, disconnectChannel]);
  
  const formatDate = (timestamp?: number) => {
    if (!timestamp) return '-';
    return new Date(timestamp).toLocaleString('zh-CN');
  };
  
  const activeChannels = channels.filter(c => c.connected).length;
  const totalChannels = channels.length;
  
  // 空状态显示
  if (!loading && channels.length === 0) {
    return (
      <div>
        <Group justify="space-between" align="flex-start" mb="xl">
          <div>
            <Title order={1} style={{ letterSpacing: '-0.5px' }}>渠道管理</Title>
            <Text c="dimmed" mt="xs" size="sm">消息渠道状态和配置</Text>
          </div>
          <ActionIcon 
            variant="light" 
            size="lg"
            onClick={loadChannelsWithFeedback}
            loading={loading}
          >
            <IconRefresh size={18} />
          </ActionIcon>
        </Group>
        
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Stack align="center" gap="md" py="xl">
            <ThemeIcon size="xl" variant="light" color="gray">
              <IconInfoCircle size={32} />
            </ThemeIcon>
            <Text fw={600}>暂无渠道数据</Text>
            <Text size="sm" c="dimmed">请先在后端配置消息渠道</Text>
            <Button 
              variant="light" 
              onClick={loadChannelsWithFeedback}
              leftSection={<IconRefresh size={16} />}
            >
              重新加载
            </Button>
          </Stack>
        </Card>
      </div>
    );
  }
  
  return (
    <div style={{ position: 'relative' }}>
      {/* 加载遮罩 */}
      <LoadingOverlay visible={loading && !operatingChannel} />
      
      {/* 错误提示 */}
      {error && (
        <Alert 
          icon={<IconAlertCircle size={16} />} 
          title="操作失败" 
          color="red" 
          mb="md"
          onClose={() => setError(null)}
        >
          {error}
        </Alert>
      )}
      
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
          <ActionIcon 
            variant="light" 
            size="lg"
            onClick={loadChannelsWithFeedback}
            loading={loading}
          >
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
                        loading={operatingChannel === channel.id}
                        disabled={operatingChannel !== null && operatingChannel !== channel.id}
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
