# HapticPhonix - Start All Services (Local HTTPS)
# Kill existing node/python processes to free ports
Write-Host "Stopping existing Node/Python/Ngrok processes..." -ForegroundColor Yellow
Get-Process node, python, ngrok -ErrorAction SilentlyContinue | Stop-Process -Force

# Wait a moment for ports to clear
Start-Sleep -Seconds 2

# Start Backend (HTTPS mode)
Write-Host "Starting Backend (HTTPS)..." -ForegroundColor Green
$backendProcess = Start-Process -FilePath "cmd" -ArgumentList "/c cd backend && set BACKEND_HTTPS=true && python main.py" -PassThru -NoNewWindow

# Start Frontend (HTTPS mode)
# Note: package.json script 'dev' should handle SSL certs
Write-Host "Starting Frontend (HTTPS)..." -ForegroundColor Green
$frontendProcess = Start-Process -FilePath "cmd" -ArgumentList "/c cd frontend && npm run dev" -PassThru -NoNewWindow

# Wait for services to start
Write-Host "Waiting for services to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Local IP Details
$localIp = "10.45.215.242"
$frontendUrl = "https://$($localIp):3000"
$backendUrl = "https://$($localIp):8000"

Write-Host "`n=== ALL SERVICES STARTED (Local HTTPS) ===" -ForegroundColor Cyan
Write-Host "Connect your phone to the SAME Wi-Fi network as this PC." -ForegroundColor Yellow
Write-Host "  1. Frontend URL -> $frontendUrl" -ForegroundColor Green
Write-Host "  2. Backend URL  -> $backendUrl" -ForegroundColor Green
Write-Host "`nIMPORTANT: On your phone, visit BOTH URLs and accept the 'Not Secure' warning first!" -ForegroundColor Red

# --- NEW: Start Ngrok Tunnels ---
Write-Host "Checking for ngrok..." -ForegroundColor Yellow
if (Get-Command ngrok -ErrorAction SilentlyContinue) {
    Write-Host "Configuring ngrok authtoken..." -ForegroundColor Gray
    ngrok config add-authtoken 39ffjNqK0fPaoDo9svQmzaA56h2_6q3UbxTD3TSZz7bLrzBPC

    Write-Host "Starting Ngrok Tunnels in a new window..." -ForegroundColor Green
    # Launch ngrok in its own window so you can see the public URLs
    # Use /k to keep window open if it fails
    Start-Process -FilePath "cmd.exe" -ArgumentList "/k ngrok start --config .\ngrok.yml frontend backend"
} else {
    Write-Host "ERROR: ngrok.exe not found in PATH. Please install it or place it in the project root." -ForegroundColor Red
}

Write-Host "`n=== ALL SERVICES STARTED ===" -ForegroundColor Cyan