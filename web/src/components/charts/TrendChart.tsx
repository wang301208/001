import { Card, Title, Text, Group, ThemeIcon, Skeleton } from '@mantine/core';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { IconTrendingUp } from '@tabler/icons-react';
import type { TimeSeriesData } from '../../types';

interface TrendChartProps {
  title: string;
  data: TimeSeriesData[];
  color?: string;
  unit?: string;
  loading?: boolean;
}

export function TrendChart({ title, data, color = '#228be6', unit = '', loading = false }: TrendChartProps) {
  const formatXAxis = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('zh-CN', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };
  
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div style={{
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          padding: '10px',
          border: '1px solid #dee2e6',
          borderRadius: '4px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        }}>
          <Text size="xs" fw={600}>{formatXAxis(label)}</Text>
          <Text size="sm" c={color} fw={700}>
            {payload[0].value}{unit}
          </Text>
        </div>
      );
    }
    return null;
  };
  
  if (loading) {
    return (
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Skeleton height={40} mb="md" />
        <Skeleton height={300} />
      </Card>
    );
  }
  
  if (!data || data.length === 0) {
    return (
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Group justify="space-between" mb="md">
          <Group>
            <ThemeIcon variant="light" color="blue" size="lg">
              <IconTrendingUp size={20} />
            </ThemeIcon>
            <div>
              <Title order={4}>{title}</Title>
              <Text size="xs" c="dimmed">暂无数据</Text>
            </div>
          </Group>
        </Group>
        <Group align="center" gap="md" py="xl" justify="center">
          <Text c="dimmed">等待数据...</Text>
        </Group>
      </Card>
    );
  }
  
  return (
    <Card shadow="sm" padding="lg" radius="md" withBorder>
      <Group justify="space-between" mb="md">
        <Group>
          <ThemeIcon variant="light" color="blue" size="lg">
            <IconTrendingUp size={20} />
          </ThemeIcon>
          <div>
            <Title order={4}>{title}</Title>
            <Text size="xs" c="dimmed">实时趋势监控</Text>
          </div>
        </Group>
      </Group>
      
      <div style={{ width: '100%', height: 300 }}>
        <ResponsiveContainer>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e9ecef" />
            <XAxis 
              dataKey="timestamp" 
              tickFormatter={formatXAxis}
              tick={{ fontSize: 12 }}
              stroke="#adb5bd"
            />
            <YAxis 
              tick={{ fontSize: 12 }}
              stroke="#adb5bd"
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Line 
              type="monotone" 
              dataKey="value" 
              stroke={color} 
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 6 }}
              name={title}
              animationDuration={500}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
