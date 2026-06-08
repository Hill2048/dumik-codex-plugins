# Agent 与 Skill 路由文档

这个文件是 DUMIK Team Plugin 的统一路由说明。所有 agent 先看这里，再进入对应 `SKILL.md`。不要把同一套路由规则重复写到顶层项目目录、hooks、README 或单个 agent 配置里。

## 文档权威顺序

1. 当前项目：项目根目录 `CURRENT_PROJECT.md`
2. 路由规则：本文件 `plugins\dumik-team-plugin\assets\agent-skill-routing.md`
3. 执行细节：对应技能的 `SKILL.md`
4. 历史记录：项目根目录 `CONTEXT.md`

如果文档冲突，按上面的顺序判断；`CONTEXT.md` 只记录历史，不作为执行规则来源。

## 项目入口协议

项目制不是默认强制开启，先看用户意图和当前项目指针。

- 无 `CURRENT_PROJECT.md`，且用户要项目制、批量、多轮沉淀、确认图后批量：先问项目名，以及图片项目 / 视频项目 / 混合项目。
- 已有 `CURRENT_PROJECT.md`，且用户没有要求切换：默认沿用当前项目，不再重复问项目名。
- 用户明确说切换项目：确认新项目名和项目类型，更新 `CURRENT_PROJECT.md`，并把切换记录写入 `CONTEXT.md`。
- 用户明确说不进入项目：本次按单次任务处理，不修改 `CURRENT_PROJECT.md`，产物不强制归当前项目。
- 用户只是要一句提示词、一次改图指令、一次单图生成，且没有项目制表达：按单次任务处理；不要为了“完整”强行建项目。

项目制默认目录：

```text
project\<项目名>\
  原图\
  参考\
  输出\
    提示词\
    确认图\      # 图片项目
    确认片\      # 视频项目
    成品\        # 图片项目
    成片\        # 视频项目
    运行记录\
    临时\
```

混合项目同时允许 `确认图 / 确认片 / 成品 / 成片`。

## 总路由

```text
电商图片 / 主图 / 详情页 / 白底 / 产品改图 / KV / 场景图 / 图片批量
  -> ecom-visual-director

图片放大 / 超分 / 高清放大 / 抠图 / 去背景 / RunningHub 后处理
  -> ecom-visual-director 判断归档 -> runninghub-workflow-agent

详情页出图策划 / 视觉设定 / 卖点视觉证据 / 卖点创意方向
  -> ecom-detail-planner

四宫格抽卡 / 单卖点发散 / 2x2 探方向 / 量产全幅候选
  -> grid-card-prompts

详情页批量自动串跑 / 项目制批量出图 / 走 Agent 模式 / 一整套详情页自动跑
  -> ecom-detail-autopilot

抽卡选片后产品细节漂移 / 局部切图修复 / 把手盖子五金品牌区材质偏离产品白底图
  -> product-detail-repair

视频 / TVC / 卖点顺序 / 故事板 / 连续分镜 / 生视频 / 视频批量
  -> tvc-director

不确定是图片还是视频
  -> 先判断最终交付；静态图走 ecom-visual-director，动态片走 tvc-director
```

两个领导技能只负责判断、项目入口、调度和检查，不替代底层技能写完整提示词或提交生成。

## 13 个 Agent / Skill 的职责

### ecom-visual-director

- 作用：电商视觉总监，负责图片主线的判断、项目入口、输出归档和底层技能调度。
- 触发：主图、详情页、白底、产品改图、KV、场景图、图片批量、图片放大、实际生图/改图前判断。
- 交接：改图给 `image-prompt-optimizer`；视觉增强给 `super-image-prompt`；明确生成给 `image-batch-agent`；RunningHub 放大 / 抠图给 `runninghub-workflow-agent`。
- 禁止：不直接写完整生图执行、不直接调用图片接口、不把现有图改图改写成泛用文生图。

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

- 作用：详情页批量出图的 Agent 模式编排器，把 planner / grid-card-prompts / image-batch-agent / product-detail-repair 串成自动流水线，按文件合同读写 run-state / selection / 校准沉淀，配合本地桥服务和 BatchRefiner Agent 模式。是唯一会主动驱动生成的 skill。
- 触发：详情页批量自动串跑、项目制批量出图、走 Agent 模式、一整套详情页自动跑。
- 交接：策略给 `ecom-detail-planner`；抽卡词给 `grid-card-prompts`；生成给 `image-batch-agent`；修复/QA 给 `product-detail-repair`；顶层路由/项目入口归 `ecom-visual-director`。
- 禁止：不自己写最终提示词或手搓接口参数；三个闸（方向/选片/终审）必须真停等 selection；校准只回写产品级；pilot 只跑一个卖点，并发只在校准之后。
- 边界：只在用户明确要批量/自动串跑/Agent 模式时进入；否则走原有逐步链路。

### product-detail-repair

- 作用：抽卡选片后的质量门，诊断漂移的产品细节，给局部切图指引，再用 banana2 加产品白底图作参考写局部修复提示词。
- 触发：抽卡选片后产品细节漂移、把手/盖子/五金/品牌区/材质偏离产品白底图、局部切图修复。
- 交接：明确生图给 `image-batch-agent`（明确 banana2 + 参考图）；缺产品白底图回到 `ecom-detail-planner` 视觉设定。
- 禁止：不调用生图接口、不做自动切图（本版手动切图）、不整图重生、不修没偏差的结构。

### image-prompt-optimizer

- 作用：改图提示词优化，负责目标图、比例、参考图角色、产品结构保护和 Banana Pro 中文改图指令。
- 触发：改图、白底精修、多参考图融合、保持角度、保护结构、品牌区修正。
- 交接：如用户明确要实际生成，把确认后的改图指令交给 `image-batch-agent`。
- 禁止：不调用生成接口；不静默改变把手、盖子、五金、品牌区、轮廓或 SKU 比例。

### super-image-prompt

- 作用：高级视觉 brief，把模糊想法变成场景、材质、光线、关系和画面语言。
- 触发：KV 概念、场景母体、材质光线增强、真实质感、产品氛围、模糊视觉方向。
- 交接：如果最终是改图指令，回到 `image-prompt-optimizer`；如果用户明确生成，交给 `image-batch-agent`。
- 禁止：不替用户自动生图；不堆抽象形容词，要写可见画面。

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

### tvc-director

- 作用：TVC 总导演，负责视频旁路的判断、项目入口、输出归档和底层技能调度。
- 触发：电商视频、TVC、卖点顺序、故事板、连续分镜、逐镜视频提示词、关键帧、生视频、视频批量。
- 交接：转化逻辑给 `ecom-video-conversion`；故事板和分镜给 `video-storyboard-prompts`；明确生视频给 `video-batch-agent`；关键帧生图可转图片线。
- 禁止：不直接提交视频生成；没有明确生成、提交、跑任务、出确认片或批量生视频时，不调用 `video-batch-agent`。

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

## 输出归档

项目制开启后，所有产物必须落当前项目目录：

- 文本资产：`输出\提示词`
- 图片确认：`输出\确认图`
- 图片成品：`输出\成品`
- 视频确认：`输出\确认片`
- 视频成片：`输出\成片`
- 执行记录：`输出\运行记录`
- 裁切、下载、压缩、联系表、抽帧、转码：`输出\临时`

Eagle、本地素材库、飞书画板等外部素材默认只读引用；除非用户明确要求，不复制、不移动、不写回原素材。

## 最小提问规则

只问会卡住下一步的问题：

- 项目入口缺失：问项目名和项目类型。
- 改图缺目标图：问哪张是目标图。
- 生成缺模型或完整提示词：问模型或先补提示词。
- 视频缺时长 / 比例 / 主卖点且会影响镜头结构：只问缺的关键项。

其余能从当前项目、素材记录或用户语境判断的，不重复问。
