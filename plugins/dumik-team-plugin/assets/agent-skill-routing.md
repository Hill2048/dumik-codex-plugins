# Agent 与 Skill 路由文档

这个文件是 DUMIK Team Plugin 的统一路由说明。所有 agent 先看这里，再进入对应 `SKILL.md`。不要把同一套路由规则重复写到顶层项目目录、hooks、README 或单个 agent 配置里。

## 文档权威顺序

1. 当前项目：项目根目录 `CURRENT_PROJECT.md`
2. 路由规则：本文件 `plugins\dumik-team-plugin\assets\agent-skill-routing.md`
3. 执行细节：对应技能的 `SKILL.md`
4. 历史记录：项目根目录 `CONTEXT.md`

如果文档冲突，按上面的顺序判断；`CONTEXT.md` 只记录历史，不作为执行规则来源。

## 项目入口与环境

项目入口协议、项目目录、归档规则、环境部署、工具检查和自动修复的唯一来源是 `assets\project-env-protocol.md`。本文件不重复写，各 skill 也不要重复写。

## 总路由

```text
初始化工作台 / 新仓库初始化 / 装好插件怎么开始 / 缺入口文件
  -> workspace-init

—— 图片线（先按 AGENTS.md「图片任务总监职责」给一句判断）——

改图 / 白底精修 / 多参考图融合 / KV 概念 / 场景母体 / 视觉 brief
  -> image-prompt-optimizer

图片改脏了 / 去脏污 / 还原高清 / 按公众号四步法修复 / image2 修复
  -> image-repair-hd-workflow

详情页出图策划 / 视觉设定 / 卖点视觉证据 / 卖点创意方向
  -> ecom-detail-planner

四宫格抽卡 / 单卖点发散 / 2x2 探方向 / 量产全幅候选
  -> grid-card-prompts

详情页批量自动串跑 / 项目制批量出图 / 一整套详情页自动跑
  -> ecom-detail-autopilot

抽卡选片后产品细节漂移 / 局部切图修复 / 把手盖子五金品牌区材质偏离产品白底图
  -> product-detail-repair

明确生图 / 出图 / 调用图片接口（单图或批量）
  -> image-batch-agent

图片放大 / 超分 / 高清放大 / 抠图 / 去背景 / RunningHub 后处理
  -> runninghub-workflow-agent

—— 视频线（先按 AGENTS.md「视频任务总导演职责」给一句判断）——

卖点顺序 / 转化逻辑 / 30-60 秒视频结构 / 证据链
  -> ecom-video-conversion

故事板 / 连续分镜 / 关键帧 / 逐镜生视频提示词
  -> video-storyboard-prompts

明确生视频 / 确认片 / 批量提交 Dreamina / Veo
  -> video-batch-agent

不确定是图片还是视频
  -> 先判断最终交付；静态图走图片线，动态片走视频线
```

总监职责（判断格式、检查项、调度纪律）不再是独立 skill，由 `workspace-init` 按项目类型写进各工作台的 `AGENTS.md`；本文件只管任务到 skill 的分流。

## 11 个 Agent / Skill 的职责

### workspace-init

- 作用：工作台初始化。新仓库/新电脑装好插件后跑一次：按模板生成入口文件（AGENTS.md、CLAUDE.md、CURRENT_PROJECT.md、CONTEXT.md），按需建第一个项目目录，初始化 API 缓存并做轻量环境检查。
- 触发：初始化工作台、初始化项目、新仓库初始化、装好插件怎么开始、仓库根缺入口文件。
- 交接：初始化完成后，任务按 AGENTS.md 总监职责给判断，再按本文件总路由分流。
- 禁止：不覆盖已有入口文件（用户明确要求重置才允许，且先留底）；不把 API Key 写进仓库文件。
- 备注：原 `ecom-visual-director` / `tvc-director` 两个总监 skill 已并入 AGENTS.md 模板，归档在 `archive\directors-merged-into-agents-md\`。

### ecom-detail-planner

- 作用：详情页出图策略层，固化视觉设定，规划详情页结构、每卖点视觉证据和创意方向。是图片线的转化策划入口，对称于视频线的 `ecom-video-conversion`。
- 触发：详情页出图策划、视觉设定、卖点视觉证据、详情页结构、卖点创意方向、运营给卖点要延伸画面。
- 交接：单卖点发散给 `grid-card-prompts`；已选方向写改图指令给 `image-prompt-optimizer`；细节偏差给 `product-detail-repair`；明确生图给 `image-batch-agent`。
- 禁止：不写最终抽卡提示词、不调用生图接口、不重复生成已存在的视觉设定。

### grid-card-prompts

- 作用：详情页发散层，两段式四宫格抽卡。段一单张 2x2 探 4 个方向，段二选中后展开多行独立全幅候选；引用视觉设定不重写 SKU。
- 触发：四宫格抽卡、单卖点发散、2x2 探方向、量产全幅候选、一个卖点多种可能。
- 交接：明确生图给 `image-batch-agent`；选片后细节偏差给 `product-detail-repair`；缺策略或视觉设定回到 `ecom-detail-planner`。
- 禁止：不调用生图接口、不优化已有改图指令、不用 `count` 出多候选、不在四格或多行偷改产品结构。

### ecom-detail-autopilot

- 作用：详情页批量出图的自动编排器，完全在 Agent（Codex / Hermes）内跑，把 planner / grid-card-prompts / image-batch-agent / product-detail-repair 串成自动流水线；三个闸在对话里停等用户，进度写轻量 run-state 到 `输出\运行记录` 供断点续跑，校准沉淀回写视觉设定。是唯一会主动驱动生成的 skill。不依赖前端和桥服务（旧方案已归档 `archive\bridge-frontend-legacy`）。
- 触发：详情页批量自动串跑、项目制批量出图、走 Agent 模式、一整套详情页自动跑。
- 交接：策略给 `ecom-detail-planner`；抽卡词给 `grid-card-prompts`；生成给 `image-batch-agent`；修复/QA 给 `product-detail-repair`；顶层路由/项目入口按 AGENTS.md 总监职责。
- 禁止：不自己写最终提示词或手搓接口参数；三个闸（方向/选片/终审）必须真停，在对话里等用户回话；校准只回写产品级；pilot 只跑一个卖点，并发只在校准之后。
- 边界：只在用户明确要批量/自动串跑/Agent 模式时进入；否则走原有逐步链路。

### product-detail-repair

- 作用：抽卡选片后的质量门，诊断漂移的产品细节，给局部切图指引，再用 banana2 加产品白底图作参考写局部修复提示词。
- 触发：抽卡选片后产品细节漂移、把手/盖子/五金/品牌区/材质偏离产品白底图、局部切图修复。
- 交接：明确生图给 `image-batch-agent`（明确 banana2 + 参考图）；缺产品白底图回到 `ecom-detail-planner` 视觉设定。
- 禁止：不调用生图接口、不做自动切图（本版手动切图）、不整图重生、不修没偏差的结构。

### image-prompt-optimizer

- 作用：图片提示词唯一入口，双模式。改图模式：目标图、比例、参考图角色、产品结构保护、Banana Pro 中文改图指令；brief 模式（合并自原 `super-image-prompt`）：KV 概念、场景母体、材质光影增强、人像皮肤、把模糊想法写成美术指导语言。
- 触发：改图、白底精修、多参考图融合、保持角度、保护结构、品牌区修正、KV 概念、场景视觉、材质光线增强、模糊视觉方向。
- 交接：如用户明确要实际生成，把确认后的词交给 `image-batch-agent`。
- 禁止：不调用生成接口；不静默改变把手、盖子、五金、品牌区、轮廓或 SKU 比例；不堆抽象形容词，要写可见画面。

### image-repair-hd-workflow

- 作用：按公众号四步法做图片去脏污和高清修复。固定流程：先线稿生图，再固有色提取，再反推提示词，最后带着线稿图+固有色图再生一次最终高清修复图。
- 触发：图片改脏了、去脏污、还原高清、image2 修复、按公众号四步法修复。
- 交接：真正生图复用 `image-batch-agent` 的脚本入口；如果用户只要方案，可以停在提示词和步骤结果。
- 禁止：不跳过第一步生图；不把它退化成普通改图；不自己重写图片接口层。

### image-batch-agent

- 作用：普通图片接口执行 agent，只提交已确认的提示词、原图和参考图到 Image2 / Banana 系列并保存结果。
- 触发：用户明确说生成、出图、调用普通图片接口、编辑图片、保存结果；明确批量时进入批量模式。
- 交接：RunningHub / RH / 放大工作流 / 超分 / 高清放大 / 抠图 / 去背景交给 `runninghub-workflow-agent`；上游必须已经给出完整提示词 / 改图指令。
- 禁止：不写词、不优化词；不执行 RunningHub；没有明确批量不建批量项目；没有明确生成不调用接口。

### runninghub-workflow-agent

- 作用：RunningHub 图片后处理执行 agent，负责提交已配置的放大/超分 AI App、抠图 AI App 或旧工作流，轮询状态并下载结果。
- 触发：用户明确说 RunningHub、RH、放大工作流、超分、高清放大、抠图、去背景。
- 交接：普通图片生成 / 改图交回 `image-batch-agent`；提示词需求交回对应提示词 skill。
- 禁止：不写提示词，不做普通图片接口提交，不混入 Banana / Image2 的参数规则。

### ecom-video-conversion

- 作用：电商视频转化策划，先定卖点顺序、证据链、开头钩子和转化逻辑。
- 触发：用户问视频怎么讲、卖点怎么排、30 到 60 秒视频结构、种草或转化逻辑。
- 交接：需要镜头时交给 `video-storyboard-prompts`。
- 禁止：不写成纯视觉分镜就跳过转化逻辑。

### video-storyboard-prompts

- 作用：统一产品故事板、Image2 身份板、连续分镜、关键帧和逐镜生视频提示词。
- 触发：故事板、连续分镜、逐镜提示词、关键帧提示词、产品身份锚点。
- 交接：故事板图片生成交给图片线；真实生视频交给 `video-batch-agent`。
- 禁止：不提交生图或生视频；不拆回旧的故事板入口。

### video-batch-agent

- 作用：视频执行 agent，负责确认片和批量生视频提交。
- 触发：用户明确说批量生视频、项目制生视频、出确认片、确认后批量、提交 Dreamina / Veo。
- 交接：上游必须已经给出逐镜提示词、首帧 / 参考素材和输出路径。
- 禁止：不写视频策略、不替代故事板；确认片未确认前不跑全量。

## 输出归档与最小提问

归档规则和最小提问规则见 `assets\project-env-protocol.md`，不在本文件重复。
