# Start ngrok with frontend + backend tunnels. Run from project root (c:\CHD\CHD).
# Start backend (python main.py) and frontend (npm run dev) in other terminals first.

$config = Join-Path $PSScriptRoot "ngrok.yml"
$ngrok = Join-Path $PSScriptRoot "ngrok.exe"

if (-not (Test-Path $ngrok)) {
    Write-Host "ngrok.exe not found. Download from https://ngrok.com/download and put it in the project root." -ForegroundColor Red
    exit 1
}

& $ngrok start --config $config --all
