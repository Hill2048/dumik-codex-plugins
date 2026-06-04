# DUMIK 团队插件钩子

当前插件校验不接受在 `plugin.json` 里声明 `hooks` 字段，所以这里仅保存团队默认提示。

## 默认提示

- 先读统一路由：`assets/agent-skill-routing.md`。
- 再按任务进入对应 `SKILL.md`。
- 环境检查复用：`assets/verified-environment-checklist.md`。
- hooks 不再保存完整路由，避免和统一路由文档重复或冲突。
