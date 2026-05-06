# OpenAI API Key Configuration Helper
# This script helps you configure your OpenAI API key

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  OpenAI API Key Configuration" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$authFilePath = "C:\Users\30676\.zhushou\agents\main\agent\auth-profiles.json"
$authDir = "C:\Users\30676\.zhushou\agents\main\agent"

# Check if directory exists, create if not
if (-not (Test-Path $authDir)) {
    Write-Host "[INFO] Creating agent directory..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Path $authDir -Force | Out-Null
    Write-Host "[OK] Directory created: $authDir" -ForegroundColor Green
    Write-Host ""
}

Write-Host "[INFO] Current auth file status:" -ForegroundColor Cyan
if (Test-Path $authFilePath) {
    Write-Host "   [OK] File exists: $authFilePath" -ForegroundColor Green
    Write-Host ""
    Write-Host "Existing configuration:" -ForegroundColor Yellow
    Get-Content $authFilePath | Write-Host
    Write-Host ""
    
    $overwrite = Read-Host "Overwrite existing config? (y/n)"
    if ($overwrite -ne "y" -and $overwrite -ne "Y") {
        Write-Host "[CANCELLED] Configuration cancelled" -ForegroundColor Red
        exit 0
    }
} else {
    Write-Host "   [WARN] File does not exist, will create new file" -ForegroundColor Yellow
    Write-Host ""
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Get Your OpenAI API Key" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Visit: https://platform.openai.com/api-keys" -ForegroundColor White
Write-Host "2. Login to your OpenAI account" -ForegroundColor White
Write-Host "3. Click 'Create new secret key'" -ForegroundColor White
Write-Host "4. Copy the generated key (format: sk-...)" -ForegroundColor White
Write-Host ""
Write-Host "[WARN] Important: Keep your API key secure!" -ForegroundColor Red
Write-Host ""

$apiKey = Read-Host "Enter your OpenAI API key"

# Validate API key format
if (-not $apiKey.StartsWith("sk-")) {
    Write-Host ""
    Write-Host "[WARN] Warning: API keys usually start with 'sk-'" -ForegroundColor Yellow
    $confirm = Read-Host "Continue anyway? (y/n)"
    if ($confirm -ne "y" -and $confirm -ne "Y") {
        Write-Host "[CANCELLED] Configuration cancelled" -ForegroundColor Red
        exit 1
    }
}

if ([string]::IsNullOrWhiteSpace($apiKey)) {
    Write-Host ""
    Write-Host "[ERROR] API key cannot be empty" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "[INFO] Creating auth profile file..." -ForegroundColor Yellow

# Create JSON configuration
$config = @{
    profiles = @{
        openai = @{
            apiKey = $apiKey
            provider = "openai"
        }
    }
}

# Convert to JSON and save
try {
    $jsonContent = $config | ConvertTo-Json -Depth 10
    $jsonContent | Out-File -FilePath $authFilePath -Encoding UTF8
    
    Write-Host "[OK] Auth profile created successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "File location: $authFilePath" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Configuration content:" -ForegroundColor Cyan
    Get-Content $authFilePath | Write-Host
    Write-Host ""
} catch {
    Write-Host ""
    Write-Host "[ERROR] Failed to create auth profile file" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Configuration Complete!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Restart gateway service:" -ForegroundColor White
Write-Host "   taskkill /F /IM node.exe" -ForegroundColor Gray
Write-Host "   node zhushou.mjs gateway --bind lan --port 3000" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Verify configuration:" -ForegroundColor White
Write-Host "   Check logs for 'No API key found' errors" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Test AI agent:" -ForegroundColor White
Write-Host "   Trigger a task that requires AI agent" -ForegroundColor Gray
Write-Host ""
Write-Host "Enjoy! :)" -ForegroundColor Green
Write-Host ""
