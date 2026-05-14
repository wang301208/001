# 助手 API密钥自动配置脚本
# 此脚本会将前端配置的API密钥写入后端的auth-profiles.json文件

param(
    [string]$Provider = "openai",
    [string]$ApiKey = "",
    [string]$Endpoint = ""
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  助手 API密钥配置工具" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 如果未提供API密钥，提示用户输入
if ([string]::IsNullOrWhiteSpace($ApiKey)) {
    Write-Host "请输入您的 $Provider API密钥:" -ForegroundColor Yellow
    $ApiKey = Read-Host "API Key"
}

if ([string]::IsNullOrWhiteSpace($ApiKey)) {
    Write-Host "错误: API密钥不能为空" -ForegroundColor Red
    exit 1
}

# 配置文件路径
$authDir = "C:\Users\30676\.zhushou\agents\main\agent"
$authFile = Join-Path $authDir "auth-profiles.json"

# 创建目录（如果不存在）
if (-not (Test-Path $authDir)) {
    Write-Host "创建目录: $authDir" -ForegroundColor Yellow
    New-Item -ItemType Directory -Path $authDir -Force | Out-Null
}

# 读取现有配置或创建新配置
$config = @{ version = 1; profiles = @{} }
if (Test-Path $authFile) {
    try {
        $existingContent = Get-Content $authFile -Raw -Encoding UTF8
        $config = $existingContent | ConvertFrom-Json -AsHashtable
        if (-not $config.profiles) {
            $config.profiles = @{}
        }
        Write-Host "已加载现有配置" -ForegroundColor Green
    } catch {
        Write-Host "警告: 无法解析现有配置，将创建新配置" -ForegroundColor Yellow
    }
}

# 添加或更新API密钥配置
$profileId = "$($Provider.ToLower()):default"
$config.profiles[$profileId] = @{
    type = "api_key"
    provider = $Provider.ToLower()
    key = $ApiKey
}

# 保存配置
try {
    $jsonContent = $config | ConvertTo-Json -Depth 10
    $jsonContent | Out-File -FilePath $authFile -Encoding UTF8
    
    Write-Host ""
    Write-Host "✅ 配置成功！" -ForegroundColor Green
    Write-Host ""
    Write-Host "配置文件: $authFile" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "配置内容:" -ForegroundColor Cyan
    Get-Content $authFile | Write-Host
    Write-Host ""
    
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "  下一步操作" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "1. 重启网关服务使配置生效:" -ForegroundColor White
    Write-Host "   taskkill /F /IM node.exe" -ForegroundColor Gray
    Write-Host "   cd g:\项目\-" -ForegroundColor Gray
    Write-Host "   node zhushou.mjs gateway --bind lan --port 3000" -ForegroundColor Gray
    Write-Host ""
    Write-Host "2. 验证配置是否成功:" -ForegroundColor White
    Write-Host "   查看日志中是否还有 'No API key found' 错误" -ForegroundColor Gray
    Write-Host ""
    Write-Host "祝您使用愉快！" -ForegroundColor Green
    Write-Host ""
    
} catch {
    Write-Host ""
    Write-Host "❌ 错误: 无法保存配置文件" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}
