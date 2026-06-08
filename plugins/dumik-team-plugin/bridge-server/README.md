# DUMIK 批量协作 · 本地桥服务

Agent 模式专用。手动模式不需要它。

把 BatchRefiner（前端）、Agent（引擎）、项目文件夹三方接起来：托管前端、watch 项目文件夹、WebSocket 实时推 `run-state.json`、收前端选片写 `selection.json`。

合同字段见 `../assets/批量协作-文件合同.md`。

## 安装

```bash
cd bridge-server
npm install
```

需要 Node 18+。

## 运行

```bash
# Windows PowerShell 示例
$env:PROJECT_DIR   = "F:\AI HOME\CODEX\image\outputs\批量改图项目\纯钛乌檀木菜板-detail"
$env:FRONTEND_DIST = "F:\path\to\BatchRefiner\dist"   # BatchRefiner 跑 npm run build 后的产物
$env:AGENT_API_KEY = "<图片接口 Key>"                  # 仅服务端持有，不下发前端
node server.js
```

打开 `http://localhost:4399`，BatchRefiner 切到 Agent 模式即连上。

## 它做什么 / 不做什么

做：
- `GET /api/run-state` 首连兜底拉全量。
- `WS /ws` 推 `run-state`：watch `<项目>/bridge/run-state.json` 和 `<项目>/输出/确认图/`，变即推。
- `POST /api/selection` 合并写 `<项目>/bridge/selection.json`，供 Agent 读。
- `/files/...` 把项目图片暴露成 URL，前端按 `resultImages.src` 相对路径取图。
- 托管前端静态产物。

不做：
- 不生图。生成、自检、校准、QA、修复全在 Agent。
- 不把 Key 下发前端。

## 数据流

```text
Agent  --写--> 输出/确认图/*.png + bridge/run-state.json
                         │ (chokidar watch)
桥服务 --WS run-state--> BatchRefiner(Agent 模式)
BatchRefiner --POST selection--> 桥服务 --写--> bridge/selection.json
                         │ (Agent 轮询/被通知)
Agent  --读 selection--> 推进下一步
```

## 待补（骨架留的 TODO）

- 鉴权：本地单机默认无鉴权；如多人或暴露内网，加 token。
- selection 的 schema 校验（按合同字段）。
- run-state 增量 diff 推送（当前推全量，图多时再优化）。
- 与 Agent 的更紧耦合：如需更实时，可加 `POST /api/run-state` 让 Agent 直接推，省去文件 watch 延迟。
