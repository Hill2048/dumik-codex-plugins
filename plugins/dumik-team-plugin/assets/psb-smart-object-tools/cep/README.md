# PSB 智能对象工具

这是 Photoshop CEP 面板插件，把两个现有 JSX 收到一个面板里：

- 批量转为链接智能对象
- 收集链接对象到主文件目录
- 批量重新链接丢失智能对象
- 批量嵌入链接智能对象
- 只提取当前智能对象文字，并整理成卖点分组
- 清理 PS DocumentAncestors 元数据垃圾
- 当前文件盖印并 USM 锐化
- 清理废弃 links 文件

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

- `批量转链接智能对象`：处理当前打开的文档；新转链接会按 8 个一批打开处理；会在智能对象内部生成 `__PROXY_PREVIEW__` 合并预览层，并把原始完整内容打包成 `__ORIGINAL_LINK__` 链接 SO 后隐藏。外部原始文件放到 `主文件名_links`，PDF/AI/EPS/图片和 `_proxy` 对象会跳过。
- `单个代理`：只处理当前选中的一个智能对象，使用同一套内部代理结构。
- `收集链接对象到主文件目录`：把当前文档里的链接源文件复制到 `主文件名_links`，并把图层重链到复制后的文件；遇到 `_proxy` 会进入内部收集 `__ORIGINAL_LINK__`。
- `批量重新链接丢失智能对象`：优先自动扫主文件旁边的 `links`；没有 `links` 才手选文件夹；同名多个会跳过；遇到 `_proxy` 会进入内部修复丢失的 `__ORIGINAL_LINK__`。
- `批量嵌入链接智能对象`：把当前文档里的链接智能对象转回内嵌智能对象；会跳过 `_proxy` 对象。
- `清废链接`：扫描当前文档实际使用的 links 文件，把未使用文件移动到 `_unused_links_时间`，不会直接删除。
- `只提取当前 SO 文字`：先选中一个智能对象，只处理这个对象。
- `清元数据`：清理 `photoshop:DocumentAncestors` 元数据；`清理智能对象` 开关打开时会递归处理内嵌智能对象，链接智能对象和 `_proxy` 对象始终跳过。
- `锐化导出`：只处理当前文件；有画板时每个画板单独盖印、锐化并导出 JPG，没有画板时整张文件导出；导出完成后删除临时盖印层。宽度大于 1000px 用 77%，否则用 44%，半径 1.0、阈值 0，JPG 质量满档。

两个脚本都不会自动保存主 PSB。
