$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Exe = Join-Path $Root "dist\sync\IrminsulSync.exe"

if (-not (Test-Path $Exe)) {
    throw "IrminsulSync.exe not found. Run .\scripts\build-sync.ps1 first."
}

$Base = "HKCU:\Software\Classes\irminsul"
New-Item -Path $Base -Force | Out-Null
Set-ItemProperty -Path $Base -Name "(Default)" -Value "URL:Irminsul Wish Sync Protocol"
New-ItemProperty -Path $Base -Name "URL Protocol" -Value "" -PropertyType String -Force | Out-Null

$Command = Join-Path $Base "shell\open\command"
New-Item -Path $Command -Force | Out-Null
Set-ItemProperty -Path $Command -Name "(Default)" -Value ('"{0}" "%1"' -f $Exe)
Set-Item -Path (Join-Path $Base 'shell') -Value 'open'

# Register application capabilities as well as the legacy shell command. Chromium
# queries the Windows association API before showing its external-app dialog.
$Application = Join-Path $Base 'Application'
New-Item -Path $Application -Force | Out-Null
New-ItemProperty -Path $Application -Name 'ApplicationName' -Value 'Irminsul Sync' -PropertyType String -Force | Out-Null
$Icon = Join-Path $Base 'DefaultIcon'
New-Item -Path $Icon -Force | Out-Null
Set-Item -Path $Icon -Value ('"{0}",0' -f $Exe)
$Capabilities = 'HKCU:\Software\IrminsulWish\Capabilities'
New-Item -Path $Capabilities -Force | Out-Null
New-ItemProperty -Path $Capabilities -Name 'ApplicationName' -Value 'Irminsul Sync' -PropertyType String -Force | Out-Null
New-ItemProperty -Path $Capabilities -Name 'ApplicationDescription' -Value 'Sync Genshin wish history with Irminsul Wish.' -PropertyType String -Force | Out-Null
$Associations = Join-Path $Capabilities 'URLAssociations'
New-Item -Path $Associations -Force | Out-Null
New-ItemProperty -Path $Associations -Name 'irminsul' -Value 'irminsul' -PropertyType String -Force | Out-Null
$RegisteredApps = 'HKCU:\Software\RegisteredApplications'
New-Item -Path $RegisteredApps -Force | Out-Null
New-ItemProperty -Path $RegisteredApps -Name 'Irminsul Sync' -Value 'Software\IrminsulWish\Capabilities' -PropertyType String -Force | Out-Null

if (-not ('Irminsul.ProtocolRegistration' -as [type])) {
    Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Text;
namespace Irminsul {
    public static class ProtocolRegistration {
        [DllImport("shell32.dll")]
        public static extern void SHChangeNotify(uint eventId, uint flags, IntPtr item1, IntPtr item2);
        [DllImport("Shlwapi.dll", CharSet = CharSet.Unicode)]
        private static extern int AssocQueryString(uint flags, uint value, string association, string extra, StringBuilder output, ref uint length);
        public static int Query(uint flags, uint value, string association, StringBuilder output, ref uint length) {
            // Pass a real null pointer; PowerShell converts $null string arguments to empty strings.
            return AssocQueryString(flags, value, association, null, output, ref length);
        }
    }
}
'@
}
[Irminsul.ProtocolRegistration]::SHChangeNotify(0x08000000, 0x1000, [IntPtr]::Zero, [IntPtr]::Zero)
$ApplicationName = [System.Text.StringBuilder]::new(2048)
[uint32]$NameLength = 2048
$AssociationResult = [Irminsul.ProtocolRegistration]::Query(0x1000, 4, 'irminsul', $ApplicationName, [ref]$NameLength)
if ($AssociationResult -ne 0 -or $ApplicationName.Length -eq 0) {
    throw "Registry written but Windows does not recognize the irminsul handler. Association result: $AssociationResult"
}
$ApplicationExe = [System.Text.StringBuilder]::new(2048)
[uint32]$ExeLength = 2048
$ExeResult = [Irminsul.ProtocolRegistration]::Query(0x1000, 2, 'irminsul', $ApplicationExe, [ref]$ExeLength)
if ($ExeResult -ne 0 -or $ApplicationExe.ToString() -ine $Exe) {
    throw "Windows cannot resolve the default protocol executable. Result: $ExeResult; resolved: $ApplicationExe"
}
Write-Host "Registered irminsul:// protocol for current Windows user. Handler: $ApplicationName" -ForegroundColor Green
