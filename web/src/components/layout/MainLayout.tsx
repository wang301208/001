import { ReactNode } from 'react';
import { Box, Container } from '@mantine/core';

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <Box style={{ minHeight: '100vh', backgroundColor: '#f8f9fa' }}>
      <Container size="xl" py="md">
        {children}
      </Container>
    </Box>
  );
}
