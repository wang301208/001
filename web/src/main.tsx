import React from 'react';
import ReactDOM from 'react-dom/client';
import { MantineProvider, createTheme } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import '@mantine/core/styles.css';

// 创建现代化主题
const theme = createTheme({
  primaryColor: 'blue',
  primaryShade: 6,
  colors: {
    blue: ['#E7F5FF', '#D0EBFF', '#A5D8FF', '#74C0FC', '#4DABF7', '#339AF0', '#228BE6', '#1C7ED6', '#1971C2', '#1864AB'],
  },
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  headings: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    fontWeight: '600',
  },
  components: {
    Card: {
      defaultProps: {
        radius: 'md',
        shadow: 'sm',
        withBorder: true,
      },
    },
    Button: {
      defaultProps: {
        radius: 'md',
      },
    },
  },
});

// 创建 QueryClient
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <MantineProvider theme={theme}>
        <App />
      </MantineProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
