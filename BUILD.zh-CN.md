# 编译说明

本文说明如何编译 HttpsTypeSearch。

## 环境要求

- Windows
- .NET Framework 4.7.2 Targeting Pack
- 可用于经典 .NET Framework 项目的 MSBuild
- KeePass 兼容二进制，或者可用的 KeePass 源码树

## 项目类型

HttpsTypeSearch 是一个经典的 C# KeePass 插件项目，目标为：

- .NET Framework 4.7.2
- C# 5

## 当前目录依赖

Release 编译当前默认依赖附近的 KeePass 兼容二进制：

- ../../KeePass BinCompat/2.42/KeePass.exe

Debug 编译则配置为引用 KeePass 源码树中的工程。

## Release 编译

示例命令：

```powershell
Set-Location HttpsTypeSearch
& "C:\BuildTools\MSBuild\Current\Bin\MSBuild.exe" HttpsTypeSearch.sln /t:Build /p:Configuration=Release
```

预期输出：

- bin/Release/HttpsTypeSearch.dll
- bin/Release/HttpsTypeSearch.pdb

## PLGX 打包

项目自带 CreatePlgX.bat。

脚本默认会尝试使用以下任一 KeePass 可执行文件：

- ../../KeePass-2.61.1/KeePass.exe
- ../../KeePass/KeePass.exe

执行方式：

```powershell
Set-Location HttpsTypeSearch
.\CreatePlgX.bat
```

预期输出：

- ../Releases/Build Outputs/HttpsTypeSearch.plgx

## 备注

- Release 构建使用 KeePass 兼容二进制作为引用程序集。
- 该项目设计目标是 Windows 环境。
- 这是一个独立项目，但来源于 AutoTypeSearch 的改造与拆分。
