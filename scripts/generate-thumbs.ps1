# PowerShell thumbnail generator for video stickers
# Usage: .\scripts\generate-thumbs.ps1
# Requires ffmpeg available on PATH. Produces {name}.thumb.jpg next to each .mp4/.webm under assets/packs.

$Root = Resolve-Path -Path "$(Split-Path -Parent $MyInvocation.MyCommand.Definition)\.."
$PacksDir = Join-Path $Root 'assets\packs'
$LogFile = Join-Path $Root 'tmp\thumb-generation.log'

if (-not (Test-Path $PacksDir)) {
    Write-Host "No packs directory found at $PacksDir"
    exit 0
}

# Ensure tmp directory exists
$TmpDir = Join-Path $Root 'tmp'
if (-not (Test-Path $TmpDir)) { New-Item -ItemType Directory -Path $TmpDir | Out-Null }

# Clear or create log
"Thumbnail generation started: $(Get-Date -Format o)" | Out-File -FilePath $LogFile -Encoding utf8

Get-ChildItem -Path $PacksDir -Recurse -File | Where-Object { $_.Extension -match '\.(mp4|webm)$' } | ForEach-Object {
    $video = $_
    $outThumb = Join-Path $video.DirectoryName ("$($video.BaseName).thumb.jpg")

    # Skip if thumb already exists and is > 512 bytes
    if (Test-Path $outThumb) {
        $size = (Get-Item $outThumb).Length
        if ($size -gt 512) {
            "SKIP: $($video.FullName) -> $outThumb (exists, size=$size)" | Out-File -FilePath $LogFile -Append -Encoding utf8
            return
        }
    }

    # Build ffmpeg args. Use -y and -update 1 to avoid image2 pattern errors on Windows.
    $args = @('-y','-ss','00:00:00.500','-i', $video.FullName, '-frames:v','1','-q:v','2','-update','1', $outThumb)

    try {
        $psi = New-Object System.Diagnostics.ProcessStartInfo
        $psi.FileName = 'ffmpeg'
        $psi.Arguments = $args -join ' '
        $psi.RedirectStandardError = $true
        $psi.RedirectStandardOutput = $true
        $psi.UseShellExecute = $false
        $psi.CreateNoWindow = $true

        $proc = [System.Diagnostics.Process]::Start($psi)
        $stderr = $proc.StandardError.ReadToEnd()
        $stdout = $proc.StandardOutput.ReadToEnd()
        $proc.WaitForExit()
        $exitCode = $proc.ExitCode

        if ($exitCode -eq 0 -and (Test-Path $outThumb)) {
            "OK: $($video.FullName) -> $outThumb" | Out-File -FilePath $LogFile -Append -Encoding utf8
        } else {
            "FAIL: $($video.FullName) -> $outThumb; exit=$exitCode" | Out-File -FilePath $LogFile -Append -Encoding utf8
            "STDERR: $stderr" | Out-File -FilePath $LogFile -Append -Encoding utf8
        }
    } catch {
        "ERROR: Exception while processing $($video.FullName): $_" | Out-File -FilePath $LogFile -Append -Encoding utf8
    }
}

"Thumbnail generation finished: $(Get-Date -Format o)" | Out-File -FilePath $LogFile -Append -Encoding utf8

Write-Host "Thumbnail generation complete. See $LogFile for details."