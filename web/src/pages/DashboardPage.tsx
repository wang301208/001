import { Grid, Card, Title, Text, Badge } from '@mantine/core';
import { useAppStore } from '../stores/useAppStore';
import { IconCheck, IconX, IconAlertTriangle } from '@tabler/icons-react';

export function DashboardPage() {
  const { governanceStatus, channels, wsConnected } = useAppStore();
  
  return (
    <div>
      <Title order={1} mb="md">系统 Dashboard</Title>
      <Text c="dimmed" mb="xl">实时监控系统状态</Text>
      
      <Grid>
        {/* WebSocket 连接状态 */}
        <Grid.Col span={{ base: 12, md: 4 }}>
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Card.Section withBorder inheritPadding py="xs">
              <Text fw={500}>WebSocket 连接</Text>
            </Card.Section>
            
            <Group mt="md">
              {wsConnected ? (
                <>
                  <IconCheck color="green" size={32} />
                  <div>
                    <Text fw={500}>已连接</Text>
                    <Text size="sm" c="dimmed">实时数据同步中</Text>
                  </div>
                </>
              ) : (
                <>
                  <IconX color="red" size={32} />
                  <div>
                    <Text fw={500}>未连接</Text>
                    <Text size="sm" c="dimmed">无法获取实时数据</Text>
                  </div>
                </>
              )}
            </Group>
          </Card>
        </Grid.Col>
        
        {/* 渠道状态 */}
        <Grid.Col span={{ base: 12, md: 4 }}>
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Card.Section withBorder inheritPadding py="xs">
              <Text fw={500}>渠道状态</Text>
            </Card.Section>
            
            <Group mt="md">
              <Text size="sm">
                活跃渠道: <Badge color="green">{channels.filter(c => c.connected).length}</Badge>
              </Text>
              <Text size="sm">
                离线渠道: <Badge color="gray">{channels.filter(c => !c.connected).length}</Badge>
              </Text>
            </Group>
          </Card>
        </Grid.Col>
        
        {/* 治理层状态 */}
        <Grid.Col span={{ base: 12, md: 4 }}>
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Card.Section withBorder inheritPadding py="xs">
              <Text fw={500}>治理层状态</Text>
            </Card.Section>
            
            <Group mt="md">
              {governanceStatus?.freezeActive ? (
                <>
                  <IconAlertTriangle color="red" size={32} />
                  <div>
                    <Text fw={500} c="red">系统冻结</Text>
                    <Text size="sm" c="dimmed">{governanceStatus.freezeStatus?.reason}</Text>
                  </div>
                </>
              ) : (
                <>
                  <IconCheck color="green" size={32} />
                  <div>
                    <Text fw={500}>正常运行</Text>
                    <Text size="sm" c="dimmed">所有子系统正常</Text>
                  </div>
                </>
              )}
            </Group>
          </Card>
        </Grid.Col>
        
        {/* 统计信息 */}
        <Grid.Col span={12}>
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Card.Section withBorder inheritPadding py="xs">
              <Text fw={500}>系统统计</Text>
            </Card.Section>
            
            <Grid mt="md">
              <Grid.Col span={3}>
                <Text size="sm" c="dimmed">活跃代理</Text>
                <Text size="xl" fw={700}>{governanceStatus?.activeAgents.length || 0}</Text>
              </Grid.Col>
              <Grid.Col span={3}>
                <Text size="sm" c="dimmed">演化项目</Text>
                <Text size="xl" fw={700}>{governanceStatus?.evolutionProjects.length || 0}</Text>
              </Grid.Col>
              <Grid.Col span={3}>
                <Text size="sm" c="dimmed">沙盒实验</Text>
                <Text size="xl" fw={700}>{governanceStatus?.sandboxExperiments.length || 0}</Text>
              </Grid.Col>
              <Grid.Col span={3}>
                <Text size="sm" c="dimmed">主权边界</Text>
                <Badge color={governanceStatus?.sovereigntyBoundary ? 'green' : 'red'}>
                  {governanceStatus?.sovereigntyBoundary ? '正常' : '异常'}
                </Badge>
              </Grid.Col>
            </Grid>
          </Card>
        </Grid.Col>
      </Grid>
    </div>
  );
}
