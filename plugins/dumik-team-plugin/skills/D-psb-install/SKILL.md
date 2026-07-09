---
name: D-psb-install
version: 0.1.10
description: "安装/更新 PSB 智能对象工具。先自动核对 GitHub 最新版本；默认安装 UXP 版，适合触发词：安装 PSB 插件、更新 PSB 插件、安装智能对象工具、装 PSB 智能对象工具、分享来的插件怎么装。"
---

# PSB 智能对象工具安装

把 DUMIK 插件里内置的 Photoshop 面板装到本机。用户只要说“更新 PSB 插件”“更新 psb 插件”“安装 PSB 智能对象工具”，就执行这个流程。

更新时先查 GitHub `Hill2048/dumik-codex-plugins` 的 `main` 分支版本。远端 `pluginVersion` 更高时，下载 GitHub main zip 的插件资产来安装，不要只用本地旧缓存。

默认安装/打包 UXP。只有用户明确要求旧版时，才走 CEP。

## 触发

- 安装 PSB 插件
- 更新 PSB 插件
- 安装智能对象工具
- 装 PSB 智能对象工具
- 分享来的 PSB 插件怎么装

## 做法

1. 先自动核对 GitHub 版本：
   - 读取本地 `assets/skill-versions.json` 的 `pluginVersion`
   - 读取远端 `https://raw.githubusercontent.com/Hill2048/dumik-codex-plugins/main/plugins/dumik-team-plugin/assets/skill-versions.json`
   - 如果远端版本更高，下载 `https://github.com/Hill2048/dumik-codex-plugins/archive/refs/heads/main.zip`
   - 从下载包里的 `plugins/dumik-team-plugin` 安装 PSB 工具
   - 如果网络失败，明确提示“GitHub 版本检查失败，继续使用本地版本”

2. 自己定位 PSB 插件资产目录，不要写死用户电脑路径。

   CEP 目录特征：
   - 名字包含 `psb-smart-object-tools`
   - 有 `index.html`
   - 有 `js/main.js`
   - 有 `CSXS/manifest.xml`
   - 有 `jsx/link-smart-objects.jsx`

   UXP 目录特征：
   - 名字包含 `psb-smart-object-tools`
   - 有 `manifest.json`
   - 有 `index.html`
   - 有 `js/main.js`
   - 有 `jsx/link-smart-objects.jsx`

3. 判断安装通道：
   - 默认走 UXP
   - 用户明确说旧版/CEP：才走 CEP

4. CEP 更新时先删除旧目录 `psb-smart-object-tools`，再复制新版，不要和旧文件混合覆盖。

5. 运行插件根目录下的安装脚本，更新时优先用 `-Update`。脚本默认会先查 GitHub 版本，并安装 UXP：

```powershell
powershell -ExecutionPolicy Bypass -File "<插件根>\scripts\install_psb_smart_object_tools.ps1" -Update
```

明确指定 UXP：

```powershell
powershell -ExecutionPolicy Bypass -File "<插件根>\scripts\install_psb_smart_object_tools.ps1" -Flavor UXP -Update
```

如果 Mac 没有 PowerShell，运行 shell 脚本：

```bash
bash "<插件根>/scripts/install_psb_smart_object_tools_mac.sh"
```

如果 UPIA 不存在，脚本会生成 `.ccx` 包，并输出包位置；也可以把 `assets/psb-smart-object-tools/uxp/manifest.json` 交给 UXP Developer Tool 加载。

如需离线安装本地版本，Windows 加 `-SkipRemoteCheck`，Mac 设置 `SKIP_REMOTE_CHECK=1`。

只检查不安装时：

```powershell
powershell -ExecutionPolicy Bypass -File "<插件根>\scripts\install_psb_smart_object_tools.ps1" -CheckOnly
```

6. CEP 安装后必须校验：
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
     - `jsx/purge-ps-cache.jsx`
     - `jsx/stamp-usm-sharpen-documents.jsx`

7. UXP 安装后必须校验：
   - `manifest.json`、`index.html`、`js/main.js` 存在
   - `jsx/` 里的 CEP 同款脚本存在，至少包含：
     - `jsx/link-smart-objects.jsx`
     - `jsx/relink-missing-smart-objects.jsx`
     - `jsx/collect-linked-smart-objects.jsx`
     - `jsx/embed-linked-smart-objects.jsx`
     - `jsx/clean-ps-metadata.jsx`
     - `jsx/cleanup-unused-links.jsx`
     - `jsx/purge-ps-cache.jsx`
     - `jsx/stamp-usm-sharpen-documents.jsx`
     - `jsx/extract-smart-object-text.jsx`
   - 能生成 `.ccx` 包
   - 如果系统能找到 UPIA，就用 UPIA 安装；找不到就告诉用户 `.ccx` 包位置

8. 如果系统需要 CEP 未签名插件开关，自动判断/覆盖常见 CSXS 版本，设置 `PlayerDebugMode = 1`，不要只设置一个固定版本。

9. 最后告诉用户：
   - 找到的安装源目录
   - 本地版本和 GitHub 版本
   - 是否使用了 GitHub 下载包
   - 找到的安装目标目录
   - UXP 的 `.ccx` 包位置，如有
   - 是否删除了旧版
   - 校验是否通过

10. CEP 打开位置：

```text
窗口 > 扩展功能（旧版） > PSB 智能对象工具
```

## 说明

- 默认安装 UXP 版。
- 当前 UXP 面板复用 `jsx/` 里的 CEP 同款脚本，不能只复制 HTML/JS/CSS。
- Mac 默认使用 UXP，目录是 `assets\psb-smart-object-tools\uxp`。
- Windows 默认也使用 UXP；旧 CEP 只作兼容保留。
- `uxp-preview` 只保留作历史预览，不作为主安装方式。
- 更新模式会删除旧版和历史备份，避免继续加载老面板。
- 每次发布 PSB 插件更新，都必须同步提高 `pluginVersion`，否则别人的安装脚本会判断“本地已是最新版”。
- 不要写入 API Key，不需要网络。
- 不要推 GitHub，不要改插件源码；这个 skill 只做安装/更新。
