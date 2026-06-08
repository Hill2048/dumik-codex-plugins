# PRD：项目制电商视觉 Agent

## 背景

`F:\AI HOME\CODEX\image` 已从一次性图片需求路由，升级为围绕当前商品持续推进的项目制工作台。项目制规则不再分散在顶层多个文档里；当前项目由根目录 `CURRENT_PROJECT.md` 指定，路由由 `assets\agent-skill-routing.md` 指定，具体执行看对应 `SKILL.md`。

## 目标

- 顶层目录只保留最少入口，避免规则重复和冲突。
- Agent 进入任务时先判断是否进入项目制：需要时问项目，确认后留档，后续沿用。
- 支持用户切换项目，或明确选择本次不进入项目。
- 11 个 agent / skill 的作用、触发、禁止事项和交接关系有统一路由文档防失忆。

## 非目标

- 不做通用项目管理系统。
- 不主动生成图片或视频。
- 不替代 Eagle 或飞书素材源。
- 不把 `CONTEXT.md` 当执行规则来源。

## 权威文档

- 当前项目：根目录 `CURRENT_PROJECT.md`
- 路由规则：`plugins\dumik-team-plugin\assets\agent-skill-routing.md`
- 执行细节：各技能 `SKILL.md`
- 历史记录：根目录 `CONTEXT.md`

## 验收

- 顶层 `AGENTS.md` 只写入口，不重复完整路由。
- 顶层 `CURRENT_PROJECT.md` 只写当前项目指针。
- 顶层不保留本 PRD 副本。
- 11 个 `agents\openai.yaml` 都引用统一路由文档。
- 两个领导 skill 都包含项目入口协议，且版本同步到版本清单。
