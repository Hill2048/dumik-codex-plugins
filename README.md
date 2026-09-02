# DUMIK Codex 插件市场

这是 DUMIK 团队共用的 Codex 插件市场仓库。

## 当前插件

- `dumik-team-plugin`
- 版本：`0.1.0`
- 内容：图片提示词、改图指令、项目制批量改图、高级图像提示词、电商视频转化策划、连续分镜提示词

## 团队安装方式

在 Codex 里打开“添加插件市场”，填写：

- 来源：`https://github.com/Hill2048/dumik-codex-plugins`
- Git 引用：`main`
- 稀疏路径：留空

仓库 Marketplace 清单位于 `.agents/plugins/marketplace.json`。

安装后搜索 `DUMIK Team Plugin` 即可使用。

公开版插件不内置 API Key。批量出图时请在本机设置 `OPENAI_API_KEY`，或运行脚本时传入 `--api-key`。

各 skill 版本号见 `plugins/dumik-team-plugin/assets/skill-versions.json`。

## 更新规则

更新插件时同步修改 `plugins/dumik-team-plugin/.codex-plugin/plugin.json` 里的版本号，并重新提交到 `main`。
