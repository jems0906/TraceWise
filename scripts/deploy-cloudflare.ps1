param(
    [string]$EnvFile = ".env.cloudflare",
    [string]$ComposeFile = "docker-compose.cloudflare.yml"
)

$ErrorActionPreference = "Stop"

Set-Location (Split-Path -Parent $PSScriptRoot)

if (-not (Test-Path $EnvFile)) {
    throw "Missing $EnvFile. Copy .env.cloudflare.example to .env.cloudflare and set CLOUDFLARED_TUNNEL_TOKEN first."
}

docker compose --env-file $EnvFile -f docker-compose.yml -f $ComposeFile up -d
