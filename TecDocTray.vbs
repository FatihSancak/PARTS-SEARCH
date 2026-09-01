Option Explicit

Dim shell
Dim fileSystem
Dim folderPath
Dim psFile
Dim command

Set shell = CreateObject("WScript.Shell")
Set fileSystem = CreateObject("Scripting.FileSystemObject")

folderPath = fileSystem.GetParentFolderName(WScript.ScriptFullName)
psFile = folderPath & "\TecDocTray.ps1"

command = "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & psFile & """"

shell.Run command, 0, False