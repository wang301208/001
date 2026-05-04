import { Title, Text, Card } from '@mantine/core';

export function SettingsPage() {
  return (
    <div>
      <Title order={1} mb="md">系统设置</Title>
      <Text c="dimmed" mb="xl">配置和偏好设置</Text>
      
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Text>设置功能开发中...</Text>
        <Text size="sm" c="dimmed" mt="md">
          此页面将展示：
        </Text>
        <ul style={{ marginTop: '8px' }}>
          <li>用户认证管理</li>
          <li>WebSocket 连接配置</li>
          <li>通知偏好设置</li>
          <li>主题切换</li>
        </ul>
      </Card>
    </div>
  );
}
