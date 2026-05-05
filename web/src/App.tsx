import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AppShell, Group, Text, ActionIcon, Box, Stack, rem } from '@mantine/core';
import { useDisclosure, useHover } from '@mantine/hooks';
import { 
  IconDashboard, 
  IconSettings, 
  IconNetwork, 
  IconShield,
  IconMenu2,
  IconMessageCircle,
} from '@tabler/icons-react';
import { DashboardPage } from './pages/DashboardPage';
import { GovernancePage } from './pages/GovernancePage';
import { ChannelsPage } from './pages/ChannelsPage';
import { SettingsPage } from './pages/SettingsPage';
import { ChatPage } from './pages/ChatPage';
import { NotificationCenter } from './components/notifications/NotificationCenter';
import { TaskIndicator } from './components/tasks/TaskIndicator';
import { useWebSocket } from './hooks/useWebSocket';

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  path: string;
}

function NavItem({ icon, label, path }: NavItemProps) {
  const { hovered, ref } = useHover();
  const location = useLocation();
  const isActive = location.pathname === path || (path !== '/' && location.pathname.startsWith(path));
  
  return (
    <Box
      ref={ref}
      component="a"
      href={path}
      style={{
        textDecoration: 'none',
        color: 'inherit',
        padding: `${rem(12)} ${rem(16)}`,
        borderRadius: 'var(--mantine-radius-md)',
        backgroundColor: isActive ? 'var(--mantine-color-blue-light)' : hovered ? 'var(--mantine-color-gray-1)' : 'transparent',
        transition: 'all 0.2s ease',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        cursor: 'pointer',
      }}
    >
      <ActionIcon 
        variant={isActive ? 'filled' : 'subtle'} 
        color={isActive ? 'blue' : 'gray'}
        size="lg"
      >
        {icon}
      </ActionIcon>
      <Text 
        fw={isActive ? 600 : 500} 
        c={isActive ? 'blue' : 'dark'}
        size="sm"
      >
        {label}
      </Text>
    </Box>
  );
}

function AppContent() {
  const [opened, { toggle }] = useDisclosure();
  
  // 初始化 WebSocket 连接
  useWebSocket();
  
  return (
    <AppShell
      header={{ height: 70 }}
      navbar={{
        width: 280,
        breakpoint: 'sm',
        collapsed: { mobile: !opened },
      }}
      padding="md"
      styles={{
        main: {
          background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)',
          minHeight: '100vh',
        },
      }}
    >
      <AppShell.Header 
        style={{
          borderBottom: '1px solid var(--mantine-color-gray-2)',
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(10px)',
        }}
      >
        <Group h="100%" px="xl" justify="space-between">
          <Group>
            <ActionIcon 
              variant="subtle" 
              onClick={toggle} 
              hiddenFrom="sm" 
              size="lg"
            >
              <IconMenu2 />
            </ActionIcon>
            <Group gap="xs">
              <IconShield size={32} color="var(--mantine-color-blue-6)" />
              <Text fw={700} size="xl" style={{ letterSpacing: '-0.5px' }}>
                系统控制台
              </Text>
            </Group>
          </Group>
          <Group>
            <NotificationCenter />
            <TaskIndicator />
            <Text size="sm" c="dimmed">v2026.4.16</Text>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar 
        p="md"
        style={{
          borderRight: '1px solid var(--mantine-color-gray-2)',
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(10px)',
        }}
      >
        <Stack gap="xs">
          <NavItem 
            icon={<IconDashboard size={20} />} 
            label="仪表盘" 
            path="/" 
          />
          <NavItem 
            icon={<IconShield size={20} />} 
            label="治理层监控" 
            path="/governance" 
          />
          <NavItem 
            icon={<IconNetwork size={20} />} 
            label="渠道管理" 
            path="/channels" 
          />
          <NavItem 
            icon={<IconMessageCircle size={20} />} 
            label="交互窗口" 
            path="/chat" 
          />
          <NavItem 
            icon={<IconSettings size={20} />} 
            label="系统设置" 
            path="/settings" 
          />
        </Stack>
      </AppShell.Navbar>

      <AppShell.Main>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/governance" element={<GovernancePage />} />
          <Route path="/channels" element={<ChannelsPage />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppShell.Main>
    </AppShell>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

export default App;
