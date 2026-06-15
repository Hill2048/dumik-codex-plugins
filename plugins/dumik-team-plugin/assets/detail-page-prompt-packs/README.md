# 详情页 prompt-pack 视觉证据库

沉淀详情页常用的视觉证据 family，让 `grid-card-prompts` **从 pack 里选方向**，而不是每次让模型临场想 4 个方向。这是「抽卡」从一次性发挥变成可复用系统的关键。

## 六个 family

| family_id | 中文 | 用来证明 | 适合段一 2x2 | 需要产品白底图 |
|---|---|---|---|---|
| proof-by-contrast | 对比证明 | 前后/正反/生熟/有无差异 | 是 | 是 |
| proof-by-scene | 场景证明 | 真实使用、代入感 | 是 | 是 |
| proof-by-material-macro | 材质微距 | 材质质感、做工 | 是 | 是 |
| proof-by-structure-callout | 结构指示 | 结构设计、巧思 | 否 | 是 |
| proof-by-lifestyle | 生活方式 | 情绪价值、品牌调性 | 是 | 否 |
| proof-by-ad-poster | 广告化 | 主图、利益点海报 | 是 | 是 |

## 每个 family 的字段

- `version`：family 自身版本；改 routes / 构图变量 / 收口规则时升版本。
- `intent`：这个 family 用来证明什么。
- `suits_selling_points`：适合哪些卖点。
- `visual_evidence`：画面证据是什么（抽象卖点翻成可见画面）。
- `composition_variables`：构图变量，段一 4 个方向就在这些变量上做差异。
- `common_drift`：最容易漂移哪里，写提示词时重点收口。
- `fits_stage1_2x2`：适不适合段一 2x2 探方向。
- `needs_white_bg_ref`：要不要带产品白底图作结构参考。
- `routes[]`：可选的机位/构图 route，每条带 `route_id` + `camera_route`，对应 autopilot run-state 里 `task.routeId`，便于复盘「哪条 route 有效」。
- `card_direction_seed`：段一 2x2 生成 4 个方向的种子说明。

## 怎么用（grid-card-prompts）

1. 从 `ecom-detail-planner` 拿到卖点 + 视觉证据策略。
2. 按卖点匹配 1-2 个 family（看 `suits_selling_points`）。
3. 段一：从选中 family 的 `composition_variables` / `routes` 里取 3-4 个方向，组成 2x2，不再自由发挥。
4. 段二：选中方向后展开全幅候选，每行带上 `route_id`，只在 route 内微调一个变量。
5. 写提示词时按 family 的 `common_drift` 做风险收口，并让画面贴合视觉设定的视觉调性一句话。

## route 有效性回写（让资产越用越准）

台账：本目录 `route-feedback.json`，只追加不改史。

- **什么时候写**：autopilot 闸② 选片完成后（或手动链路选完片后），按本批次每条用过的 route 追加一条记录：出了几张、keep / repair / reroll 各几张、一句话点评。
- **什么时候读**：`grid-card-prompts` 选方向、autopilot 段二展开 route 时，先看台账历史——同 family 下 keep 率高的 route 优先，连续翻车的 route 降级或修 family。
- **什么时候升 family 版本**：根据台账结论改了某 family 的 routes、构图变量或收口规则，就把该 family 的 `version` 升一档，并在 notes 里写依据。

## 扩展

某卖点不匹配现有 family 时，可新增一个 family JSON（沿用同样字段），不要把临场想法塞进抽卡里散落。新增后在本表登记。
