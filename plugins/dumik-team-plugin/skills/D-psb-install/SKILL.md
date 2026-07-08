---
name: D-psb-install
version: 0.1.4
description: "安装/更新 PSB 智能对象工具。把插件内置的 CEP 稳定版复制到 Adobe CEP extensions 目录，适合触发词：安装 PSB 插件、更新 PSB 插件、安装智能对象工具、装 PSB 智能对象工具、分享来的插件怎么装。"
---

# PSB 智能对象工具安装

把 DUMIK 插件里内置的 Photoshop 面板装到本机。用户只要说“更新 PSB 插件”“更新 psb 插件”“安装 PSB 智能对象工具”，就执行这个流程。

## 触发

- 安装 PSB 插件
- 更新 PSB 插件
- 安装智能对象工具
- 装 PSB 智能对象工具
- 分享来的 PSB 插件怎么装

## 做法

1. 自己定位 PSB 插件资产目录，不要写死用户电脑路径。目录特征：
   - 名字包含 `psb-smart-object-tools`
   - 有 `index.html`
   - 有 `js/main.js`
   - 有 `CSXS/manifest.xml`
   - 有 `jsx/link-smart-objects.jsx`

2. 找到本机 CEP 扩展目录，不要写死路径。根据当前系统和用户目录自动判断，找到或创建 `extensions` 目录，最终插件目录名保持为 `psb-smart-object-tools`。

3. 更新时先删除旧目录 `psb-smart-object-tools`，再复制新版，不要和旧文件混合覆盖。

4. 运行插件根目录下的安装脚本，更新时优先用 `-Update`：

```powershell
powershell -ExecutionPolicy Bypass -File "<插件根>\scripts\install_psb_smart_object_tools.ps1" -Update
```

只检查不安装时：

```powershell
powershell -ExecutionPolicy Bypass -File "<插件根>\scripts\install_psb_smart_object_tools.ps1" -CheckOnly
```

5. 安装后必须校验：
   - 源目录和安装目录文件数量一致
   - 关键文件 hash 一致
   - `index.html`、`js/main.js`、`CSXS/manifest.xml` 存在
   - JSX 至少包含：
     - `jsx/link-smart-objects.jsx`
     - `jsx/relink-missing-smart-objects.jsx`
     - `jsx/collect-linked-smart-objects.jsx`
     - `jsx/embed-linked-smart-objects.jsx`
     - `jsx/clean-ps-metadata.jsx`
     - `jsx/cleanup-unused-links.jsx`
     - `jsx/stamp-usm-sharpen-documents.jsx`

6. 如果系统需要 CEP 未签名插件开关，自动判断/覆盖常见 CSXS 版本，设置 `PlayerDebugMode = 1`，不要只设置一个固定版本。

7. 最后告诉用户：
   - 找到的安装源目录
   - 找到的安装目标目录
   - 是否删除了旧版
   - 校验是否通过

8. 打开位置：

```text
窗口 > 扩展功能（旧版） > PSB 智能对象工具
```

## 说明

- 默认安装 CEP 稳定版。
- UXP 版放在 `assets\psb-smart-object-tools\uxp-preview`，目前只作为预览，不作为主安装方式。
- 更新模式会删除旧版和历史备份，避免继续加载老面板。
- 不要写入 API Key，不需要网络。
- 不要推 GitHub，不要改插件源码；这个 skill 只做安装/更新。
