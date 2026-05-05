import { Center, Loader, Text, Stack } from '@mantine/core';

interface LoadingStateProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export function LoadingState({ message = '加载中...', size = 'lg' }: LoadingStateProps) {
  return (
    <Center style={{ minHeight: '400px' }}>
      <Stack align="center" gap="md">
        <Loader size={size} type="dots" />
        <Text c="dimmed" size="sm">{message}</Text>
      </Stack>
    </Center>
  );
}
