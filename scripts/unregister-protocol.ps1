$ErrorActionPreference = 'Stop'
$Base = "HKCU:\Software\Classes\irminsul"
if (Test-Path $Base) {
    Remove-Item $Base -Recurse -Force
    Write-Host "Removed irminsul:// protocol." -ForegroundColor Green
} else {
    Write-Host "irminsul:// protocol is not registered."
}

$Capabilities = 'HKCU:\Software\IrminsulWish\Capabilities'
if (Test-Path -LiteralPath $Capabilities) {
    Remove-Item -LiteralPath $Capabilities -Recurse -Force
}
$RegisteredApps = 'HKCU:\Software\RegisteredApplications'
if (Get-ItemProperty -LiteralPath $RegisteredApps -Name 'Irminsul Sync' -ErrorAction SilentlyContinue) {
    Remove-ItemProperty -LiteralPath $RegisteredApps -Name 'Irminsul Sync'
}
if (-not ('Irminsul.ProtocolRemoval' -as [type])) {
    Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
namespace Irminsul {
    public static class ProtocolRemoval {
        [DllImport("shell32.dll")]
        public static extern void SHChangeNotify(uint eventId, uint flags, IntPtr item1, IntPtr item2);
    }
}
'@
}
[Irminsul.ProtocolRemoval]::SHChangeNotify(0x08000000, 0x1000, [IntPtr]::Zero, [IntPtr]::Zero)
