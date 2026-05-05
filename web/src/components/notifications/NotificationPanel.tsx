import { 
  Card, 
  Title, 
  Text, 
  Group, 
  ActionIcon, 
  Divider,
  ScrollArea,
  Button,
  Menu,
  ThemeIcon,
  Transition,
  Stack,
} from '@mantine/core';
import { 
  IconBell, 
  IconCheck, 
  IconTrash, 
  IconInfoCircle,
  IconCircleCheck,
  IconAlertTriangle,
  IconCircleX,
  IconDots,
} from '@tabler/icons-react';
import { useAppStore } from '../../stores/useAppStore';
interface NotificationPanelProps {
  opened: boolean;
}

export function NotificationPanel({ opened }: NotificationPanelProps) {
  const { notifications, unreadCount, markAsRead, markAllAsRead, removeNotification, clearNotifications } = useAppStore();
  
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <IconCircleCheck size={20} color="#40c057" />;
      case 'warning':
        return <IconAlertTriangle size={20} color="#fab005" />;
      case 'error':
        return <IconCircleX size={20} color="#fa5252" />;
      default:
        return <IconInfoCircle size={20} color="#339af0" />;
    }
  };
  
  const formatTime = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
    return new Date(timestamp).toLocaleDateString('zh-CN');
  };
  
  return (
    <Transition mounted={opened} transition="slide-left" duration={300} timingFunction="ease">
      {(styles) => (
        <Card 
          shadow="xl" 
          padding="lg" 
          radius="md" 
          withBorder
          style={{
            ...styles,
            position: 'fixed',
            top: '80px',
            right: '20px',
            width: '400px',
            maxHeight: '600px',
            zIndex: 1000,
            backgroundColor: 'rgba(255, 255, 255, 0.98)',
            backdropFilter: 'blur(10px)',
          }}
        >
      <Group justify="space-between" mb="md">
        <Group>
          <ThemeIcon variant="light" color="blue" size="lg">
            <IconBell size={20} />
          </ThemeIcon>
          <div>
            <Title order={4}>通知中心</Title>
            {unreadCount > 0 && (
              <Text size="xs" c="dimmed">{unreadCount} 条未读</Text>
            )}
          </div>
        </Group>
        
        <Menu>
          <Menu.Target>
            <ActionIcon variant="subtle">
              <IconDots size={18} />
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item 
              leftSection={<IconCheck size={16} />}
              onClick={markAllAsRead}
              disabled={unreadCount === 0}
            >
              全部标记为已读
            </Menu.Item>
            <Menu.Item 
              leftSection={<IconTrash size={16} />}
              onClick={clearNotifications}
              disabled={notifications.length === 0}
              color="red"
            >
              清空所有通知
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Group>
      
      <Divider mb="md" />
      
      {notifications.length === 0 ? (
        <Group align="center" gap="md" py="xl" justify="center">
          <ThemeIcon size="xl" variant="light" color="gray">
            <IconBell size={32} />
          </ThemeIcon>
          <Text c="dimmed">暂无通知</Text>
        </Group>
      ) : (
        <ScrollArea.Autosize mah={450} offsetScrollbars>
          <Stack gap="sm">
            {notifications.map((notification) => (
              <Card 
                key={notification.id}
                padding="sm"
                radius="md"
                withBorder
                style={{
                  backgroundColor: notification.read ? '#f8f9fa' : '#e7f5ff',
                  borderLeft: `4px solid ${
                    notification.type === 'success' ? '#40c057' :
                    notification.type === 'warning' ? '#fab005' :
                    notification.type === 'error' ? '#fa5252' : '#339af0'
                  }`,
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateX(4px)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateX(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <Group justify="space-between" align="flex-start">
                  <Group gap="sm" align="flex-start" style={{ flex: 1 }}>
                    {getNotificationIcon(notification.type)}
                    <div style={{ flex: 1 }}>
                      <Group justify="space-between" gap="xs">
                        <Text fw={600} size="sm">{notification.title}</Text>
                        <Text size="xs" c="dimmed">{formatTime(notification.timestamp)}</Text>
                      </Group>
                      <Text size="sm" mt="xs">{notification.message}</Text>
                      
                      {notification.action && (
                        <Button 
                          size="xs" 
                          variant="light" 
                          mt="xs"
                          onClick={() => {
                            notification.action?.callback();
                            markAsRead(notification.id);
                          }}
                        >
                          {notification.action.label}
                        </Button>
                      )}
                    </div>
                  </Group>
                  
                  <Group gap="xs">
                    {!notification.read && (
                      <ActionIcon 
                        variant="subtle" 
                        size="sm"
                        onClick={() => markAsRead(notification.id)}
                      >
                        <IconCheck size={16} />
                      </ActionIcon>
                    )}
                    <ActionIcon 
                      variant="subtle" 
                      size="sm"
                      color="red"
                      onClick={() => removeNotification(notification.id)}
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Group>
                </Group>
              </Card>
            ))}
          </Stack>
        </ScrollArea.Autosize>
      )}
        </Card>
      )}
    </Transition>
  );
}
