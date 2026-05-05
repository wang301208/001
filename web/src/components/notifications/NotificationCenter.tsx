import { ActionIcon, Badge } from '@mantine/core';
import { IconBell } from '@tabler/icons-react';
import { useAppStore } from '../../stores/useAppStore';
import { NotificationPanel } from './NotificationPanel';
import { useState } from 'react';

export function NotificationCenter() {
  const { unreadCount } = useAppStore();
  const [panelOpened, setPanelOpened] = useState(false);
  
  return (
    <>
      <ActionIcon 
        variant="subtle" 
        size="lg"
        onClick={() => setPanelOpened(!panelOpened)}
        style={{ position: 'relative' }}
      >
        <IconBell size={20} />
        {unreadCount > 0 && (
          <Badge 
            size="sm" 
            color="red" 
            variant="filled"
            style={{
              position: 'absolute',
              top: '-4px',
              right: '-4px',
              minWidth: '18px',
              height: '18px',
              padding: '0 4px',
              fontSize: '10px',
            }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </Badge>
        )}
      </ActionIcon>
      
      <NotificationPanel 
        opened={panelOpened}
      />
    </>
  );
}
