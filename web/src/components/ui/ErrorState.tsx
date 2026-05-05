import { Center, Text, Stack, ThemeIcon, Button } from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({ 
  title = '加载失败', 
  message = '请稍后重试', 
  onRetry 
}: ErrorStateProps) {
  return (
    <Center style={{ minHeight: '400px' }}>
      <Stack align="center" gap="md">
        <ThemeIcon size="xl" variant="light" color="red">
          <IconAlertTriangle size={32} />
        </ThemeIcon>
        <Text fw={600} size="lg" c="red">{title}</Text>
        <Text c="dimmed" size="sm" ta="center">{message}</Text>
        {onRetry && (
          <Button variant="light" color="red" onClick={onRetry}>
            重试
          </Button>
        )}
      </Stack>
    </Center>
  );
}
