# PSB 智能对象工具

Photoshop 面板，用来处理大 PSB/PSD 里的智能对象。

## 稳定版

`cep/`

装到：

`%APPDATA%\Adobe\CEP\extensions\psb-smart-object-tools`

打开：

`窗口 > 扩展功能（旧版） > PSB 智能对象工具`

## UXP 版

`uxp/`

Mac 默认使用 UXP。当前 UXP 版已做完整迁移，包含：

- 转链接
- 收集链接
- 找回丢失链接
- 嵌回文件
- 提取文字
- 清元数据
- 清废链接
- 锐化导出

## Codex 自动安装

让 Codex 使用 DUMIK 插件里的 `D-psb-install` 技能，或直接运行：

```powershell
powershell -ExecutionPolicy Bypass -File "<插件根>\scripts\install_psb_smart_object_tools.ps1"
```
