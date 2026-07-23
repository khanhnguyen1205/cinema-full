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

# Auth + API server (port 4000) - Express TS (tsx) + Prisma/Postgres: bcrypt + JWT httpOnly + gateway (server/src/index.ts)
$authUp = Test-Port 4000
if (-not $authUp) {
  Start-Process powershell -ArgumentList '-NoExit', '-Command', "cd `"$root`"; npm run auth" -WindowStyle Minimized
}

# Web (port 3000, React default) - BROWSER=none so it does not auto-open a browser
$webUp = Test-Port 3000
if (-not $webUp) {
  Start-Process powershell -ArgumentList '-NoExit', '-Command', "`$env:BROWSER='none'; cd `"$root`"; npm start" -WindowStyle Minimized
}

Write-Output 'Cinema dev environment:'
if ($webUp)  { Write-Output '  Web:         http://localhost:3000  (already running)' }
else         { Write-Output '  Web:         http://localhost:3000  (starting, wait ~20-40s)' }
if ($authUp) { Write-Output '  API Server:  http://localhost:4000  (already running)' }
else         { Write-Output '  API Server:  http://localhost:4000  (starting, wait ~3s)' }
Write-Output 'Open http://localhost:3000 in Chrome to view the site.'
