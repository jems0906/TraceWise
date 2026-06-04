param(
    [string]$TunnelBinary = "$env:TEMP\cloudflared.exe",
    [string]$TargetUrl = "http://localhost:8011"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $TunnelBinary)) {
    throw "cloudflared not found at $TunnelBinary. Download it first or adjust -TunnelBinary."
}

& $TunnelBinary tunnel --no-autoupdate --url $TargetUrl
