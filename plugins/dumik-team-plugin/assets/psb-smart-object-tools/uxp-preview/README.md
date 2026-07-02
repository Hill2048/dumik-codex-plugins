# PSB 智能对象工具 UXP

这是正式 UXP 通道插件，不再使用 CEP。

## 功能

- 批量转链接智能对象：当前文档里的内嵌智能对象导出到 `主文件名_links`。
- 收集链接：把链接源文件拷到 `主文件名_links`，并重新链接。
- 找回丢失链接：选择文件夹，按文件名匹配丢失链接。
- 嵌回文件：把链接智能对象转为内嵌。
- 提取文字：UXP 版当前先做到复制并展开当前智能对象，完整卖点分组后续继续迁移。

## 安装 / 调试

### 方式一：命令行加载

如果 Creative Cloud 下载 UXP Developer Tool 失败，直接运行项目根目录的：

`加载UXP插件.ps1`

它会用 Adobe 的 UXP CLI 启动服务、启用 DevTools、加载插件到 Photoshop。

### 方式二：UXP Developer Tool

1. 打开 Adobe UXP Developer Tool。
2. `Add Plugin...`
3. 选择这个目录：

`F:\AI HOME\CODEX\批量压缩大小\uxp-smart-object-tools`

4. 点击 `Load`。
5. 在 Photoshop 的 `插件` 菜单里打开 `PSB 智能对象工具`。

## 注意

- 转链接会修改当前文档，但不会自动保存主 PSB。
- 当前 UXP 版需要 Photoshop 2023+。
- 第一次加载时，如果文件权限受限，需要允许本地文件访问。
