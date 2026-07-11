# Start Cinema dev environment at the beginning of a Claude Code session.
# Idempotent: if a server is already running, no extra window is opened.
$ErrorActionPreference = 'SilentlyContinue'
$root = 'D:\FPT\26SP\FER202\cinema-full'

function Test-Port($p) {
  try { $c = [System.Net.Sockets.TcpClient]::new('localhost', $p); $c.Close(); return $true }
  catch { return $false }
}

# Install dependencies on first run (node_modules missing)
if (-not (Test-Path (Join-Path $root 'node_modules'))) {
  Write-Output 'Installing dependencies (first run, this may take 1-2 min)...'
  Push-Location $root
  npm install | Out-Null
  Pop-Location
}

# JSON Server (port 9999) - serves db.json as the mock REST API
$jsonUp = Test-Port 9999
if (-not $jsonUp) {
  Start-Process powershell -ArgumentList '-NoExit', '-Command', "cd `"$root`"; npx json-server --watch db.json --port 9999" -WindowStyle Minimized
}

# Web (port 3000, React default) - BROWSER=none so it does not auto-open a browser
$webUp = Test-Port 3000
if (-not $webUp) {
  Start-Process powershell -ArgumentList '-NoExit', '-Command', "`$env:BROWSER='none'; cd `"$root`"; npm start" -WindowStyle Minimized
}

Write-Output 'Cinema dev environment:'
if ($webUp)  { Write-Output '  Web:         http://localhost:3000  (already running)' }
else         { Write-Output '  Web:         http://localhost:3000  (starting, wait ~20-40s)' }
if ($jsonUp) { Write-Output '  JSON Server: http://localhost:9999  (already running)' }
else         { Write-Output '  JSON Server: http://localhost:9999  (starting, wait ~5s)' }
Write-Output 'Open http://localhost:3000 in Chrome to view the site.'
