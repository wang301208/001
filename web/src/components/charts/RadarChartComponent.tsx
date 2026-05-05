import { Card, Title, Text, Group, ThemeIcon } from '@mantine/core';
import { 
  RadarChart, 
  PolarGrid, 
  PolarAngleAxis, 
  PolarRadiusAxis, 
  Radar, 
  Tooltip, 
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { IconTarget } from '@tabler/icons-react';

interface RadarDataPoint {
  subject: string;
  value: number;
  fullMark?: number;
}

interface RadarChartComponentProps {
  title: string;
  data: RadarDataPoint[];
  color?: string;
}

export function RadarChartComponent({ title, data, color = '#228be6' }: RadarChartComponentProps) {
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div style={{
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          padding: '10px',
          border: '1px solid #dee2e6',
          borderRadius: '4px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        }}>
          <Text size="xs" fw={600}>{payload[0].payload.subject}</Text>
          <Text size="sm" c={color} fw={700}>
            {payload[0].value} / {payload[0].payload.fullMark || 100}
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
              <IconTarget size={20} />
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
            <IconTarget size={20} />
          </ThemeIcon>
          <div>
            <Title order={4}>{title}</Title>
            <Text size="xs" c="dimmed">多维度能力分析</Text>
          </div>
        </Group>
      </Group>
      
      <div style={{ width: '100%', height: 300 }}>
        <ResponsiveContainer>
          <RadarChart cx="50%" cy="50%" outerRadius="80%" data={data}>
            <PolarGrid stroke="#e9ecef" />
            <PolarAngleAxis 
              dataKey="subject" 
              tick={{ fontSize: 12, fill: '#495057' }}
            />
            <PolarRadiusAxis 
              angle={30} 
              domain={[0, 100]}
              tick={{ fontSize: 10 }}
            />
            <Radar
              name={title}
              dataKey="value"
              stroke={color}
              fill={color}
              fillOpacity={0.6}
              animationDuration={500}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
