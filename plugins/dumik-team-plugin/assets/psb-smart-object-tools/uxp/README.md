# PSB 智能对象工具 UXP

这是正式 UXP 通道插件，主要给 macOS 和新版 Photoshop 使用。

当前 UXP 版只负责面板和按钮，实际执行复用 `jsx/` 里的 CEP 同款脚本，所以功能流程和 CEP 版保持一致。

## 功能

- 批量转链接智能对象：生成外层嵌入代理，内部保留 `__PROXY_PREVIEW__` 和隐藏的 `__ORIGINAL_LINK__`。
- 收集链接：把链接源文件拷到 `links/主文件名_links`，并重新链接，包含代理内部链接。
- 找回丢失链接：选择文件夹，按文件名匹配丢失链接，包含代理内部链接。
- 嵌回文件：把链接智能对象转为内嵌。
- 清废链接：把未使用 links 移到 `_unused_links_时间`。
- 清元数据：清理当前文档，并进入未链接、非代理的内嵌智能对象清理。
- 清缓存：清理 Photoshop 历史记录、剪贴板和缓存。
- 锐化导出：按 CEP 脚本流程盖印、USM、导出 JPG，再删除盖印层。
- 提取文字：按 CEP 脚本流程处理当前智能对象文字。

## 安装 / 调试

### 方式一：CCX 安装

运行插件根目录的安装脚本，会生成 `.ccx` 包，并尽量用 Adobe UPIA 自动安装：

```bash
bash scripts/install_psb_smart_object_tools_mac.sh
```

如果 UPIA 不存在，就手动双击脚本输出的 `.ccx` 包。

### 方式二：UXP Developer Tool

1. 打开 Adobe UXP Developer Tool。
2. `Add Plugin...`
3. 选择这个目录：

当前 `uxp` 目录里的 `manifest.json`

4. 点击 `Load`。
5. 在 Photoshop 的 `插件` 菜单里打开 `PSB 智能对象工具`。

## 注意

- 转链接会修改当前文档，但不会自动保存主 PSB。
- 当前 UXP 版需要 Photoshop 2023+。
- 第一次加载时，如果文件权限受限，需要允许本地文件访问。
- 如果按钮报 `AdobeScriptAutomation Scripts` 相关错误，说明当前 Photoshop/UXP 环境禁止从 UXP 调 JSX，需要改用 CEP 版或升级 Photoshop。
