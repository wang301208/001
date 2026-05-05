import { Card, Title, Text, Group, ThemeIcon } from '@mantine/core';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend,
  Cell,
} from 'recharts';
import { IconChartBar } from '@tabler/icons-react';
import type { ChartDataPoint } from '../../types';

interface BarChartComponentProps {
  title: string;
  data: ChartDataPoint[];
  colors?: string[];
  unit?: string;
}

const COLORS = ['#228be6', '#40c057', '#fab005', '#fa5252', '#7950f2', '#20c997'];

export function BarChartComponent({ 
  title, 
  data, 
  colors = COLORS,
  unit = '' 
}: BarChartComponentProps) {
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
          <Text size="xs" fw={600}>{label}</Text>
          <Text size="sm" c={payload[0].color} fw={700}>
            {payload[0].value}{unit}
          </Text>
        </div>
      );
    }
    return null;
  };
  
  return (
    <Card shadow="sm" padding="lg" radius="md" withBorder>
      <Group justify="space-between" mb="md">
        <Group>
          <ThemeIcon variant="light" color="violet" size="lg">
            <IconChartBar size={20} />
          </ThemeIcon>
          <div>
            <Title order={4}>{title}</Title>
            <Text size="xs" c="dimmed">分类数据对比</Text>
          </div>
        </Group>
      </Group>
      
      <div style={{ width: '100%', height: 300 }}>
        <ResponsiveContainer>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e9ecef" />
            <XAxis 
              dataKey="name" 
              tick={{ fontSize: 12 }}
              stroke="#adb5bd"
            />
            <YAxis 
              tick={{ fontSize: 12 }}
              stroke="#adb5bd"
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Bar 
              dataKey="value" 
              name={title}
              radius={[4, 4, 0, 0]}
            >
              {data.map((_, index) => (
                <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
