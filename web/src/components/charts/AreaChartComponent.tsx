import { Card, Title, Text, Group, ThemeIcon } from '@mantine/core';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
} from 'recharts';
import { IconTrendingUp } from '@tabler/icons-react';
import type { TimeSeriesData } from '../../types';

interface AreaChartComponentProps {
  title: string;
  data: TimeSeriesData[];
  color?: string;
  unit?: string;
}

export function AreaChartComponent({ title, data, color = '#228be6', unit = '' }: AreaChartComponentProps) {
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
            <Text size="xs" c="dimmed">累积趋势分析</Text>
          </div>
        </Group>
      </Group>
      
      <div style={{ width: '100%', height: 300 }}>
        <ResponsiveContainer>
          <AreaChart data={data}>
            <defs>
              <linearGradient id={`color${title}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.8}/>
                <stop offset="95%" stopColor={color} stopOpacity={0}/>
              </linearGradient>
            </defs>
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
            <Area 
              type="monotone" 
              dataKey="value" 
              stroke={color} 
              fillOpacity={1}
              fill={`url(#color${title})`}
              name={title}
              animationDuration={500}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
