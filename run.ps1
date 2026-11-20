# CollabWhiteboard Development Runner
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "Starting CollabWhiteboard (Server & Client)..." -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Cyan

$nodeDir = "$env:LOCALAPPDATA\Programs\nodejs"
$serverDir = "$PSScriptRoot\server"
$clientDir = "$PSScriptRoot\client"

# 1. Start Server in a separate window
Start-Process powershell -ArgumentList "-NoExit", "-Command", "`$env:PATH = '$nodeDir;' + `$env:PATH; Set-Location '$serverDir'; npm run dev"
Write-Host "✓ Backend server starting at http://localhost:5000" -ForegroundColor Yellow

# 2. Start Client in a separate window
Start-Process powershell -ArgumentList "-NoExit", "-Command", "`$env:PATH = '$nodeDir;' + `$env:PATH; Set-Location '$clientDir'; npm run dev"
Write-Host "✓ Frontend client starting at http://localhost:5173" -ForegroundColor Yellow

Write-Host "`nReady! Open http://localhost:5173 in your browser." -ForegroundColor Green
