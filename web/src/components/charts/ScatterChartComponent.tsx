import { Card, Title, Text, Group, ThemeIcon } from '@mantine/core';
import { 
  ScatterChart, 
  Scatter, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  ZAxis,
} from 'recharts';
import { IconCircleDotted } from '@tabler/icons-react';

interface ScatterDataPoint {
  x: number;
  y: number;
  z?: number;
  name?: string;
}

interface ScatterChartComponentProps {
  title: string;
  data: ScatterDataPoint[];
  color?: string;
  xAxisLabel?: string;
  yAxisLabel?: string;
}

export function ScatterChartComponent({ 
  title, 
  data, 
  color = '#228be6',
  xAxisLabel = 'X',
  yAxisLabel = 'Y'
}: ScatterChartComponentProps) {
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const point = payload[0].payload;
      return (
        <div style={{
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          padding: '10px',
          border: '1px solid #dee2e6',
          borderRadius: '4px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        }}>
          {point.name && <Text size="xs" fw={600}>{point.name}</Text>}
          <Text size="sm" c={color}>
            {xAxisLabel}: {point.x}, {yAxisLabel}: {point.y}
          </Text>
          {point.z !== undefined && (
            <Text size="xs" c="dimmed">Z: {point.z}</Text>
          )}
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
              <IconCircleDotted size={20} />
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
            <IconCircleDotted size={20} />
          </ThemeIcon>
          <div>
            <Title order={4}>{title}</Title>
            <Text size="xs" c="dimmed">数据分布分析</Text>
          </div>
        </Group>
      </Group>
      
      <div style={{ width: '100%', height: 300 }}>
        <ResponsiveContainer>
          <ScatterChart>
            <CartesianGrid strokeDasharray="3 3" stroke="#e9ecef" />
            <XAxis 
              type="number"
              dataKey="x"
              name={xAxisLabel}
              tick={{ fontSize: 12 }}
              stroke="#adb5bd"
              label={{ value: xAxisLabel, position: 'insideBottom', offset: -5, fontSize: 12 }}
            />
            <YAxis 
              type="number"
              dataKey="y"
              name={yAxisLabel}
              tick={{ fontSize: 12 }}
              stroke="#adb5bd"
              label={{ value: yAxisLabel, angle: -90, position: 'insideLeft', fontSize: 12 }}
            />
            <ZAxis type="number" dataKey="z" range={[50, 400]} />
            <Tooltip cursor={{ strokeDasharray: '3 3' }} content={<CustomTooltip />} />
            <Scatter 
              name={title}
              data={data}
              fill={color}
              animationDuration={500}
            />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
