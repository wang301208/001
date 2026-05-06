# WebSocket Connection Diagnostic Script

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Zhushou WebSocket Connection Diagnostic Tool" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Check gateway service status
Write-Host "[1/5] Checking gateway service status..." -ForegroundColor Yellow
$gatewayProcess = Get-Process node -ErrorAction SilentlyContinue | Where-Object { 
    $_.Id -eq 23932 
}

if ($gatewayProcess) {
    Write-Host "  [OK] Gateway service is running (PID: $($gatewayProcess.Id))" -ForegroundColor Green
    Write-Host "     Start time: $($gatewayProcess.StartTime)" -ForegroundColor Gray
} else {
    Write-Host "  [FAIL] Gateway service is not running" -ForegroundColor Red
    Write-Host "     Please run: node zhushou.mjs gateway --bind lan --port 3000 --allow-unconfigured" -ForegroundColor Yellow
    exit 1
}

# 2. Check port listening
Write-Host ""
Write-Host "[2/5] Checking port listening..." -ForegroundColor Yellow
$listening = netstat -ano | findstr ":3000" | findstr "LISTENING"

if ($listening) {
    Write-Host "  [OK] Port 3000 is listening" -ForegroundColor Green
    Write-Host "     $listening" -ForegroundColor Gray
} else {
    Write-Host "  [FAIL] Port 3000 is not listening" -ForegroundColor Red
    exit 1
}

# 3. Test HTTP access
Write-Host ""
Write-Host "[3/5] Testing HTTP access..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri http://localhost:3000 -UseBasicParsing -TimeoutSec 5
    if ($response.StatusCode -eq 200) {
        Write-Host "  [OK] HTTP access normal (Status code: $($response.StatusCode))" -ForegroundColor Green
        Write-Host "     Content length: $($response.ContentLength) bytes" -ForegroundColor Gray
    } else {
        Write-Host "  [WARN] HTTP returned abnormal status code: $($response.StatusCode)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  [FAIL] HTTP access failed: $($_.Exception.Message)" -ForegroundColor Red
}

# 4. Check frontend configuration
Write-Host ""
Write-Host "[4/5] Checking frontend configuration..." -ForegroundColor Yellow
$webDir = Join-Path $PSScriptRoot "web"
if (Test-Path $webDir) {
    Write-Host "  [OK] Frontend directory exists: $webDir" -ForegroundColor Green
    
    # Check build artifacts
    $distDir = Join-Path $webDir "dist"
    if (Test-Path $distDir) {
        Write-Host "  [OK] Frontend is built: $distDir" -ForegroundColor Green
        $indexFile = Join-Path $distDir "index.html"
        if (Test-Path $indexFile) {
            Write-Host "  [OK] index.html exists" -ForegroundColor Green
        } else {
            Write-Host "  [WARN] index.html does not exist" -ForegroundColor Yellow
        }
    } else {
        Write-Host "  [WARN] Frontend is not built, please run: cd web; pnpm build" -ForegroundColor Yellow
    }
} else {
    Write-Host "  [FAIL] Frontend directory does not exist: $webDir" -ForegroundColor Red
}

# 5. Provide diagnostic suggestions
Write-Host ""
Write-Host "[5/5] Diagnostic suggestions..." -ForegroundColor Yellow
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Next Steps Guide" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Browser-side check steps:" -ForegroundColor White
Write-Host ""
Write-Host "1. Open browser console (F12)" -ForegroundColor Cyan
Write-Host "   - Network tab -> Check WS connections" -ForegroundColor Gray
Write-Host "   - Console tab -> Check log output" -ForegroundColor Gray
Write-Host ""

Write-Host "2. Confirm token is configured" -ForegroundColor Cyan
Write-Host "   Execute in browser console:" -ForegroundColor Gray
Write-Host '   localStorage.setItem("gatewayToken", "dev-token-123");' -ForegroundColor Yellow
Write-Host "   location.reload();" -ForegroundColor Yellow
Write-Host ""

Write-Host "3. Visit dashboard page" -ForegroundColor Cyan
Write-Host "   http://localhost:3000/dashboard" -ForegroundColor Yellow
Write-Host ""

Write-Host "4. Check expected logs" -ForegroundColor Cyan
Write-Host "   [Auth] Token loaded from localStorage" -ForegroundColor Green
Write-Host "   [useGovernanceWebSocket] Connecting to: ws://localhost:3000/ws?token=..." -ForegroundColor Green
Write-Host "   [useGovernanceWebSocket] Connection successful" -ForegroundColor Green
Write-Host "   [useGovernanceWebSocket] Authentication successful" -ForegroundColor Green
Write-Host ""

Write-Host "5. If still failing, check these errors:" -ForegroundColor Cyan
Write-Host "   - AUTH_FAILED: Token error or not configured" -ForegroundColor Red
Write-Host "   - Connection refused: Gateway service not started" -ForegroundColor Red
Write-Host "   - Invalid token: Token format error" -ForegroundColor Red
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Backend Log Check" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "View real-time logs:" -ForegroundColor White
Write-Host "Get-Content C:\tmp\zhushou\zhushou-*.log -Tail 50 -Wait" -ForegroundColor Yellow
Write-Host ""

Write-Host "Find WebSocket related logs:" -ForegroundColor White
Write-Host 'Get-Content C:\tmp\zhushou\zhushou-*.log -Tail 100 | Select-String "ws|websocket|handshake"' -ForegroundColor Yellow
Write-Host ""

Write-Host "[OK] Diagnostic complete!" -ForegroundColor Green
Write-Host ""
