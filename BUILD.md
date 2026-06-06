# Build Guide

This document describes how to build HttpsTypeSearch.

## Requirements

- Windows
- .NET Framework 4.7.2 targeting pack
- MSBuild for classic .NET Framework projects
- KeePass compatibility binary or a compatible KeePass source tree

## Project Type

HttpsTypeSearch is a classic C# KeePass plugin project targeting:

- .NET Framework 4.7.2
- C# language version 5

## Expected Layout

The project currently expects a nearby KeePass binary reference for Release builds:

- ../../KeePass BinCompat/2.42/KeePass.exe

For Debug builds, the project is configured to reference a KeePass source tree project.

## Release Build

Example MSBuild command:

```powershell
Set-Location HttpsTypeSearch
& "C:\BuildTools\MSBuild\Current\Bin\MSBuild.exe" HttpsTypeSearch.sln /t:Build /p:Configuration=Release
```

Expected output:

- bin/Release/HttpsTypeSearch.dll
- bin/Release/HttpsTypeSearch.pdb

## PLGX Build

The project includes CreatePlgX.bat.

It expects one of the following KeePass executables to exist:

- ../../KeePass-2.61.1/KeePass.exe
- ../../KeePass/KeePass.exe

To build a PLGX package:

```powershell
Set-Location HttpsTypeSearch
.\CreatePlgX.bat
```

Expected output:

- ../Releases/Build Outputs/HttpsTypeSearch.plgx

## Notes

- Release builds use the compatibility KeePass executable as a reference assembly.
- The project is intended to be built on Windows.
- The plugin is a standalone project, but it is derived from AutoTypeSearch.
