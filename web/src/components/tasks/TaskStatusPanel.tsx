import { 
  Box,
  Paper,
  Group,
  Text,
  Progress,
  Badge,
  ActionIcon,
  Tooltip,
  Stack,
  ScrollArea,
  Divider,
  TextInput,
  Select,
  Menu,
} from '@mantine/core';
import { useAppStore, type TaskGroup, type TaskDuration, type RunningTask } from '../../stores/useAppStore';
import { 
  IconPlayerPlay,
  IconCheck,
  IconX,
  IconClock,
  IconTrash,
  IconTrashOff,
  IconSearch,
  IconReload,
  IconArrowUp,
  IconMinus,
  IconArrowDown,
  IconFilter,
  IconHourglassLow,
  IconHourglassHigh,
  IconHourglass,
  IconDownload,
  IconFileText,
  IconFileTypeCsv,
} from '@tabler/icons-react';
import { useMemo } from 'react';

// 格式化持续时间
function formatDuration(startTime: number, endTime?: number) {
  const end = endTime || Date.now();
  const duration = end - startTime;
  
  const seconds = Math.floor(duration / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}小时${minutes % 60}分钟`;
  } else if (minutes > 0) {
    return `${minutes}分钟${seconds % 60}秒`;
  } else {
    return `${seconds}秒`;
  }
}

// 获取状态颜色
function getStatusColor(status: string) {
  switch (status) {
    case 'running':
      return 'blue';
    case 'completed':
      return 'green';
    case 'failed':
      return 'red';
    case 'cancelled':
      return 'gray';
    default:
      return 'gray';
  }
}

// 获取状态图标
function getStatusIcon(status: string) {
  switch (status) {
    case 'running':
      return <IconPlayerPlay size={16} />;
    case 'completed':
      return <IconCheck size={16} />;
    case 'failed':
      return <IconX size={16} />;
    case 'cancelled':
      return <IconClock size={16} />;
    default:
      return <IconClock size={16} />;
  }
}

// 获取优先级颜色
function getPriorityColor(priority: string) {
  switch (priority) {
    case 'high':
      return 'red';
    case 'medium':
      return 'yellow';
    case 'low':
      return 'green';
    default:
      return 'gray';
  }
}

// 获取优先级图标
function getPriorityIcon(priority: string) {
  switch (priority) {
    case 'high':
      return <IconArrowUp size={14} />;
    case 'medium':
      return <IconMinus size={14} />;
    case 'low':
      return <IconArrowDown size={14} />;
    default:
      return null;
  }
}

// 获取分组标签
function getGroupLabel(group: string) {
  const labels: Record<string, string> = {
    system: '系统',
    data: '数据',
    network: '网络',
    file: '文件',
    ai: 'AI',
    custom: '自定义',
  };
  return labels[group] || group;
}

// 获取持续时间标签
function getDurationLabel(duration: string) {
  const labels: Record<string, string> = {
    short: '短期',
    medium: '中期',
    long: '长期',
  };
  return labels[duration] || duration;
}

// 获取持续时间图标
function getDurationIcon(duration: string) {
  switch (duration) {
    case 'short':
      return <IconHourglassLow size={14} />;
    case 'medium':
      return <IconHourglass size={14} />;
    case 'long':
      return <IconHourglassHigh size={14} />;
    default:
      return null;
  }
}

// 获取持续时间颜色
function getDurationColor(duration: string) {
  switch (duration) {
    case 'short':
      return 'green';
    case 'medium':
      return 'blue';
    case 'long':
      return 'orange';
    default:
      return 'gray';
  }
}

// 格式化剩余时间
function formatRemainingTime(estimatedEndTime?: number) {
  if (!estimatedEndTime) return null;
  
  const now = Date.now();
  const remaining = estimatedEndTime - now;
  
  if (remaining <= 0) return '即将完成';
  
  const minutes = Math.floor(remaining / (1000 * 60));
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) {
    return `剩余 ${days}天${hours % 24}小时`;
  } else if (hours > 0) {
    return `剩余 ${hours}小时${minutes % 60}分钟`;
  } else {
    return `剩余 ${minutes}分钟`;
  }
}

// 导出任务为 CSV
function exportTasksToCSV(tasks: RunningTask[]) {
  // CSV 头部
  const headers = [
    '任务ID',
    '任务名称',
    '描述',
    '状态',
    '优先级',
    '分组',
    '持续时间类型',
    '进度',
    '开始时间',
    '结束时间',
    '预计结束时间',
    '错误信息',
    '重试次数',
    '最大重试次数',
    '依赖任务',
  ];
  
  // 转换任务数据
  const rows = tasks.map(task => [
    task.id,
    task.name,
    task.description || '',
    task.status,
    task.priority,
    task.group,
    task.duration,
    task.progress !== undefined ? `${task.progress}%` : '',
    new Date(task.startTime).toLocaleString('zh-CN'),
    task.endTime ? new Date(task.endTime).toLocaleString('zh-CN') : '',
    task.estimatedEndTime ? new Date(task.estimatedEndTime).toLocaleString('zh-CN') : '',
    task.error || '',
    task.retryCount || 0,
    task.maxRetries || 3,
    task.dependencies ? task.dependencies.join(';') : '',
  ]);
  
  // 生成 CSV 内容
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
  ].join('\n');
  
  // 添加 BOM 以支持中文
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
  
  // 创建下载链接
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `tasks_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// 导出任务为 JSON
function exportTasksToJSON(tasks: RunningTask[]) {
  const jsonContent = JSON.stringify(tasks, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json' });
  
  // 创建下载链接
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `tasks_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function TaskStatusPanel() {
  const { 
    runningTasks, 
    removeTask, 
    clearCompletedTasks,
    retryTask,
    taskSearchQuery,
    taskGroupFilter,
    setTaskSearchQuery,
    setTaskGroupFilter,
    taskDurationFilter,
    setTaskDurationFilter,
  } = useAppStore();
  
  // 过滤和搜索任务
  const filteredTasks = useMemo(() => {
    let tasks = runningTasks;
    
    // 按分组过滤
    if (taskGroupFilter !== 'all') {
      tasks = tasks.filter(task => task.group === taskGroupFilter);
    }
    
    // 按时长过滤
    if (taskDurationFilter !== 'all') {
      tasks = tasks.filter(task => task.duration === taskDurationFilter);
    }
    
    // 按关键词搜索
    if (taskSearchQuery) {
      const query = taskSearchQuery.toLowerCase();
      tasks = tasks.filter(task => 
        task.name.toLowerCase().includes(query) ||
        task.description?.toLowerCase().includes(query)
      );
    }
    
    return tasks;
  }, [runningTasks, taskGroupFilter, taskDurationFilter, taskSearchQuery]);
  
  const activeTasks = filteredTasks.filter((task: any) => task.status === 'running');
  const completedTasks = filteredTasks.filter((task: any) => task.status !== 'running');
  
  if (runningTasks.length === 0) {
    return null;
  }
  
  return (
    <Paper 
      shadow="md" 
      p="md" 
      radius="md" 
      withBorder
      style={{
        position: 'fixed',
        bottom: 20,
        right: 20,
        width: 450,
        maxHeight: 600,
        zIndex: 1000,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(10px)',
      }}
    >
      {/* 头部 */}
      <Group justify="space-between" mb="md">
        <Group>
          <Text fw={600} size="lg">任务状态</Text>
          <Badge color="blue" variant="light">
            {activeTasks.length} 运行中
          </Badge>
        </Group>
        <Group gap="xs">
          {/* 导出菜单 */}
          <Menu position="bottom-end" withArrow>
            <Menu.Target>
              <Tooltip label="导出任务日志">
                <ActionIcon variant="subtle" color="blue">
                  <IconDownload size={18} />
                </ActionIcon>
              </Tooltip>
            </Menu.Target>
            
            <Menu.Dropdown>
              <Menu.Item 
                leftSection={<IconFileTypeCsv size={16} />}
                onClick={() => exportTasksToCSV(filteredTasks)}
              >
                导出为 CSV
              </Menu.Item>
              <Menu.Item 
                leftSection={<IconFileText size={16} />}
                onClick={() => exportTasksToJSON(filteredTasks)}
              >
                导出为 JSON
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
          
          {/* 清除已完成任务 */}
          {completedTasks.length > 0 && (
            <Tooltip label="清除已完成任务">
              <ActionIcon variant="subtle" color="gray" onClick={clearCompletedTasks}>
                <IconTrashOff size={18} />
              </ActionIcon>
            </Tooltip>
          )}
        </Group>
      </Group>
      
      {/* 搜索和过滤 */}
      <Stack gap="xs" mb="md">
        <TextInput
          placeholder="搜索任务..."
          leftSection={<IconSearch size={16} />}
          value={taskSearchQuery}
          onChange={(e) => setTaskSearchQuery(e.target.value)}
          size="sm"
        />
        
        <Group grow>
          <Select
            placeholder="全部分组"
            leftSection={<IconFilter size={16} />}
            value={taskGroupFilter}
            onChange={(value) => setTaskGroupFilter((value as TaskGroup) || 'all')}
            data={[
              { value: 'all', label: '全部分组' },
              { value: 'system', label: '系统' },
              { value: 'data', label: '数据' },
              { value: 'network', label: '网络' },
              { value: 'file', label: '文件' },
              { value: 'ai', label: 'AI' },
              { value: 'custom', label: '自定义' },
            ]}
            size="sm"
          />
          
          <Select
            placeholder="全部时长"
            leftSection={<IconClock size={16} />}
            value={taskDurationFilter}
            onChange={(value) => setTaskDurationFilter((value as TaskDuration) || 'all')}
            data={[
              { value: 'all', label: '全部时长' },
              { value: 'short', label: '短期 (<5分钟)' },
              { value: 'medium', label: '中期 (5-60分钟)' },
              { value: 'long', label: '长期 (>1小时)' },
            ]}
            size="sm"
          />
        </Group>
      </Stack>
      
      <Divider mb="md" />
      
      {/* 任务列表 */}
      <ScrollArea style={{ maxHeight: 400 }}>
        <Stack gap="sm">
          {filteredTasks.map((task: any) => (
            <Paper 
              key={task.id}
              p="sm"
              withBorder
              style={{
                borderLeft: `4px solid var(--mantine-color-${getStatusColor(task.status)}-6)`,
              }}
            >
              <Group justify="space-between" mb="xs">
                <Group gap="xs">
                  {getStatusIcon(task.status)}
                  <Text fw={500} size="sm">{task.name}</Text>
                  
                  {/* 优先级标识 */}
                  <Badge 
                    color={getPriorityColor(task.priority || 'medium')} 
                    variant="light"
                    size="sm"
                    leftSection={getPriorityIcon(task.priority || 'medium')}
                  >
                    {task.priority === 'high' ? '高' : task.priority === 'medium' ? '中' : '低'}
                  </Badge>
                  
                  {/* 分组标识 */}
                  <Badge 
                    color="gray" 
                    variant="outline"
                    size="sm"
                  >
                    {getGroupLabel(task.group || 'custom')}
                  </Badge>
                  
                  {/* 持续时间标识 */}
                  <Badge 
                    color={getDurationColor(task.duration || 'short')} 
                    variant="light"
                    size="sm"
                    leftSection={getDurationIcon(task.duration || 'short')}
                  >
                    {getDurationLabel(task.duration || 'short')}
                  </Badge>

                </Group>
                <Group gap="xs">
                  <Badge 
                    color={getStatusColor(task.status)} 
                    variant="light"
                    size="sm"
                  >
                    {task.status === 'running' ? '运行中' : 
                     task.status === 'completed' ? '已完成' :
                     task.status === 'failed' ? '失败' : '已取消'}
                  </Badge>
                  
                  {/* 重试按钮（仅失败任务显示） */}
                  {task.status === 'failed' && (
                    <Tooltip label={`重试 (${(task.retryCount || 0)}/${task.maxRetries || 3})`}>
                      <ActionIcon 
                        size="xs" 
                        variant="subtle" 
                        color="blue"
                        onClick={() => retryTask(task.id)}
                        disabled={(task.retryCount || 0) >= (task.maxRetries || 3)}
                      >
                        <IconReload size={14} />
                      </ActionIcon>
                    </Tooltip>
                  )}
                  
                  <Tooltip label="移除任务">
                    <ActionIcon 
                      size="xs" 
                      variant="subtle" 
                      color="gray"
                      onClick={() => removeTask(task.id)}
                    >
                      <IconTrash size={14} />
                    </ActionIcon>
                  </Tooltip>
                </Group>
              </Group>
              
              {task.description && (
                <Text size="xs" c="dimmed" mb="xs">
                  {task.description}
                </Text>
              )}
              
              {/* 依赖关系 */}
              {task.dependencies && task.dependencies.length > 0 && (
                <Box mb="xs">
                  <Text size="xs" fw={500} mb="xs">依赖任务:</Text>
                  <Group gap="xs">
                    {task.dependencies.map((depId: string) => {
                      const depTask = runningTasks.find((t: any) => t.id === depId);
                      return (
                        <Badge 
                          key={depId}
                          size="xs"
                          color={depTask?.status === 'completed' ? 'green' : 'yellow'}
                          variant="light"
                        >
                          {depTask?.name || depId.substring(0, 8)}
                        </Badge>
                      );
                    })}
                  </Group>
                </Box>
              )}
              
              {/* 进度条 */}
              {task.status === 'running' && task.progress !== undefined && (
                <Box mb="xs">
                  <Progress 
                    value={task.progress} 
                    size="sm"
                    color={getStatusColor(task.status)}
                    striped
                    animated
                  />
                  <Text size="xs" c="dimmed" mt="xs">
                    进度: {Math.round(task.progress)}%
                  </Text>
                </Box>
              )}
              
              {/* 错误信息 */}
              {task.error && (
                <Text size="xs" c="red" mt="xs">
                  错误: {task.error}
                </Text>
              )}
              
              {/* 时间信息 */}
              <Group gap="xs" mt="xs">
                <Text size="xs" c="dimmed">
                  耗时: {formatDuration(task.startTime, task.endTime)}
                </Text>
                
                {/* 长期任务显示预计剩余时间 */}
                {task.duration === 'long' && task.status === 'running' && task.estimatedEndTime && (
                  <Text size="xs" c="blue" fw={500}>
                    • {formatRemainingTime(task.estimatedEndTime)}
                  </Text>
                )}
                
                {task.retryCount && task.retryCount > 0 && (
                  <Text size="xs" c="orange">
                    • 重试: {task.retryCount}次
                  </Text>
                )}
                {task.endTime && (
                  <Text size="xs" c="dimmed">
                    • 完成于: {new Date(task.endTime).toLocaleTimeString('zh-CN')}
                  </Text>
                )}
              </Group>
            </Paper>
          ))}
        </Stack>
      </ScrollArea>
    </Paper>
  );
}
