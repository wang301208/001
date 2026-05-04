import { Card, Title, Text, Table, Badge, Progress } from '@mantine/core';
import type { EvolutionProject } from '../types';

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
        <Text c="dimmed">暂无演化项目</Text>
      </Card>
    );
  }
  
  return (
    <Card shadow="sm" padding="lg" radius="md" withBorder>
      <Title order={3} mb="md">演化项目列表</Title>
      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>项目名称</Table.Th>
            <Table.Th>变异类型</Table.Th>
            <Table.Th>状态</Table.Th>
            <Table.Th>进度</Table.Th>
            <Table.Th>创建时间</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {projects.map((project) => (
            <Table.Tr key={project.id}>
              <Table.Td>
                <Text fw={500}>{project.title}</Text>
              </Table.Td>
              <Table.Td>
                <Badge variant="light">{project.mutationClass}</Badge>
              </Table.Td>
              <Table.Td>
                <Badge color={getStatusColor(project.status)}>
                  {getStatusText(project.status)}
                </Badge>
              </Table.Td>
              <Table.Td style={{ minWidth: '150px' }}>
                <Progress value={project.progress} size="sm" />
                <Text size="xs" mt="xs" ta="center">{project.progress}%</Text>
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
