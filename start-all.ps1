# HapticPhonix - Start All Services (Local HTTPS)
# Kill existing node/python processes to free ports
Write-Host "Stopping existing Node/Python/Ngrok processes..." -ForegroundColor Yellow
Get-Process node, python, ngrok -ErrorAction SilentlyContinue | Stop-Process -Force

# Wait a moment for ports to clear
Start-Sleep -Seconds 2

# Start Backend (HTTPS mode) - DISABLED per user request
# Write-Host "Starting Backend (HTTPS)..." -ForegroundColor Green
# $backendProcess = Start-Process -FilePath "cmd" -ArgumentList "/c cd backend && set BACKEND_HTTPS=true && python main.py" -PassThru -NoNewWindow
# Write-Host "Backend startup skipped. Please run 'python main.py' in the backend folder manually." -ForegroundColor Yellow

# Start Frontend (HTTPS mode)
# Note: package.json script 'dev' should handle SSL certs
Write-Host "Starting Frontend (HTTPS)..." -ForegroundColor Green
$frontendProcess = Start-Process -FilePath "cmd" -ArgumentList "/c cd frontend && npm run dev" -PassThru -NoNewWindow

# Wait for services to start
Write-Host "Waiting for services to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Local IP Detection
$localIp = (Get-NetIPConfiguration | Where-Object { $_.IPv4Address -ne $null } | Select-Object -First 1).IPv4Address.IPAddress
if (-not $localIp) { $localIp = "localhost" }

$frontendUrl = "https://$($localIp):3000"
$backendUrl = "https://$($localIp):8000"

Write-Host "`n=== FRONTEND STARTED (Local HTTPS) ===" -ForegroundColor Cyan
Write-Host "Connect your phone to the SAME Wi-Fi network as this PC." -ForegroundColor Yellow
Write-Host "  1. Frontend URL -> $frontendUrl" -ForegroundColor Green
Write-Host "  2. Backend URL  -> $backendUrl (Manual start required)" -ForegroundColor Gray
Write-Host "`nIMPORTANT: On your phone, visit the Frontend URL and accept the 'Not Secure' warning!" -ForegroundColor Red

# --- NEW: Start Ngrok Tunnels ---
Write-Host "Checking for ngrok..." -ForegroundColor Yellow
if (Get-Command ngrok -ErrorAction SilentlyContinue) {
    Write-Host "Configuring ngrok authtoken..." -ForegroundColor Gray
    ngrok config add-authtoken 39ffjNqK0fPaoDo9svQmzaA56h2_6q3UbxTD3TSZz7bLrzBPC

    Write-Host "Starting Ngrok Tunnel for Frontend..." -ForegroundColor Green
    
    # Tunnel 1: Frontend (Port 3000)
    # Using 'cmd /k' so the window stays open. 
    Start-Process -FilePath "cmd.exe" -ArgumentList "/k title Ngrok-Frontend && ngrok http https://localhost:3000 --host-header=rewrite" -WindowStyle Normal
    
    Write-Host "`nIMPORTANT: You only need the FRONTEND URL now!" -ForegroundColor Cyan
    Write-Host "1. Open the Ngrok URL on your phone." -ForegroundColor Yellow
    Write-Host "2. Click Connect. Next.js will proxy the video to the backend automatically." -ForegroundColor Yellow
} else {
    Write-Host "ERROR: ngrok.exe not found in PATH." -ForegroundColor Red
}

Write-Host "`n=== FRONTEND SERVICE STARTED ===" -ForegroundColor Cyan