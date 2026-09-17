# 一键拉起/守护开发服务器（pm2）
# 用法：
#   powershell -File scripts/dev-server.ps1          # 启动（已存在则保持）
#   powershell -File scripts/dev-server.ps1 -Restart # 强制重启
param(
  [switch]$Restart
)

$ErrorActionPreference = "Stop"
$name = "keep-living-h5"

# pm2 daemon 可能被杀导致进程列表丢失：先尝试从快照恢复
pm2 resurrect 2>$null | Out-Null

$running = pm2 ls 2>$null | Select-String -Pattern $name

if ($Restart) {
  pm2 restart $name 2>$null | Out-Null
  Write-Host "[dev-server] restarted"
} elseif ($running) {
  Write-Host "[dev-server] already running (pm2 name: $name)"
} else {
  Set-Location "F:\Projects\keep-living-h5"
  pm2 start ecosystem.config.cjs 2>&1 | Out-Null
  pm2 save 2>$null | Out-Null
  Write-Host "[dev-server] started via pm2"
}

Start-Sleep -Seconds 3
try {
  $code = (Invoke-WebRequest http://localhost:5173 -UseBasicParsing -TimeoutSec 5).StatusCode
  Write-Host "[dev-server] http://localhost:5173 -> $code"
} catch {
  Write-Host "[dev-server] WARN: 5173 not reachable yet - $($_.Exception.Message)"
}
