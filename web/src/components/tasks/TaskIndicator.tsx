import { 
  Box,
  Tooltip,
  ActionIcon,
  Popover,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconLoader2 } from '@tabler/icons-react';
import { useAppStore } from '../../stores/useAppStore';
import { TaskStatusPanel } from './TaskStatusPanel';

export function TaskIndicator() {
  const [opened, { toggle, close }] = useDisclosure(false);
  const { runningTasks } = useAppStore();
  
  const activeTasks = runningTasks.filter(task => task.status === 'running');
  
  if (activeTasks.length === 0) {
    return null;
  }
  
  return (
    <>
      <Popover 
        opened={opened} 
        onClose={close}
        position="bottom-end"
        withArrow
        shadow="md"
      >
        <Popover.Target>
          <Tooltip label={`${activeTasks.length} 个任务正在运行`}>
            <ActionIcon 
              variant="light" 
              color="blue"
              onClick={toggle}
              size="lg"
            >
              <IconLoader2 size={20} className="animate-spin" />
            </ActionIcon>
          </Tooltip>
        </Popover.Target>
        
        <Popover.Dropdown style={{ padding: 0, border: 'none', background: 'transparent' }}>
          <Box style={{ width: 380 }}>
            {/* 这里可以显示简化的任务列表预览 */}
          </Box>
        </Popover.Dropdown>
      </Popover>
      
      {/* 浮动任务面板 */}
      <TaskStatusPanel />
    </>
  );
}
