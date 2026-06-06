# HttpsTypeSearch

HttpsTypeSearch 是一个独立的 KeePass 插件，用于对外提供本地 HTTPS 搜索接口，搜索当前已经打开且已解锁的 KeePass 数据库。

这个项目参考并改造自 AutoTypeSearch。原始的 AutoTypeSearch 重点在弹窗搜索和自动输入流程；HttpsTypeSearch 保留了搜索核心，但移除了原有的全局热键 / 弹窗工作流，转而聚焦于本地、带令牌认证的 HTTPS API。

## 它是什么

- 一个 Windows 下的 KeePass 插件。
- 一个只接受本机回环地址请求的本地 HTTPS API。
- 一个从 AutoTypeSearch 独立拆分出来的项目。
- 一个会在 KeePass Options 中添加独立配置页的插件。

## 它不是什么

- 不是云端服务。
- 不是浏览器扩展。
- 默认不对远程网络开放接口。
- 不保留原始 AutoTypeSearch 的弹窗 / 全局热键搜索行为。

## 功能特性

- 跨所有当前已打开且已解锁的 KeePass 数据库搜索。
- 仅支持 HTTPS。
- 为 loopback 地址自动准备自签名证书和绑定。
- 支持 Bearer Token 或 X-Api-Token 认证。
- 可配置监听地址、端口、令牌重置、证书重建。
- 可配置是否在常规结果中返回密码。
- 可配置是否在常规结果中返回 OTP。
- 提供单独的密码接口和 OTP 接口。

## 安全模型

- 只接受 loopback 地址的请求。
- 除 /health 之外的接口都要求认证。
- 强制使用 HTTPS。
- 敏感信息可以仅通过专用接口暴露。

## 接口列表

- GET /health
- GET /search?term=example&limit=20
- GET /entries/{uuid}
- GET /entries/{uuid}/password
- GET /entries/{uuid}/otp

## 认证方式

可任选其一：

- Authorization: Bearer {token}
- X-Api-Token: {token}

## KeePass 配置项

插件会在 KeePass 的 Options 窗口中增加一个 HttpsTypeSearch 页签。

主要配置包括：

- 启用或关闭 HTTPS API
- 监听地址
- 端口
- 最大返回结果数
- 是否启用密码专用接口
- 是否在搜索结果中附带密码
- 是否在搜索结果中附带 OTP
- API Token 重置
- 证书重建
- 搜索字段开关
- 搜索行为开关

## 安装方式

将以下任一文件放到 KeePass 的 Plugins 目录中：

- HttpsTypeSearch.dll
- HttpsTypeSearch.plgx

如果你使用与目标版本兼容的 KeePass 二进制来直接编译，通常使用 DLL 即可。如果你希望让 KeePass 自己加载源码包进行编译，则可以使用 PLGX。

## 编译文档

请参考单独的构建说明：

- BUILD.md
- BUILD.zh-CN.md

## 参考来源

本项目源自 AutoTypeSearch 代码库，保留了其中一部分搜索实现，但整体目标已经调整为一个以 HTTPS 接口为中心的 KeePass 插件。
