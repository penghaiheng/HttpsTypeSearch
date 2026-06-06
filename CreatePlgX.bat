@echo off
cd %~dp0

set KEEPASS_EXE=..\..\KeePass-2.61.1\KeePass.exe
if not exist "%KEEPASS_EXE%" set KEEPASS_EXE=..\..\KeePass\KeePass.exe
set PLGX_BUILD_ROOT=%TEMP%\HttpsTypeSearch-PlgX
set PLGX_SOURCE=%PLGX_BUILD_ROOT%\HttpsTypeSearch

echo Deleting existing PlgX folder
rmdir /s /q "%PLGX_SOURCE%"

echo Deleting existing PlgX output
del /q HttpsTypeSearch.plgx 2>nul

echo Creating PlgX folder
mkdir "%PLGX_SOURCE%"

echo Creating release output folder
mkdir "..\Releases\Build Outputs" 2>nul

echo Copying files
xcopy ".\*" "%PLGX_SOURCE%" /s /e /exclude:PlgXExclude.txt

echo Compiling PlgX
"%KEEPASS_EXE%" /plgx-create "%PLGX_SOURCE%" --plgx-prereq-kp:2.27
if errorlevel 1 exit /b 1

echo Releasing PlgX
if not exist HttpsTypeSearch.plgx exit /b 1
move /y HttpsTypeSearch.plgx "..\Releases\Build Outputs\HttpsTypeSearch.plgx"
if errorlevel 1 exit /b 1

echo Cleaning up
rmdir /s /q "%PLGX_BUILD_ROOT%"
set KEEPASS_EXE=
set PLGX_BUILD_ROOT=
set PLGX_SOURCE=
