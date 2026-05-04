import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppShell, Group, Text, Burger, useMantineTheme } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconDashboard, IconSettings, IconNetwork } from '@tabler/icons-react';
import { MainLayout } from './components/layout/MainLayout';
import { DashboardPage } from './pages/DashboardPage';
import { GovernancePage } from './pages/GovernancePage';
import { ChannelsPage } from './pages/ChannelsPage';
import { SettingsPage } from './pages/SettingsPage';
import { useWebSocket } from './hooks/useWebSocket';

function App() {
  const [opened, { toggle }] = useDisclosure();
  const theme = useMantineTheme();
  
  // 初始化 WebSocket 连接
  useWebSocket();
  
  return (
    <BrowserRouter>
      <AppShell
        header={{ height: 60 }}
        navbar={{
          width: 250,
          breakpoint: 'sm',
          collapsed: { mobile: !opened },
        }}
        padding="md"
      >
        <AppShell.Header>
          <Group h="100%" px="md">
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
            <Text fw={700} size="lg">系统 - 助手控制台</Text>
          </Group>
        </AppShell.Header>

        <AppShell.Navbar p="md">
          <nav>
            <a href="/" style={{ textDecoration: 'none', color: 'inherit' }}>
              <Group py="xs">
                <IconDashboard size={20} />
                <Text>Dashboard</Text>
              </Group>
            </a>
            <a href="/governance" style={{ textDecoration: 'none', color: 'inherit' }}>
              <Group py="xs">
                <IconNetwork size={20} />
                <Text>治理层</Text>
              </Group>
            </a>
            <a href="/channels" style={{ textDecoration: 'none', color: 'inherit' }}>
              <Group py="xs">
                <IconNetwork size={20} />
                <Text>渠道</Text>
              </Group>
            </a>
            <a href="/settings" style={{ textDecoration: 'none', color: 'inherit' }}>
              <Group py="xs">
                <IconSettings size={20} />
                <Text>设置</Text>
              </Group>
            </a>
          </nav>
        </AppShell.Navbar>

        <AppShell.Main>
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/governance" element={<GovernancePage />} />
            <Route path="/channels" element={<ChannelsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AppShell.Main>
      </AppShell>
    </BrowserRouter>
  );
}

export default App;
