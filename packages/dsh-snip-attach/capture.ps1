param(
    [Parameter(Mandatory = $true)][string]$OutFile,
    [ValidateRange(1, 120)][int]$TimeoutSeconds = 120,
    [switch]$DryRun
)
$ErrorActionPreference = 'Stop'
function Write-CaptureLog([string]$Message) {
    try { Add-Content -LiteralPath (Join-Path ([IO.Path]::GetTempPath()) 'dsh-screenshot.log') -Value ("{0:o} dsh-snip-attach: {1}" -f [DateTime]::UtcNow, $Message) } catch {}
}
try {
    Add-Type -AssemblyName System.Windows.Forms
    Add-Type -AssemblyName System.Drawing
    # DryRun exits before ANY clipboard access, screenclip launch, or file write.
    if ($DryRun) {
        Write-Output 'DryRun OK: STA assemblies loaded; no screenclip, clipboard access, or output file write.'
        exit 0
    }
    function Get-ImageSignature([System.Drawing.Image]$Image) {
        $bitmap = [System.Drawing.Bitmap]::new($Image)
        try {
            $parts = @("$($bitmap.Width)x$($bitmap.Height)")
            foreach ($yPart in 0..2) {
                foreach ($xPart in 0..2) {
                    $x = [int][Math]::Floor(($bitmap.Width - 1) * $xPart / 2)
                    $y = [int][Math]::Floor(($bitmap.Height - 1) * $yPart / 2)
                    $parts += $bitmap.GetPixel($x, $y).ToArgb().ToString()
                }
            }
            return ($parts -join ':')
        } finally { $bitmap.Dispose() }
    }
    $before = $null
    # Busy clipboard is retried; never confuse a failed baseline read with empty.
    $baselineReady = $false
    for ($attempt = 0; $attempt -lt 10; $attempt++) {
        $image = $null
        try {
            $image = [Windows.Forms.Clipboard]::GetImage()
            if ($null -ne $image) { $before = Get-ImageSignature $image }
            $baselineReady = $true
            break
        } catch { Start-Sleep -Milliseconds 200 }
        finally { if ($null -ne $image) { $image.Dispose() } }
    }
    if (-not $baselineReady) { Write-CaptureLog 'clipboard baseline failed'; exit 2 }
    try { Start-Process 'ms-screenclip:' -ErrorAction Stop | Out-Null }
    catch { Start-Process -FilePath 'explorer.exe' -ArgumentList 'ms-screenclip:' -ErrorAction Stop | Out-Null }
    $watch = [Diagnostics.Stopwatch]::StartNew()
    while ($watch.Elapsed.TotalSeconds -lt $TimeoutSeconds) {
        Start-Sleep -Milliseconds 200
        $image = $null
        try { $image = [Windows.Forms.Clipboard]::GetImage() } catch { continue }
        try {
            if ($null -eq $image) { continue }
            if ((Get-ImageSignature $image) -eq $before) { continue }
            try { $image.Save($OutFile, [Drawing.Imaging.ImageFormat]::Png) }
            catch { Write-CaptureLog 'PNG save failed'; exit 6 }
            exit 0
        } finally { if ($null -ne $image) { $image.Dispose() } }
    }
    exit 2
} catch {
    Write-CaptureLog 'capture initialization failed'
    exit 2
}
