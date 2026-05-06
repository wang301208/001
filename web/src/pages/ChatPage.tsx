import { 
  Box,
  Paper,
  TextInput,
  Button,
  Group,
  Stack,
  Text,
  ScrollArea,
  Avatar,
  Badge,
  ActionIcon,
  Tooltip,
  Alert,
  Select,
} from '@mantine/core';
import { 
  IconSend, 
  IconRobot, 
  IconUser,
  IconTrash,
  IconCopy,
  IconAlertCircle,
  IconRefresh,
  IconPlayerStop,
  IconPlus,
} from '@tabler/icons-react';
import { useState, useRef, useEffect, useCallback } from 'react';
import { useAppStore } from '../stores/useAppStore';
import { apiService, normalizeChatMessage } from '../services/api';
import { wsManager } from '../services/ws-manager';
import { LoadingState } from '../components/ui/LoadingState';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

interface SessionItem {
  id: string;
  title?: string;
  createdAt: number;
}

export function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [isOffline, setIsOffline] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const { addNotification } = useAppStore();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight });
    }
  }, [messages]);

  useEffect(() => {
    if (inputRef.current && !isProcessing) {
      inputRef.current.focus();
    }
  }, [messages, isProcessing]);

  useEffect(() => {
    const unsub = wsManager.onEvent('session.*', (event) => {
      if (event.type === 'session.message' && event.payload) {
        if (sessionId && event.payload.sessionKey && event.payload.sessionKey !== sessionId) {
          return;
        }
        const msg = normalizeChatMessage(event.payload);
        setMessages(prev => {
          if (prev.some(m => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        setIsProcessing(false);
      }
    });
    return unsub;
  }, [sessionId]);

  const loadSessionList = useCallback(async () => {
    try {
      const response = await apiService.getSessions(20);
      if (response.success && response.data) {
        setSessions(response.data.map((s: any) => ({
          id: s.id,
          title: s.title || `会话 ${s.id.slice(0, 8)}`,
          createdAt: s.createdAt,
        })));
      }
    } catch (err) {
      console.error('[ChatPage] 加载会话列表失败:', err);
    }
  }, []);

  const initializeSession = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      await loadSessionList();
      
      const sessionsResponse = await apiService.getSessions(1);
      
      let currentSessionId: string;
      
      if (sessionsResponse.success && sessionsResponse.data && sessionsResponse.data.length > 0) {
        currentSessionId = sessionsResponse.data[0].id;
        
        const messagesResponse = await apiService.getSessionMessages(currentSessionId, 50);
        
        if (messagesResponse.success && messagesResponse.data) {
          const formattedMessages: Message[] = messagesResponse.data.map((msg: any) => ({
            id: msg.id || Date.now().toString(),
            role: msg.role || 'assistant',
            content: msg.content || '',
            timestamp: msg.timestamp || Date.now(),
          }));
          
          setMessages(formattedMessages);
        }
      } else {
        const createResponse = await apiService.createSession('新会话');
        
        if (createResponse.success && createResponse.data) {
          currentSessionId = createResponse.data.sessionId;
          setMessages([{
            id: 'welcome',
            role: 'assistant',
            content: '您好！我是系统助手。您可以向我发送命令或提问，我会帮助您管理系统。',
            timestamp: Date.now(),
          }]);
        } else {
          throw new Error('创建会话失败');
        }
      }
      
      setSessionId(currentSessionId);
      setIsOffline(false);
    } catch (err) {
      console.error('[ChatPage] 初始化会话失败:', err);
      setError('无法连接到后端服务，请检查网关是否正常运行');
      setIsOffline(true);
      setSessionId('local-' + Date.now());
      setMessages([{
        id: 'welcome',
        role: 'assistant',
        content: '您好！我是系统助手（离线模式）。由于无法连接后端，部分功能可能受限。',
        timestamp: Date.now(),
      }]);
    } finally {
      setLoading(false);
    }
  }, [loadSessionList]);

  useEffect(() => {
    initializeSession();
  }, [initializeSession]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isProcessing || !sessionId) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue.trim(),
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsProcessing(true);
    setError(null);

    try {
      const response = await apiService.sendMessage(sessionId, userMessage.content);
      
      if (!response.success) {
        throw new Error(response.error || '发送消息失败');
      }

      if (response.data && response.data.content) {
        setMessages(prev => [...prev, {
          id: response.data.id || Date.now().toString(),
          role: 'assistant',
          content: response.data.content,
          timestamp: Date.now(),
        }]);
        setIsProcessing(false);
      } else {
        setTimeout(async () => {
          try {
            const messagesResponse = await apiService.getSessionMessages(sessionId!, 50);
            if (messagesResponse.success && messagesResponse.data) {
              const formattedMessages: Message[] = messagesResponse.data.map((msg: any) => ({
                id: msg.id || Date.now().toString(),
                role: msg.role || 'assistant',
                content: msg.content || '',
                timestamp: msg.timestamp || Date.now(),
              }));
              setMessages(formattedMessages);
            }
          } catch (err) {
            console.error('[ChatPage] 加载消息失败:', err);
          } finally {
            setIsProcessing(false);
          }
        }, 1500);
      }
    } catch (err) {
      console.error('[ChatPage] 发送消息失败:', err);
      setError('发送消息失败，请稍后重试');
      setIsProcessing(false);
      setMessages(prev => prev.filter(msg => msg.id !== userMessage.id));
    }
  };

  const handleAbort = async () => {
    if (!sessionId) return;
    try {
      await apiService.abortChat(sessionId);
      setIsProcessing(false);
      addNotification('info', '已中止', '助手响应已中止');
    } catch (err) {
      console.error('[ChatPage] 中止失败:', err);
    }
  };

  const handleNewSession = async () => {
    try {
      const response = await apiService.createSession('新会话');
      if (response.success && response.data) {
        setSessionId(response.data.sessionId);
        setMessages([{
          id: 'welcome',
          role: 'assistant',
          content: '新会话已创建。请输入您的问题或命令。',
          timestamp: Date.now(),
        }]);
        await loadSessionList();
        addNotification('success', '新会话', '已创建新会话');
      }
    } catch (err) {
      addNotification('error', '创建失败', '创建新会话失败');
    }
  };

  const handleDeleteSession = async () => {
    if (!sessionId || isOffline) return;
    try {
      await apiService.deleteSession(sessionId);
      addNotification('info', '会话已删除', '当前会话已被删除');
      await initializeSession();
    } catch (err) {
      addNotification('error', '删除失败', '删除会话失败');
    }
  };

  const handleSwitchSession = async (newSessionId: string) => {
    if (newSessionId === sessionId) return;
    setLoading(true);
    try {
      setSessionId(newSessionId);
      const messagesResponse = await apiService.getSessionMessages(newSessionId, 50);
      if (messagesResponse.success && messagesResponse.data) {
        const formattedMessages: Message[] = messagesResponse.data.map((msg: any) => ({
          id: msg.id || Date.now().toString(),
          role: msg.role || 'assistant',
          content: msg.content || '',
          timestamp: msg.timestamp || Date.now(),
        }));
        setMessages(formattedMessages);
      } else {
        setMessages([]);
      }
    } catch (err) {
      setMessages([]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const copyMessage = (content: string) => {
    navigator.clipboard.writeText(content);
    addNotification('success', '已复制', '消息内容已复制到剪贴板');
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  };

  if (loading && messages.length === 0) {
    return <LoadingState message="初始化会话..." />;
  }

  return (
    <Box style={{ height: 'calc(100vh - 140px)', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      {error && (
        <Alert icon={<IconAlertCircle size={16} />} title="连接错误" color="red" mb="md" onClose={() => setError(null)}>
          {error}
          <Button variant="light" size="xs" mt="xs" onClick={initializeSession} leftSection={<IconRefresh size={14} />}>
            重新连接
          </Button>
        </Alert>
      )}
      
      <Paper p="md" withBorder style={{ borderBottom: 'none', borderRadius: 'var(--mantine-radius-md) var(--mantine-radius-md) 0 0' }}>
        <Group justify="space-between">
          <Group>
            <Avatar color="blue" radius="xl"><IconRobot size={24} /></Avatar>
            <div>
              <Text fw={600} size="lg">系统助手</Text>
              <Text size="xs" c="dimmed">
                {isOffline ? '离线模式' : '在线'} • 随时为您服务
              </Text>
            </div>
          </Group>
          <Group gap="xs">
            {sessions.length > 0 && (
              <Select
                size="xs"
                w={150}
                placeholder="切换会话"
                value={sessionId || ''}
                data={sessions.map(s => ({ value: s.id, label: s.title || s.id.slice(0, 8) }))}
                onChange={(val) => val && handleSwitchSession(val)}
              />
            )}
            <Tooltip label="新建会话">
              <ActionIcon variant="subtle" color="green" onClick={handleNewSession}>
                <IconPlus size={18} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="刷新会话">
              <ActionIcon variant="subtle" color="blue" onClick={initializeSession} loading={loading}>
                <IconRefresh size={18} />
              </ActionIcon>
            </Tooltip>
            {!isOffline && (
              <Tooltip label="删除会话">
                <ActionIcon variant="subtle" color="red" onClick={handleDeleteSession}>
                  <IconTrash size={18} />
                </ActionIcon>
              </Tooltip>
            )}
          </Group>
        </Group>
      </Paper>

      <ScrollArea ref={scrollRef} flex={1} p="md" style={{ backgroundColor: '#f8f9fa' }}>
        <Stack gap="md">
          {messages.length === 0 && !loading ? (
            <Box ta="center" py="xl">
              <Avatar color="gray" radius="xl" size="lg" mx="auto"><IconRobot size={32} /></Avatar>
              <Text c="dimmed" mt="md">暂无消息，开始对话吧！</Text>
            </Box>
          ) : (
            messages.map((message) => (
              <Group key={message.id} gap="md" align="flex-start" style={{ justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start' }}>
                {message.role === 'assistant' && <Avatar color="blue" radius="xl"><IconRobot size={20} /></Avatar>}
                <Paper p="md" shadow="sm" style={{
                  maxWidth: '70%',
                  backgroundColor: message.role === 'user' ? '#228be6' : 'white',
                  color: message.role === 'user' ? 'white' : 'inherit',
                  borderRadius: message.role === 'user' 
                    ? 'var(--mantine-radius-md) var(--mantine-radius-md) 0 var(--mantine-radius-md)'
                    : 'var(--mantine-radius-md) var(--mantine-radius-md) var(--mantine-radius-md) 0',
                }}>
                  <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>{message.content}</Text>
                  <Group justify="space-between" mt="xs" gap="xs">
                    <Text size="xs" c={message.role === 'user' ? 'rgba(255,255,255,0.7)' : 'dimmed'}>
                      {formatTime(message.timestamp)}
                    </Text>
                    {message.role === 'assistant' && (
                      <Tooltip label="复制消息">
                        <ActionIcon size="xs" variant="subtle" color="gray" onClick={() => copyMessage(message.content)}>
                          <IconCopy size={14} />
                        </ActionIcon>
                      </Tooltip>
                    )}
                  </Group>
                </Paper>
                {message.role === 'user' && <Avatar color="blue" radius="xl"><IconUser size={20} /></Avatar>}
              </Group>
            ))
          )}
          
          {isProcessing && (
            <Group gap="md" align="flex-start">
              <Avatar color="blue" radius="xl"><IconRobot size={20} /></Avatar>
              <Paper p="md" shadow="sm" style={{ backgroundColor: 'white' }}>
                <Group gap="xs">
                  <Badge variant="light" color="blue">思考中...</Badge>
                  <ActionIcon size="xs" variant="subtle" color="red" onClick={handleAbort} title="中止">
                    <IconPlayerStop size={14} />
                  </ActionIcon>
                </Group>
              </Paper>
            </Group>
          )}
        </Stack>
      </ScrollArea>

      <Paper p="md" withBorder style={{ borderTop: 'none', borderRadius: '0 0 var(--mantine-radius-md) var(--mantine-radius-md)' }}>
        <Group gap="sm">
          <TextInput
            ref={inputRef}
            placeholder="输入消息或命令... (按 Enter 发送)"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={isProcessing}
            style={{ flex: 1 }}
            size="md"
          />
          {isProcessing ? (
            <Button onClick={handleAbort} color="red" size="md">
              <IconPlayerStop size={18} />
            </Button>
          ) : (
            <Button
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || isProcessing}
              size="md"
            >
              <IconSend size={18} />
            </Button>
          )}
        </Group>
        <Text size="xs" c="dimmed" mt="xs">
          提示：您可以询问系统状态、执行命令或获取帮助
        </Text>
      </Paper>
    </Box>
  );
}
