#ifndef ReleaseVersion
  #define ReleaseVersion "0.2.0-rc.1"
#endif
[Setup]
AppId={{A605D24C-4B66-41CE-9D61-2672F86A1EFA}
AppName=Per Aspera
AppVersion={#ReleaseVersion}
AppPublisher=Project Per Aspera
DefaultDirName={localappdata}\Programs\Per Aspera
DefaultGroupName=Per Aspera
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
OutputDir=..\dist
OutputBaseFilename=PerAspera-Setup
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
UninstallDisplayIcon={app}\PerAspera.exe
CloseApplications=yes

[Files]
Source: "..\dist\PerAspera-Portable.exe"; DestDir: "{app}"; DestName: "PerAspera.exe"; Flags: ignoreversion
Source: "..\README.md"; DestDir: "{app}"
Source: "..\docs\CAMPAIGN_MODEL.md"; DestDir: "{app}\docs"
Source: "..\docs\FEATURE_COVERAGE.md"; DestDir: "{app}\docs"

[Tasks]
Name: "desktopicon"; Description: "Create a desktop shortcut"; Flags: unchecked

[Icons]
Name: "{group}\Per Aspera"; Filename: "{app}\PerAspera.exe"; Parameters: "--installed"
Name: "{autodesktop}\Per Aspera"; Filename: "{app}\PerAspera.exe"; Parameters: "--installed"; Tasks: desktopicon

[Run]
Filename: "{app}\PerAspera.exe"; Parameters: "--installed"; Description: "Launch Per Aspera"; Flags: nowait postinstall skipifsilent

; User saves live outside {app}; uninstall deliberately leaves them intact.
