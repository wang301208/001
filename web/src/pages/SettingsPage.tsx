import { 
  Title, 
  Text, 
  Card, 
  Stack,
  Group,
  Switch,
  Select,
  Button,
  Divider,
  ThemeIcon,
  Box,
  TextInput,
  PasswordInput,
  NumberInput,
} from '@mantine/core';
import { 
  IconBell, 
  IconPalette, 
  IconDatabase,
  IconRobot,
  IconCheck,
} from '@tabler/icons-react';
import { useState } from 'react';
import { useAppStore } from '../stores/useAppStore';

export function SettingsPage() {
  const { addNotification } = useAppStore();
  
  // 远程模型配置状态
  const [modelConfig, setModelConfig] = useState({
    provider: '',
    endpoint: '',
    apiKey: '',
    modelName: '',
    maxTokens: 4096,
    temperature: 0.7,
  });
  
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // 测试连接
  const handleTestConnection = async () => {
    if (!modelConfig.endpoint || !modelConfig.apiKey) {
      addNotification('warning', '配置不完整', '请填写 API 端点和 API Key');
      return;
    }

    setIsTesting(true);
    
    try {
      // 模拟 API 调用（实际应该调用后端接口）
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // 模拟测试结果
      const success = Math.random() > 0.3; // 70% 成功率
      
      if (success) {
        addNotification('success', '连接成功', `成功连接到 ${modelConfig.provider || modelConfig.endpoint}`);
      } else {
        addNotification('error', '连接失败', '无法连接到模型服务，请检查配置');
      }
    } catch (error) {
      addNotification('error', '连接错误', '网络请求失败');
    } finally {
      setIsTesting(false);
    }
  };

  // 保存配置
  const handleSaveConfig = async () => {
    if (!modelConfig.endpoint || !modelConfig.apiKey || !modelConfig.modelName) {
      addNotification('warning', '配置不完整', '请填写必填字段：API 端点、API Key 和模型名称');
      return;
    }

    setIsSaving(true);
    
    try {
      // 模拟保存操作（实际应该保存到 localStorage 或后端）
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // 保存到 localStorage
      localStorage.setItem('remoteModelConfig', JSON.stringify(modelConfig));
      
      addNotification('success', '保存成功', '远程模型配置已保存');
    } catch (error) {
      addNotification('error', '保存失败', '配置保存失败，请重试');
    } finally {
      setIsSaving(false);
    }
  };

  // 加载已保存的配置
  useState(() => {
    const saved = localStorage.getItem('remoteModelConfig');
    if (saved) {
      try {
        setModelConfig(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load saved config:', e);
      }
    }
  });

  return (
    <div>
      {/* 页面标题区域 */}
      <Box mb="xl">
        <Title order={1} style={{ letterSpacing: '-0.5px' }}>系统设置</Title>
        <Text c="dimmed" mt="xs" size="sm">配置和偏好设置</Text>
      </Box>
      
      <Stack gap="md">
        {/* 通知设置 */}
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Group justify="space-between" mb="md">
            <Group>
              <ThemeIcon variant="light" color="blue" size="lg">
                <IconBell size={24} />
              </ThemeIcon>
              <div>
                <Title order={3}>通知设置</Title>
                <Text size="sm" c="dimmed">配置系统通知偏好</Text>
              </div>
            </Group>
          </Group>
          
          <Divider mb="md" />
          
          <Stack gap="md">
            <Group justify="space-between">
              <div>
                <Text fw={500}>启用桌面通知</Text>
                <Text size="sm" c="dimmed">在系统通知中心显示通知</Text>
              </div>
              <Switch defaultChecked />
            </Group>
            
            <Group justify="space-between">
              <div>
                <Text fw={500}>声音提醒</Text>
                <Text size="sm" c="dimmed">收到重要通知时播放提示音</Text>
              </div>
              <Switch />
            </Group>
          </Stack>
        </Card>
        
        {/* 外观设置 */}
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Group justify="space-between" mb="md">
            <Group>
              <ThemeIcon variant="light" color="purple" size="lg">
                <IconPalette size={24} />
              </ThemeIcon>
              <div>
                <Title order={3}>外观设置</Title>
                <Text size="sm" c="dimmed">自定义界面显示</Text>
              </div>
            </Group>
          </Group>
          
          <Divider mb="md" />
          
          <Stack gap="md">
            <Select
              label="主题模式"
              placeholder="选择主题"
              data={[
                { value: 'light', label: '浅色模式' },
                { value: 'dark', label: '深色模式' },
                { value: 'auto', label: '跟随系统' },
              ]}
              defaultValue="light"
            />
            
            <Select
              label="语言"
              placeholder="选择语言"
              data={[
                { value: 'zh-CN', label: '简体中文' },
                { value: 'en-US', label: 'English' },
              ]}
              defaultValue="zh-CN"
            />
          </Stack>
        </Card>
        
        {/* 远程模型配置 */}
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Group justify="space-between" mb="md">
            <Group>
              <ThemeIcon variant="light" color="violet" size="lg">
                <IconRobot size={24} />
              </ThemeIcon>
              <div>
                <Title order={3}>远程模型配置</Title>
                <Text size="sm" c="dimmed">配置自定义 AI 模型连接</Text>
              </div>
            </Group>
          </Group>
          
          <Divider mb="md" />
          
          <Stack gap="md">
            <TextInput
              label="模型提供商"
              placeholder="例如：OpenAI, Anthropic, Google"
              value={modelConfig.provider}
              onChange={(e) => setModelConfig({ ...modelConfig, provider: e.target.value })}
              description="选择或输入模型服务提供商"
            />
            
            <TextInput
              label="API 端点 URL"
              placeholder="https://api.openai.com/v1"
              value={modelConfig.endpoint}
              onChange={(e) => setModelConfig({ ...modelConfig, endpoint: e.target.value })}
              description="模型的 API 基础 URL"
            />
            
            <PasswordInput
              label="API Key"
              placeholder="sk-..."
              value={modelConfig.apiKey}
              onChange={(e) => setModelConfig({ ...modelConfig, apiKey: e.target.value })}
              description="您的 API 密钥（安全存储）"
            />
            
            <TextInput
              label="模型名称"
              placeholder="gpt-4, claude-3, gemini-pro"
              value={modelConfig.modelName}
              onChange={(e) => setModelConfig({ ...modelConfig, modelName: e.target.value })}
              description="要使用的具体模型名称"
            />
            
            <NumberInput
              label="最大 Token 数"
              placeholder="4096"
              value={modelConfig.maxTokens}
              onChange={(value) => setModelConfig({ ...modelConfig, maxTokens: Number(value) || 4096 })}
              min={1}
              max={128000}
              step={1024}
              description="单次请求的最大 token 数量"
            />
            
            <NumberInput
              label="温度参数"
              placeholder="0.7"
              value={modelConfig.temperature}
              onChange={(value) => setModelConfig({ ...modelConfig, temperature: Number(value) || 0.7 })}
              min={0}
              max={2}
              step={0.1}
              description="控制输出的随机性（0-2）"
            />
            
            <Group justify="flex-end" mt="md">
              <Button 
                variant="outline" 
                onClick={handleTestConnection}
                loading={isTesting}
                leftSection={isTesting ? null : <IconCheck size={16} />}
              >
                {isTesting ? '测试中...' : '测试连接'}
              </Button>
              <Button 
                color="violet" 
                onClick={handleSaveConfig}
                loading={isSaving}
                leftSection={isSaving ? null : <IconCheck size={16} />}
              >
                {isSaving ? '保存中...' : '保存配置'}
              </Button>
            </Group>
          </Stack>
        </Card>
        
        {/* 数据存储 */}
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Group justify="space-between" mb="md">
            <Group>
              <ThemeIcon variant="light" color="teal" size="lg">
                <IconDatabase size={24} />
              </ThemeIcon>
              <div>
                <Title order={3}>数据存储</Title>
                <Text size="sm" c="dimmed">管理本地数据和缓存</Text>
              </div>
            </Group>
          </Group>
          
          <Divider mb="md" />
          
          <Stack gap="md">
            <Group justify="space-between">
              <div>
                <Text fw={500}>自动保存数据</Text>
                <Text size="sm" c="dimmed">定期保存工作状态</Text>
              </div>
              <Switch defaultChecked />
            </Group>
            
            <Button variant="outline" color="red">
              清除缓存数据
            </Button>
          </Stack>
        </Card>
      </Stack>
    </div>
  );
}
