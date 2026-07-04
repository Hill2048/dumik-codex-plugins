---
name: D-psb-install
version: 0.1.1
description: "安装 PSB 智能对象工具。把插件内置的 CEP 稳定版复制到 Adobe CEP extensions 目录，适合触发词：安装 PSB 插件、安装智能对象工具、装 PSB 智能对象工具、分享来的插件怎么装。"
---

# PSB 智能对象工具安装

把 DUMIK 插件里内置的 Photoshop 面板装到本机。

## 触发

- 安装 PSB 插件
- 安装智能对象工具
- 装 PSB 智能对象工具
- 分享来的 PSB 插件怎么装

## 做法

1. 定位当前 DUMIK 插件根目录。
2. 运行插件根目录下的安装脚本：

```powershell
powershell -ExecutionPolicy Bypass -File "<插件根>\scripts\install_psb_smart_object_tools.ps1"
```

3. 告诉用户重启 Photoshop。
4. 打开位置：

```text
窗口 > 扩展功能（旧版） > PSB 智能对象工具
```

## 说明

- 默认安装 CEP 稳定版。
- UXP 版放在 `assets\psb-smart-object-tools\uxp-preview`，目前只作为预览，不作为主安装方式。
- 安装脚本会备份旧版目录，再复制新版。
- 不要写入 API Key，不需要网络。
