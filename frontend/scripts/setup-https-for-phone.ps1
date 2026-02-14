# Generate HTTPS cert for your LAN IP so the phone trusts the dev server (no "Proceed anyway").
# Requires: mkcert (https://github.com/FiloSottile/mkcert - choco install mkcert, or scoop install mkcert)
#
# Usage: .\setup-https-for-phone.ps1 [YOUR_LAN_IP]
# Example: .\setup-https-for-phone.ps1 10.205.95.193

param([string]$LanIP = "")

$ErrorActionPreference = "Stop"

if (-not $LanIP) {
    Write-Host "Usage: .\setup-https-for-phone.ps1 YOUR_LAN_IP" -ForegroundColor Yellow
    Write-Host "Example: .\setup-https-for-phone.ps1 10.205.95.193" -ForegroundColor Gray
    Write-Host ""
    $LanIP = Read-Host "Enter your PC's LAN IP (e.g. 10.205.95.193)"
    if (-not $LanIP) { Write-Host "No IP entered. Exiting."; exit 1 }
}

# Script lives in frontend/scripts/; certificates go in frontend/certificates/
$ScriptDir = Split-Path $PSScriptRoot -Parent
$CertDir = Join-Path $ScriptDir "certificates"
if (-not (Test-Path $CertDir)) { New-Item -ItemType Directory -Path $CertDir -Force | Out-Null }

# Check mkcert
$mkcert = Get-Command mkcert -ErrorAction SilentlyContinue
if (-not $mkcert) {
    Write-Host "mkcert not found. Install it first:" -ForegroundColor Red
    Write-Host "  Windows: choco install mkcert" -ForegroundColor Gray
    Write-Host "  Or: scoop install mkcert" -ForegroundColor Gray
    Write-Host "  Then run: mkcert -install" -ForegroundColor Gray
    exit 1
}

Write-Host "Installing local CA (if needed)..." -ForegroundColor Cyan
& mkcert -install 2>$null

Write-Host "Creating certificate for $LanIP and localhost..." -ForegroundColor Cyan
Push-Location $CertDir
try {
    & mkcert "$LanIP" "localhost" "127.0.0.1"
    # mkcert creates e.g. "10.205.95.193+2.pem" and "10.205.95.193+2-key.pem"
    $certFile = Get-ChildItem -Filter "*.pem" | Where-Object { $_.Name -notmatch "-key" } | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    $keyFile = Get-ChildItem -Filter "*-key.pem" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if ($certFile -and $keyFile) {
        Copy-Item $certFile.FullName -Destination "localhost.pem" -Force
        Copy-Item $keyFile.FullName -Destination "localhost-key.pem" -Force
        Write-Host "Certificates copied to certificates/localhost.pem and localhost-key.pem" -ForegroundColor Green
    }
    # Remove the temp named certs so next run is clean
    Get-ChildItem -Filter "*.pem" | Where-Object { $_.Name -ne "localhost.pem" -and $_.Name -ne "localhost-key.pem" } | Remove-Item -Force -ErrorAction SilentlyContinue
} finally {
    Pop-Location
}

# Export root CA for Android (Android needs DER format)
$caroot = & mkcert -CAROOT 2>$null
$rootCaPem = Join-Path $caroot "rootCA.pem"
$rootCaDer = Join-Path $CertDir "rootCA-for-android.der.crt"
if (Test-Path $rootCaPem) {
    $openssl = Get-Command openssl -ErrorAction SilentlyContinue
    if ($openssl) {
        & openssl x509 -inform PEM -outform DER -in $rootCaPem -out $rootCaDer
        Write-Host "Android root CA saved: frontend/certificates/rootCA-for-android.der.crt" -ForegroundColor Green
        Write-Host "Transfer this file to your phone and install it: Settings > Security > Encryption & credentials > Install a certificate > CA certificate" -ForegroundColor Yellow
    } else {
        Write-Host "OpenSSL not in PATH. To create Android CA file, run (with Git Bash or WSL):" -ForegroundColor Yellow
        Write-Host "  openssl x509 -inform PEM -outform DER -in `"$rootCaPem`" -out `"$rootCaDer`"" -ForegroundColor Gray
    }
} else {
    Write-Host "Root CA not found at $rootCaPem" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. In frontend folder run: npm run dev" -ForegroundColor White
Write-Host "  2. On your phone: install rootCA-for-android.der.crt as CA certificate (see above)" -ForegroundColor White
Write-Host "  3. Open in phone browser: https://${LanIP}:3000/student" -ForegroundColor White
Write-Host "  4. No 'Proceed anyway' needed; tap Test vibration then Start Camera + Mic" -ForegroundColor White
