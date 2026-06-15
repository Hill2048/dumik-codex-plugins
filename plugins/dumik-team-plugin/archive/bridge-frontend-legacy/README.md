# 归档：本地桥 + BatchRefiner 前端协作方案

这套是早期「Agent 引擎 ↔ 本地桥服务 ↔ BatchRefiner 前端」三方文件合同方案。

2026-06-11 决定：详情页批量出图**完全在 Agent（Codex / Hermes）内跑**，闸（方向 / 选片 / 终审）在对话里停等用户，不再依赖前端和桥。本目录整套移出主链路，仅作历史参考。

包含：

- `bridge-server/` — Node + express + ws + chokidar 的本地桥骨架（watch run-state、推 WebSocket、收 selection、托管前端、持 Key）。
- `批量协作-文件合同.md` — 三方通信的 run-state.json / selection.json 字段合同。
- `批量协作-分工.md` — Claude / Codex / Hill 三方分工。
- `批量协作-BatchRefiner改造清单.md` — 前端加 Agent 模式的改造清单。
- `批量协作-前端交接说明.md` — 给前端的交接说明。

以后若要重新接前端，从这里恢复，并同步更新 `agent-skill-routing.md` 与 `ecom-detail-autopilot/SKILL.md`。
