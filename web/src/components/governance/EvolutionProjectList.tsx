import { Card, Title, Text, Table, Badge, Progress, Group, Stack, ThemeIcon } from '@mantine/core';
import type { EvolutionProject } from '../../types';
import { IconFlask } from '@tabler/icons-react';

interface EvolutionProjectListProps {
  projects: EvolutionProject[];
}

export function EvolutionProjectList({ projects }: EvolutionProjectListProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'proposed': return 'blue';
      case 'running': return 'yellow';
      case 'completed': return 'green';
      case 'failed': return 'red';
      default: return 'gray';
    }
  };
  
  const getStatusText = (status: string) => {
    switch (status) {
      case 'proposed': return '提议中';
      case 'running': return '运行中';
      case 'completed': return '已完成';
      case 'failed': return '失败';
      default: return status;
    }
  };
  
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('zh-CN');
  };
  
  if (projects.length === 0) {
    return (
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Stack align="center" gap="md" py="xl">
          <ThemeIcon size="xl" variant="light" color="gray">
            <IconFlask size={32} />
          </ThemeIcon>
          <Text c="dimmed">暂无演化项目</Text>
        </Stack>
      </Card>
    );
  }
  
  return (
    <Card shadow="sm" padding="lg" radius="md" withBorder>
      <Group justify="space-between" mb="md">
        <Title order={3}>演化项目列表</Title>
        <Badge variant="light" color="violet">{projects.length} 个项目</Badge>
      </Group>
      
      <Table striped highlightOnHover withTableBorder>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>项目名称</Table.Th>
            <Table.Th>变异类型</Table.Th>
            <Table.Th>状态</Table.Th>
            <Table.Th style={{ minWidth: '150px' }}>进度</Table.Th>
            <Table.Th>创建时间</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {projects.map((project) => (
            <Table.Tr key={project.id}>
              <Table.Td>
                <Text fw={600}>{project.title}</Text>
              </Table.Td>
              <Table.Td>
                <Badge variant="light" color="cyan">{project.mutationClass}</Badge>
              </Table.Td>
              <Table.Td>
                <Badge color={getStatusColor(project.status)} variant="light">
                  {getStatusText(project.status)}
                </Badge>
              </Table.Td>
              <Table.Td>
                <Stack gap="xs">
                  <Progress 
                    value={project.progress} 
                    size="sm" 
                    color={
                      project.progress >= 75 ? 'green' :
                      project.progress >= 50 ? 'blue' :
                      project.progress >= 25 ? 'yellow' : 'gray'
                    }
                  />
                  <Text size="xs" ta="center" fw={600}>{project.progress}%</Text>
                </Stack>
              </Table.Td>
              <Table.Td>
                <Text size="sm" c="dimmed">{formatDate(project.createdAt)}</Text>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Card>
  );
}
