import { Center, Text, Stack, ThemeIcon } from '@mantine/core';
import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description?: string;
}

export function EmptyState({ icon, title, description }: EmptyStateProps) {
  return (
    <Center style={{ minHeight: '300px' }}>
      <Stack align="center" gap="md">
        <ThemeIcon size="xl" variant="light" color="gray">
          {icon}
        </ThemeIcon>
        <Text fw={600} size="lg">{title}</Text>
        {description && (
          <Text c="dimmed" size="sm" ta="center">
            {description}
          </Text>
        )}
      </Stack>
    </Center>
  );
}
