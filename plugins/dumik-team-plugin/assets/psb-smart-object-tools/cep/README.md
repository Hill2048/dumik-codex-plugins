# PSB 智能对象工具

这是 Photoshop CEP 面板插件，把两个现有 JSX 收到一个面板里：

- 批量转为链接智能对象
- 收集链接对象到主文件目录
- 批量重新链接丢失智能对象
- 批量嵌入链接智能对象
- 只提取当前智能对象文字，并整理成卖点分组

## 安装

把整个 `psb-smart-object-tools` 文件夹复制到：

`C:\Users\admin\AppData\Roaming\Adobe\CEP\extensions\psb-smart-object-tools`

如果 Photoshop 不显示未签名插件，需要开启 CEP 调试模式：

```powershell
reg add "HKCU\Software\Adobe\CSXS.11" /v PlayerDebugMode /t REG_SZ /d 1 /f
reg add "HKCU\Software\Adobe\CSXS.12" /v PlayerDebugMode /t REG_SZ /d 1 /f
```

然后重启 Photoshop，在 `窗口 > 扩展功能` 里打开 `PSB 智能对象工具`。

## 使用

- `批量转链接智能对象`：处理当前打开的文档，外部文件放到 `主文件名_links`。
- `收集链接对象到主文件目录`：把当前文档里的链接源文件复制到 `主文件名_links`，并把图层重链到复制后的文件。
- `批量重新链接丢失智能对象`：选择一个文件夹递归查找丢失源文件，按原文件名精确匹配；同名多个会跳过。
- `批量嵌入链接智能对象`：把当前文档里的链接智能对象转回内嵌智能对象。
- `只提取当前 SO 文字`：先选中一个智能对象，只处理这个对象。

两个脚本都不会自动保存主 PSB。
