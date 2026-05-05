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
  LoadingOverlay,
  Alert,
} from '@mantine/core';
import { 
  IconSend, 
  IconRobot, 
  IconUser,
  IconTrash,
  IconCopy,
  IconAlertCircle,
  IconRefresh,
} from '@tabler/icons-react';
import { useState, useRef, useEffect } from 'react';
import { useAppStore } from '../stores/useAppStore';
import { apiService } from '../services/api';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

export function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const { addNotification } = useAppStore();

  // 初始化会话
  useEffect(() => {
    initializeSession();
  }, []);

  // 自动滚动到底部
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight });
    }
  }, [messages]);

  // 聚焦输入框
  useEffect(() => {
    if (inputRef.current && !isProcessing) {
      inputRef.current.focus();
    }
  }, [messages, isProcessing]);

  // 初始化或加载会话
  const initializeSession = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // 尝试获取现有会话列表
      const sessionsResponse = await apiService.getSessions(1);
      
      let currentSessionId: string;
      
      if (sessionsResponse.success && sessionsResponse.data && sessionsResponse.data.length > 0) {
        // 使用最近的会话
        currentSessionId = sessionsResponse.data[0].id;
        
        // 加载该会话的历史消息
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
        // 创建新会话
        const createResponse = await apiService.createSession('默认会话');
        
        if (createResponse.success && createResponse.data) {
          currentSessionId = createResponse.data.sessionId;
          
          // 添加欢迎消息
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
    } catch (err) {
      console.error('[ChatPage] 初始化会话失败:', err);
      setError('无法连接到后端服务，请检查网关是否正常运行');
      
      // 降级：使用本地会话
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
  };

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
      // 发送到后端 API
      const response = await apiService.sendMessage(sessionId, userMessage.content);
      
      if (!response.success) {
        throw new Error(response.error || '发送消息失败');
      }
      
      // 等待助手响应（实际应该通过 WebSocket 或轮询获取）
      // 这里先模拟一个延迟，然后重新加载消息
      setTimeout(async () => {
        try {
          const messagesResponse = await apiService.getSessionMessages(sessionId, 50);
          
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
      }, 1000);
      
      addNotification('success', '消息已发送', '助手正在处理您的请求');
    } catch (err) {
      console.error('[ChatPage] 发送消息失败:', err);
      setError('发送消息失败，请稍后重试');
      setIsProcessing(false);
      
      // 移除失败的用户消息
      setMessages(prev => prev.filter(msg => msg.id !== userMessage.id));
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const clearChat = () => {
    setMessages([]);
    addNotification('info', '聊天已清空', '所有消息已被清除');
  };

  const copyMessage = (content: string) => {
    navigator.clipboard.writeText(content);
    addNotification('success', '已复制', '消息内容已复制到剪贴板');
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Box style={{ height: 'calc(100vh - 140px)', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      {/* 加载遮罩 */}
      <LoadingOverlay visible={loading} />
      
      {/* 错误提示 */}
      {error && (
        <Alert 
          icon={<IconAlertCircle size={16} />} 
          title="连接错误" 
          color="red" 
          mb="md"
          onClose={() => setError(null)}
        >
          {error}
          <Button 
            variant="light" 
            size="xs" 
            mt="xs"
            onClick={initializeSession}
            leftSection={<IconRefresh size={14} />}
          >
            重新连接
          </Button>
        </Alert>
      )}
      
      {/* 聊天头部 */}
      <Paper p="md" withBorder style={{ borderBottom: 'none', borderRadius: 'var(--mantine-radius-md) var(--mantine-radius-md) 0 0' }}>
        <Group justify="space-between">
          <Group>
            <Avatar color="blue" radius="xl">
              <IconRobot size={24} />
            </Avatar>
            <div>
              <Text fw={600} size="lg">系统助手</Text>
              <Text size="xs" c="dimmed">
                {sessionId?.startsWith('local') ? '离线模式' : '在线'} • 随时为您服务
              </Text>
            </div>
          </Group>
          <Group gap="xs">
            <Tooltip label="刷新会话">
              <ActionIcon 
                variant="subtle" 
                color="blue" 
                onClick={initializeSession}
                loading={loading}
              >
                <IconRefresh size={18} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="清空对话">
              <ActionIcon variant="subtle" color="red" onClick={clearChat}>
                <IconTrash size={18} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>
      </Paper>

      {/* 消息列表 */}
      <ScrollArea 
        ref={scrollRef}
        flex={1} 
        p="md"
        style={{ backgroundColor: '#f8f9fa' }}
      >
        <Stack gap="md">
          {messages.length === 0 && !loading ? (
            <Box ta="center" py="xl">
              <Avatar color="gray" radius="xl" size="lg" mx="auto">
                <IconRobot size={32} />
              </Avatar>
              <Text c="dimmed" mt="md">暂无消息，开始对话吧！</Text>
            </Box>
          ) : (
            messages.map((message) => (
              <Group 
                key={message.id} 
                gap="md" 
                align="flex-start"
                style={{ 
                  justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start',
                }}
              >
                {message.role === 'assistant' && (
                  <Avatar color="blue" radius="xl">
                    <IconRobot size={20} />
                  </Avatar>
                )}
                
                <Paper
                  p="md"
                  shadow="sm"
                  style={{
                    maxWidth: '70%',
                    backgroundColor: message.role === 'user' ? '#228be6' : 'white',
                    color: message.role === 'user' ? 'white' : 'inherit',
                    borderRadius: message.role === 'user' 
                      ? 'var(--mantine-radius-md) var(--mantine-radius-md) 0 var(--mantine-radius-md)'
                      : 'var(--mantine-radius-md) var(--mantine-radius-md) var(--mantine-radius-md) 0',
                  }}
                >
                  <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>{message.content}</Text>
                  <Group justify="space-between" mt="xs" gap="xs">
                    <Text size="xs" c={message.role === 'user' ? 'rgba(255,255,255,0.7)' : 'dimmed'}>
                      {formatTime(message.timestamp)}
                    </Text>
                    {message.role === 'assistant' && (
                      <Tooltip label="复制消息">
                        <ActionIcon 
                          size="xs" 
                          variant="subtle" 
                          color="gray"
                          onClick={() => copyMessage(message.content)}
                        >
                          <IconCopy size={14} />
                        </ActionIcon>
                      </Tooltip>
                    )}
                  </Group>
                </Paper>

                {message.role === 'user' && (
                  <Avatar color="blue" radius="xl">
                    <IconUser size={20} />
                  </Avatar>
                )}
              </Group>
            ))
          )}
          
          {isProcessing && (
            <Group gap="md" align="flex-start">
              <Avatar color="blue" radius="xl">
                <IconRobot size={20} />
              </Avatar>
              <Paper p="md" shadow="sm" style={{ backgroundColor: 'white' }}>
                <Badge variant="light" color="blue">思考中...</Badge>
              </Paper>
            </Group>
          )}
        </Stack>
      </ScrollArea>

      {/* 输入区域 */}
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
          <Button
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || isProcessing}
            loading={isProcessing}
            size="md"
          >
            <IconSend size={18} />
          </Button>
        </Group>
        <Text size="xs" c="dimmed" mt="xs">
          💡 提示：您可以询问系统状态、执行命令或获取帮助
        </Text>
      </Paper>
    </Box>
  );
}
