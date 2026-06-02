param(
    [string]$NasRoot = "",
    [int]$Port = 8787,
    [string]$CloudflaredPath = "",
    [string]$StatePath = "",
    [switch]$NoDownload
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

function Get-CodexHome {
    if ($env:CODEX_HOME) { return $env:CODEX_HOME }
    return "C:\Users\admin\.codex"
}

function Get-DefaultNasRoot {
    $encoded = "Wjpc5paH5Lu25Li05pe25Lyg6YCBXGJhbmFuYTJfcmVmcw=="
    return [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($encoded))
}

function Find-FreePort([int]$StartPort) {
    for ($candidate = $StartPort; $candidate -lt ($StartPort + 40); $candidate++) {
        $listener = Get-NetTCPConnection -LocalPort $candidate -State Listen -ErrorAction SilentlyContinue
        if (-not $listener) { return $candidate }
    }
    throw "No free local port found from $StartPort."
}

function Ensure-Cloudflared([string]$PathHint, [switch]$SkipDownload) {
    if ($PathHint -and (Test-Path -LiteralPath $PathHint)) {
        return (Resolve-Path -LiteralPath $PathHint).Path
    }

    $cmd = Get-Command cloudflared -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }

    $targetDir = Join-Path $env:USERPROFILE "bin"
    $target = Join-Path $targetDir "cloudflared.exe"
    if (Test-Path -LiteralPath $target) { return $target }
    if ($SkipDownload) { throw "cloudflared.exe not found and -NoDownload was set." }

    New-Item -ItemType Directory -Force -Path $targetDir | Out-Null
    $url = "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe"
    Invoke-WebRequest -Uri $url -OutFile $target
    return $target
}

function Wait-LocalServer([string]$Url) {
    for ($i = 0; $i -lt 20; $i++) {
        try {
            Invoke-WebRequest -Uri $Url -Method Head -TimeoutSec 2 -UseBasicParsing | Out-Null
            return
        } catch {
            Start-Sleep -Milliseconds 500
        }
    }
    throw "Local static server did not respond: $Url"
}

function Wait-TunnelUrl([string]$LogPath) {
    for ($i = 0; $i -lt 80; $i++) {
        if (Test-Path -LiteralPath $LogPath) {
            $text = Get-Content -LiteralPath $LogPath -Raw -Encoding UTF8 -ErrorAction SilentlyContinue
            if (-not $text) {
                Start-Sleep -Milliseconds 750
                continue
            }
            $match = [regex]::Match($text, "https://[-a-z0-9]+\.trycloudflare\.com")
            if ($match.Success) { return $match.Value }
        }
        Start-Sleep -Milliseconds 750
    }
    throw "Cloudflare tunnel URL was not found in log: $LogPath"
}

$codexHome = Get-CodexHome
if (-not $NasRoot) {
    $NasRoot = Get-DefaultNasRoot
}
if (-not $StatePath) {
    $StatePath = Join-Path $codexHome "dumik-team-plugin\nas_public_tunnel_state.json"
}
$configPath = Join-Path $codexHome "dumik-team-plugin\nas_image_url.json"
$logDir = Join-Path $codexHome "dumik-team-plugin\logs"

New-Item -ItemType Directory -Force -Path $NasRoot | Out-Null
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $StatePath) | Out-Null
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

$Port = Find-FreePort $Port
$cloudflared = Ensure-Cloudflared $CloudflaredPath $NoDownload
$python = (Get-Command python -ErrorAction Stop).Source
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$serverLog = Join-Path $logDir "nas-static-$stamp.out.log"
$serverErrLog = Join-Path $logDir "nas-static-$stamp.err.log"
$tunnelLog = Join-Path $logDir "nas-cloudflared-$stamp.out.log"
$tunnelErrLog = Join-Path $logDir "nas-cloudflared-$stamp.err.log"
$localUrl = "http://127.0.0.1:$Port"

$serverArgs = @("-m", "http.server", "$Port", "--bind", "127.0.0.1", "--directory", $NasRoot)
$server = Start-Process -FilePath $python -ArgumentList $serverArgs -PassThru -WindowStyle Hidden -RedirectStandardOutput $serverLog -RedirectStandardError $serverErrLog

try {
    Wait-LocalServer $localUrl
    $tunnelArgs = @("tunnel", "--url", $localUrl, "--no-autoupdate")
    $tunnel = Start-Process -FilePath $cloudflared -ArgumentList $tunnelArgs -PassThru -WindowStyle Hidden -RedirectStandardOutput $tunnelLog -RedirectStandardError $tunnelErrLog
    $publicBaseUrl = Wait-TunnelUrl $tunnelErrLog

    $config = @{
        nas_root = $NasRoot
        public_base_url = $publicBaseUrl
    }
    $config | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $configPath -Encoding UTF8

    $state = @{
        nas_root = $NasRoot
        public_base_url = $publicBaseUrl
        local_url = $localUrl
        port = $Port
        static_server_pid = $server.Id
        cloudflared_pid = $tunnel.Id
        cloudflared_path = $cloudflared
        server_log = $serverLog
        server_error_log = $serverErrLog
        tunnel_log = $tunnelLog
        tunnel_error_log = $tunnelErrLog
        config_path = $configPath
        started_at = (Get-Date).ToString("s")
    }
    $state | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $StatePath -Encoding UTF8
    $state | ConvertTo-Json -Depth 6
} catch {
    if ($tunnel -and -not $tunnel.HasExited) {
        Stop-Process -Id $tunnel.Id -Force -ErrorAction SilentlyContinue
    }
    if ($server -and -not $server.HasExited) {
        Stop-Process -Id $server.Id -Force -ErrorAction SilentlyContinue
    }
    throw
}
