import { Card, Title, Text, Group, ThemeIcon } from '@mantine/core';
import { 
  PieChart, 
  Pie, 
  Cell, 
  Tooltip, 
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { IconChartPie } from '@tabler/icons-react';
import type { ChartDataPoint } from '../../types';

interface PieChartComponentProps {
  title: string;
  data: ChartDataPoint[];
  colors?: string[];
}

const COLORS = ['#228be6', '#40c057', '#fab005', '#fa5252', '#7950f2', '#20c997', '#fd7e14'];

export function PieChartComponent({ 
  title, 
  data, 
  colors = COLORS 
}: PieChartComponentProps) {
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const total = data.reduce((sum, item) => sum + item.value, 0);
      const percentage = ((payload[0].value / total) * 100).toFixed(1);
      
      return (
        <div style={{
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          padding: '10px',
          border: '1px solid #dee2e6',
          borderRadius: '4px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        }}>
          <Text size="xs" fw={600}>{payload[0].name}</Text>
          <Text size="sm" c={payload[0].color} fw={700}>
            {payload[0].value} ({percentage}%)
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
          <ThemeIcon variant="light" color="teal" size="lg">
            <IconChartPie size={20} />
          </ThemeIcon>
          <div>
            <Title order={4}>{title}</Title>
            <Text size="xs" c="dimmed">占比分布分析</Text>
          </div>
        </Group>
      </Group>
      
      <div style={{ width: '100%', height: 300 }}>
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              outerRadius={100}
              fill="#8884d8"
              dataKey="value"
              nameKey="name"
            >
              {data.map((_, index) => (
                <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
