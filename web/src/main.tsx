import React from 'react';
import ReactDOM from 'react-dom/client';
import { MantineProvider, createTheme } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import './index.css';

// 创建主题
const theme = createTheme({
  primaryColor: 'primary',
  colors: {
    primary: ['#FFF0EB', '#FFD9D0', '#FFB3A1', '#FF8A6B', '#FF5A36', '#E6492D', '#C73B1F', '#A82D12', '#8A1F06', '#6B1100'],
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
