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
    Add-Type -TypeDefinition @"
using System.Runtime.InteropServices;
public static class SnipClipboard {
    [DllImport("user32.dll")]
    public static extern uint GetClipboardSequenceNumber();
}
"@
    # Sequence changes detect fresh clipboard writes even for identical pixels.
    $beforeSequence = [SnipClipboard]::GetClipboardSequenceNumber()
    if ($beforeSequence -eq 0) { Write-CaptureLog 'clipboard sequence unavailable'; exit 2 }
    # The capture overlay is an interactive tool the user must see and control.
    try { Start-Process 'ms-screenclip:' -ErrorAction Stop | Out-Null }
    catch { Start-Process -FilePath 'explorer.exe' -ArgumentList 'ms-screenclip:' -ErrorAction Stop | Out-Null }
    $watch = [Diagnostics.Stopwatch]::StartNew()
    while ($watch.Elapsed.TotalSeconds -lt $TimeoutSeconds) {
        Start-Sleep -Milliseconds 200
        $sequence = [SnipClipboard]::GetClipboardSequenceNumber()
        if ($sequence -eq 0 -or $sequence -eq $beforeSequence) { continue }
        $image = $null
        try { $image = [Windows.Forms.Clipboard]::GetImage() } catch { continue }
        try {
            if ($null -eq $image) { continue }
            if ([SnipClipboard]::GetClipboardSequenceNumber() -ne $sequence) { continue }
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
