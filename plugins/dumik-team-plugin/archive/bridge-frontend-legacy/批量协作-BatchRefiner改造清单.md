# 批量协作 · BatchRefiner 改造清单

目标：**保留 BatchRefiner 现有全部能力**（导入、生图、Key 配置、额度、批量、结果管理、快照导入导出），**额外加一个「Agent 模式」**。两种模式并存，可切换。

- 手动模式（原样不动）：用户自己建任务、填 Key、浏览器内生图、管理结果。
- Agent 模式（新增）：连本地桥，Agent 驱动流程，前端显示进度 + 做选片/标注。手动随时能兜底。

基于已读源码：`src/types.ts`、`src/App.tsx`、`src/store.ts`、`src/lib/localCachePersistence.ts`。

## 一、总原则：加法，不删

原有生成调用、`api/generation` 逻辑、`apiKey/platformConfigs`、`QuotaStatus`、`taskExecutionQueue`、本地持久化——**全部保留**。Agent 模式是叠加层，不替换。

只有一处共享小改（两个模式都受益）：选片粒度细化到「具体哪张结果图」。

## 二、模式切换

| 加什么 | 说明 |
|---|---|
| `mode: 'manual' \| 'agent'` | store 加一个模式标志，Topbar 加切换入口 |
| 模式隔离 | Agent 模式下隐藏「生图 / Key 设置 / 额度」等手动控件，避免和桥推来的状态打架；切回手动恢复原样 |
| 数据来源切换 | 手动模式＝现状（IndexedDB + 自己生成）；Agent 模式＝从桥同步 `run-state.json`，task 对用户只读，只能选片/标注 |

实现取巧：Agent 模式本质就是「一个数据来自桥、会自动刷新的项目」。`run-state.json` 已按 `ProjectData` 兼容设计，可走现有 `loadProjectFromJson` + `lib/projectSnapshot` 的 ingest 路径，再由 `bridgeClient` 持续打补丁。等于复用导入逻辑 + 加实时同步 + 加闸 UI。

## 三、Agent 模式新增

| 加什么 | 说明 |
|---|---|
| 桥连接层 `src/lib/bridgeClient.ts` | WebSocket 订阅 `run-state` 增量 + POST `selection`；断线重连、首连拉全量。只在 Agent 模式启用 |
| 进度看板 | 复用 `GenerationLogSession` + `pipeline.stage` + `stats`，显示「在干嘛 / 到哪步 / 第几张」。可扩展现有 `DockProgress` |
| 闸① 方向确认 UI | pilot 结果页：通过 / 打回 + 区域标注（写 `directionDecision`，标注喂校准） |
| 闸③ 终审 UI | approved / redo（写 `finalReview`） |
| 只读态 | Agent 模式下生成中的 task 卡只读，仅选片/标注可交互 |

## 四、共享小改（两模式通用）

| 改什么 | 怎么改 |
|---|---|
| 选片粒度 | 复用 `selectedTaskIds / toggleTaskSelection / selectAllTasks`，补一个「选具体哪张结果图」`selectedResultId`（现在只到任务级）。手动模式选导出、Agent 模式选片都用得上 |

## 五、直接复用（不动）

任务卡、原图/参考/结果图展示、`Lightbox` 预览、`viewMode`（grid/list/results/showcase）、多选、全选、拖拽排序、卡片密度、`Topbar`、`FloatingTaskDock`、快照导入导出。

## 六、本地桥服务（独立小项目，仅 Agent 模式用）

不在 BatchRefiner 仓库内，单独一个轻服务：

```text
bridge-server/
  - Node + ws（WebSocket 推送）
  - express（静态托管 BatchRefiner 构建产物 + REST）
  - chokidar（watch 项目 bridge/ 和 输出/确认图/）
  - 持有 Agent 端 API Key（仅服务端）
```

职责：watch `bridge\run-state.json` 和 `输出\确认图\`，变化即 WebSocket 推前端；收前端 POST 的选片写 `bridge\selection.json`；把图片相对路径转本地 URL；托管前端，设计师开 `localhost` 即用。

注意：手动模式的 Key 仍在前端（现状不变）；只有 Agent 模式的生成在 Agent/桥侧，Key 不下发前端。两套 Key 互不干扰。

## 七、落地顺序

1. 先按《批量协作-文件合同》把 `run-state.json` / `selection.json` 跑通（Agent 能写、能读）。
2. 写桥服务最小版：watch + WebSocket + 静态托管 + 收 selection。
3. BatchRefiner 加 `mode` 切换 + `bridgeClient`；Agent 模式走只读同步，手动模式原样。
4. 加进度看板 + 闸①/闸③ UI + 结果图级选片。
5. Agent 加项目制自动串跑模式（按流程图跑，每步写 run-state、读 selection）。

先 1–3 打通主干（Agent 模式能看到图、能选片），手动模式全程不受影响。
