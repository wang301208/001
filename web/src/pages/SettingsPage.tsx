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
  Alert,
  Badge,
} from '@mantine/core';
import { 
  IconBell, 
  IconPalette, 
  IconDatabase,
  IconRobot,
  IconCheck,
  IconKey,
  IconServer,
  IconAlertCircle,
  IconTrash,
} from '@tabler/icons-react';
import { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '../stores/useAppStore';
import { setAuthToken } from '../utils/auth';
import { apiService } from '../services/api';

export function SettingsPage() {
  const { addNotification, setToken, token } = useAppStore();
  
  const [gatewayToken, setGatewayToken] = useState('');
  const [isTokenSaved, setIsTokenSaved] = useState(false);
  
  const [modelConfig, setModelConfig] = useState({
    provider: '',
    endpoint: '',
    apiKey: '',
    modelName: '',
    maxTokens: 4096,
    temperature: 0.7,
  });

  const [availableModels, setAvailableModels] = useState<{ value: string; label: string }[]>([]);
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  const [notifications, setNotifications] = useState({ desktop: true, sound: false });
  const [appearance, setAppearance] = useState({ theme: 'light', language: 'zh-CN' });
  const [autoSave, setAutoSave] = useState(true);

  useEffect(() => {
    const savedToken = localStorage.getItem('gatewayToken');
    if (savedToken) {
      setGatewayToken(savedToken);
      setToken(savedToken);
    }

    const savedModelConfig = localStorage.getItem('remoteModelConfig');
    if (savedModelConfig) {
      try { setModelConfig(JSON.parse(savedModelConfig)); } catch {}
    }

    const savedNotifications = localStorage.getItem('notificationSettings');
    if (savedNotifications) {
      try { setNotifications(JSON.parse(savedNotifications)); } catch {}
    }

    const savedAppearance = localStorage.getItem('appearanceSettings');
    if (savedAppearance) {
      try { setAppearance(JSON.parse(savedAppearance)); } catch {}
    }

    const savedAutoSave = localStorage.getItem('autoSaveEnabled');
    if (savedAutoSave !== null) {
      setAutoSave(savedAutoSave === 'true');
    }
  }, [setToken]);

  const loadModels = useCallback(async () => {
    setIsLoadingModels(true);
    try {
      const response = await apiService.getModels();
      if (response.success && response.data) {
        const models = (response.data as any[]).map((m: any) => ({
          value: m.id || m.name,
          label: `${m.name} (${m.provider || 'unknown'})`,
        }));
        setAvailableModels(models);
      }
    } catch (err) {
      console.error('[SettingsPage] 加载模型列表失败:', err);
    } finally {
      setIsLoadingModels(false);
    }
  }, []);

  useEffect(() => {
    loadModels();
  }, [loadModels]);

  const handleSaveToken = () => {
    if (!gatewayToken.trim()) {
      addNotification('warning', '令牌不能为空', '请输入网关认证令牌');
      return;
    }
    localStorage.setItem('gatewayToken', gatewayToken);
    setToken(gatewayToken);
    setAuthToken(gatewayToken);
    setIsTokenSaved(true);
    addNotification('success', '保存成功', '网关认证令牌已保存并立即生效');
    setTimeout(() => setIsTokenSaved(false), 3000);
  };

  const handleClearToken = () => {
    localStorage.removeItem('gatewayToken');
    setGatewayToken('');
    setToken(null);
    setAuthToken(null);
    setIsTokenSaved(false);
    addNotification('info', '已清除', '网关认证令牌已清除');
  };

  const handleTestConnection = async () => {
    if (!modelConfig.endpoint || !modelConfig.apiKey) {
      addNotification('warning', '配置不完整', '请填写 API 端点和 API Key');
      return;
    }

    setIsTesting(true);
    try {
      const response = await apiService.healthCheck();
      if (response.success) {
        addNotification('success', '连接成功', `后端服务正常运行`);
      } else {
        addNotification('error', '连接失败', '无法连接后端服务');
      }
    } catch (error) {
      addNotification('error', '连接错误', '网络请求失败');
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveConfig = async () => {
    if (!modelConfig.endpoint || !modelConfig.apiKey || !modelConfig.modelName) {
      addNotification('warning', '配置不完整', '请填写必填字段：API 端点、API Key 和模型名称');
      return;
    }

    setIsSavingConfig(true);
    try {
      localStorage.setItem('remoteModelConfig', JSON.stringify(modelConfig));

      const providerKey = modelConfig.provider.toLowerCase().replace(/\s+/g, '-') || 'custom';
      const modelId = modelConfig.modelName.toLowerCase().replace(/[^a-z0-9-.]/g, '-') || 'custom-model';

      const modelProviderConfig = {
        baseUrl: modelConfig.endpoint,
        apiKey: modelConfig.apiKey,
        api: 'openai-completions',
        models: [
          {
            id: modelId,
            name: modelConfig.modelName,
            api: 'openai-completions',
            reasoning: false,
            input: ['text'],
            cost: {
              input: 0,
              output: 0,
              cacheRead: 0,
              cacheWrite: 0,
            },
            contextWindow: 128000,
            maxTokens: modelConfig.maxTokens,
          },
        ],
      };

      let baseHash: string | undefined;
      let existingConfig: any = {};

      try {
        const getConfigResponse = await apiService.getConfig();
        if (getConfigResponse.success && getConfigResponse.data) {
          baseHash = getConfigResponse.data.hash;
          existingConfig = getConfigResponse.data.config || {};
        }
      } catch (e) {
        console.warn('[SettingsPage] 获取当前配置失败，将使用空配置:', e);
      }

      const mergedConfig = {
        ...existingConfig,
        models: {
          ...(existingConfig.models || {}),
          mode: existingConfig.models?.mode || 'merge',
          providers: {
            ...(existingConfig.models?.providers || {}),
            [providerKey]: modelProviderConfig,
          },
        },
      };

      const response = await apiService.setConfig(mergedConfig, baseHash);

      if (response.success) {
        addNotification('success', '保存成功', '模型配置已保存到后端');
      } else {
        addNotification('warning', '部分保存', '配置已保存到本地，但后端同步失败: ' + (response.error || ''));
      }
    } catch (error) {
      addNotification('warning', '部分保存', '配置已保存到本地，但后端同步失败');
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleSaveOldConfig = () => {
    if (!modelConfig.endpoint || !modelConfig.apiKey || !modelConfig.modelName) {
      addNotification('warning', '配置不完整', '请填写必填字段');
      return;
    }

    setIsSaving(true);
    try {
      localStorage.setItem('remoteModelConfig', JSON.stringify(modelConfig));
      addNotification('success', '保存成功', '配置已保存到本地');
    } catch (error) {
      addNotification('error', '保存失败', '配置保存失败');
    } finally {
      setIsSaving(false);
    }
  };

  const handleNotificationChange = (key: 'desktop' | 'sound', value: boolean) => {
    const updated = { ...notifications, [key]: value };
    setNotifications(updated);
    localStorage.setItem('notificationSettings', JSON.stringify(updated));
    
    if (key === 'desktop' && value) {
      Notification.requestPermission();
    }
  };

  const handleAppearanceChange = (key: 'theme' | 'language', value: string) => {
    const updated = { ...appearance, [key]: value };
    setAppearance(updated);
    localStorage.setItem('appearanceSettings', JSON.stringify(updated));
    addNotification('info', '设置已保存', `${key === 'theme' ? '主题' : '语言'}已更新为 ${value}（刷新后生效）`);
  };

  const handleAutoSaveChange = (value: boolean) => {
    setAutoSave(value);
    localStorage.setItem('autoSaveEnabled', String(value));
  };

  const handleClearCache = () => {
    const keysToRemove = [
      'governance_status_cache',
      'remoteModelConfig',
      'notificationSettings',
      'appearanceSettings',
      'autoSaveEnabled',
    ];
    keysToRemove.forEach(key => localStorage.removeItem(key));
    addNotification('success', '缓存已清除', '本地缓存数据已全部清除');
  };

  return (
    <div>
      <Box mb="xl">
        <Title order={1} style={{ letterSpacing: '-0.5px' }}>系统设置</Title>
        <Text c="dimmed" mt="xs" size="sm">配置和偏好设置</Text>
      </Box>
      
      <Stack gap="md">
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Group justify="space-between" mb="md">
            <Group>
              <ThemeIcon variant="light" color="violet" size="lg"><IconKey size={24} /></ThemeIcon>
              <div>
                <Title order={3}>网关认证</Title>
                <Text size="sm" c="dimmed">配置网关访问令牌（用于 WebSocket 和 API 认证）</Text>
              </div>
            </Group>
            {isTokenSaved && <ThemeIcon color="green" variant="light"><IconCheck size={18} /></ThemeIcon>}
          </Group>
          <Divider mb="md" />
          <Stack gap="md">
            <Alert icon={<IconAlertCircle size={16} />} title="重要提示" color="blue">
              <Text size="sm">网关令牌用于认证 WebSocket 连接和 API 请求。如果未配置，系统将显示"离线模式"且无法与后端通信。</Text>
              <Text size="xs" c="dimmed" mt="xs">默认开发令牌：<Text component="code" fw={700}>dev-token-123</Text></Text>
            </Alert>
            <PasswordInput
              label="网关令牌"
              placeholder="输入 ZHUSHOU_GATEWAY_TOKEN"
              value={gatewayToken}
              onChange={(e) => setGatewayToken(e.target.value)}
              leftSection={<IconServer size={16} />}
              description="启动网关时设置的 ZHUSHOU_GATEWAY_TOKEN 环境变量值"
            />
            <Group gap="sm">
              <Button onClick={handleSaveToken} leftSection={<IconCheck size={16} />} color="green">保存令牌</Button>
              <Button onClick={handleClearToken} variant="outline" color="gray">清除令牌</Button>
            </Group>
            {gatewayToken && (
              <Text size="xs" c="dimmed">当前状态：{token ? '已配置' : '未生效（请刷新页面）'}</Text>
            )}
          </Stack>
        </Card>
        
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Group justify="space-between" mb="md">
            <Group>
              <ThemeIcon variant="light" color="blue" size="lg"><IconBell size={24} /></ThemeIcon>
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
              <Switch checked={notifications.desktop} onChange={(e) => handleNotificationChange('desktop', e.currentTarget.checked)} />
            </Group>
            <Group justify="space-between">
              <div>
                <Text fw={500}>声音提醒</Text>
                <Text size="sm" c="dimmed">收到重要通知时播放提示音</Text>
              </div>
              <Switch checked={notifications.sound} onChange={(e) => handleNotificationChange('sound', e.currentTarget.checked)} />
            </Group>
          </Stack>
        </Card>
        
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Group justify="space-between" mb="md">
            <Group>
              <ThemeIcon variant="light" color="purple" size="lg"><IconPalette size={24} /></ThemeIcon>
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
              value={appearance.theme}
              onChange={(val) => val && handleAppearanceChange('theme', val)}
            />
            <Select
              label="语言"
              placeholder="选择语言"
              data={[
                { value: 'zh-CN', label: '简体中文' },
                { value: 'en-US', label: 'English' },
              ]}
              value={appearance.language}
              onChange={(val) => val && handleAppearanceChange('language', val)}
            />
          </Stack>
        </Card>
        
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Group justify="space-between" mb="md">
            <Group>
              <ThemeIcon variant="light" color="violet" size="lg"><IconRobot size={24} /></ThemeIcon>
              <div>
                <Title order={3}>远程模型配置</Title>
                <Text size="sm" c="dimmed">配置自定义 AI 模型连接</Text>
              </div>
            </Group>
            {availableModels.length > 0 && (
              <Badge variant="light" color="green">{availableModels.length} 个模型可用</Badge>
            )}
          </Group>
          <Divider mb="md" />
          <Stack gap="md">
            <Group>
              <TextInput
                label="模型提供商"
                placeholder="例如：OpenAI, Anthropic, Google"
                value={modelConfig.provider}
                onChange={(e) => setModelConfig({ ...modelConfig, provider: e.target.value })}
                description="选择或输入模型服务提供商"
                style={{ flex: 1 }}
              />
              <Button
                variant="light"
                size="sm"
                mt="auto"
                onClick={loadModels}
                loading={isLoadingModels}
              >
                刷新模型列表
              </Button>
            </Group>
            
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
            
            {availableModels.length > 0 ? (
              <Select
                label="模型名称"
                placeholder="选择或输入模型"
                data={availableModels}
                value={modelConfig.modelName}
                onChange={(val) => val && setModelConfig({ ...modelConfig, modelName: val })}
                searchable
                description="从可用模型中选择，或输入自定义模型名"
              />
            ) : (
              <TextInput
                label="模型名称"
                placeholder="gpt-4, claude-3, gemini-pro"
                value={modelConfig.modelName}
                onChange={(e) => setModelConfig({ ...modelConfig, modelName: e.target.value })}
                description="要使用的具体模型名称"
              />
            )}
            
            <NumberInput
              label="最大 Token 数"
              placeholder="4096"
              value={modelConfig.maxTokens}
              onChange={(value) => setModelConfig({ ...modelConfig, maxTokens: Number(value) || 4096 })}
              min={1} max={128000} step={1024}
              description="单次请求的最大 token 数量"
            />
            
            <NumberInput
              label="温度参数"
              placeholder="0.7"
              value={modelConfig.temperature}
              onChange={(value) => setModelConfig({ ...modelConfig, temperature: Number(value) || 0.7 })}
              min={0} max={2} step={0.1}
              description="控制输出的随机性（0-2）"
            />
            
            <Group justify="flex-end" mt="md">
              <Button variant="outline" onClick={handleTestConnection} loading={isTesting} leftSection={isTesting ? null : <IconCheck size={16} />}>
                {isTesting ? '测试中...' : '测试连接'}
              </Button>
              <Button color="violet" onClick={handleSaveConfig} loading={isSavingConfig} leftSection={isSavingConfig ? null : <IconCheck size={16} />}>
                {isSavingConfig ? '保存中...' : '保存到后端'}
              </Button>
              <Button variant="light" onClick={handleSaveOldConfig} loading={isSaving}>
                仅保存本地
              </Button>
            </Group>
          </Stack>
        </Card>
        
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Group justify="space-between" mb="md">
            <Group>
              <ThemeIcon variant="light" color="teal" size="lg"><IconDatabase size={24} /></ThemeIcon>
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
              <Switch checked={autoSave} onChange={(e) => handleAutoSaveChange(e.currentTarget.checked)} />
            </Group>
            
            <Button variant="outline" color="red" leftSection={<IconTrash size={16} />} onClick={handleClearCache}>
              清除缓存数据
            </Button>
          </Stack>
        </Card>
      </Stack>
    </div>
  );
}
