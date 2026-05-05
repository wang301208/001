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
} from '@mantine/core';
import { 
  IconSend, 
  IconRobot, 
  IconUser,
  IconTrash,
  IconCopy,
} from '@tabler/icons-react';
import { useState, useRef, useEffect } from 'react';
import { useAppStore } from '../stores/useAppStore';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

export function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: '您好！我是系统助手。您可以向我发送命令或提问，我会帮助您管理系统。',
      timestamp: Date.now(),
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const { addNotification } = useAppStore();

  // 自动滚动到底部
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight });
    }
  }, [messages]);

  // 聚焦输入框
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isProcessing) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue.trim(),
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsProcessing(true);

    // 模拟 AI 响应（实际应该调用后端 API）
    setTimeout(() => {
      const responses = [
        '收到您的命令，正在处理...',
        '我理解您的需求，让我为您执行这个操作。',
        '好的，我已经记录了您的请求。',
        '系统状态正常，我可以帮您完成这个任务。',
      ];
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: responses[Math.floor(Math.random() * responses.length)],
        timestamp: Date.now(),
      };
      
      setMessages(prev => [...prev, assistantMessage]);
      setIsProcessing(false);
      
      addNotification('success', '消息已发送', '助手正在处理您的请求');
    }, 1000);
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
    <Box style={{ height: 'calc(100vh - 140px)', display: 'flex', flexDirection: 'column' }}>
      {/* 聊天头部 */}
      <Paper p="md" withBorder style={{ borderBottom: 'none', borderRadius: 'var(--mantine-radius-md) var(--mantine-radius-md) 0 0' }}>
        <Group justify="space-between">
          <Group>
            <Avatar color="blue" radius="xl">
              <IconRobot size={24} />
            </Avatar>
            <div>
              <Text fw={600} size="lg">系统助手</Text>
              <Text size="xs" c="dimmed">在线 • 随时为您服务</Text>
            </div>
          </Group>
          <Tooltip label="清空对话">
            <ActionIcon variant="subtle" color="red" onClick={clearChat}>
              <IconTrash size={18} />
            </ActionIcon>
          </Tooltip>
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
          {messages.map((message) => (
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
          ))}
          
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
