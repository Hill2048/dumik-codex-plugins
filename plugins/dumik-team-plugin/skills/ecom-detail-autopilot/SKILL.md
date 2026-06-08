---
name: ecom-detail-autopilot
version: 0.1.1
description: "详情页批量出图的自动编排器，完全在 Codex 内跑。把 ecom-detail-planner / grid-card-prompts / image-batch-agent / product-detail-repair 串成一条流水线：先用 1 个卖点试跑、停下让用户在对话里确认方向、沉淀产品级校准回写视觉设定、再批量并发抽卡、用户选片、自检 QA、批量局部修复、终审交付。三个闸（方向 / 选片 / 终审）在对话里停等用户，Agent 直接把图展示出来。校准沉淀写文件回写视觉设定。前端（BatchRefiner）和本地桥是可选增强，默认不依赖。只有用户明确要求项目制自动串跑 / 批量出图时才进入。"
---

# 详情页批量出图编排器

这是详情页流水线唯一会**主动驱动生成**的 skill，是其他 skill「默认只出文字」规则的例外。只有用户明确要批量、项目制自动串跑时才进入；否则仍走手动逐步链路。

默认**完全在 Codex 内跑**：Agent 自己生成、自己看图自检，到闸口直接把图展示给用户，用户在对话里确认方向、选片、终审，Agent 据此继续。不需要前端，不需要桥。

接前端是**可选增强**：以后接 BatchRefiner + 本地桥时，把每步状态写 `bridge/run-state.json`、读 `bridge/selection.json`（字段见 `assets/批量协作-文件合同.md`）。本版默认不写这些文件，下面标「可选·接前端」的才涉及。

## 触发

- 用户明确说：批量出详情页、整套详情页自动跑、项目制批量抽卡。
- 已有视觉设定或能现做，且卖点清单 ≥ 1。

不触发：用户只要一句提示词、一次改图、单卖点手动探方向 —— 那走原有逐步链路。

## 前置

进入前确认：
- 当前项目（`CURRENT_PROJECT.md`）和项目目录已就位。
- 图片接口可用（按 `image-batch-agent` 的 API 缓存规则）。

## 编排顺序

每一步在对话里用一句话简报「现在第几步、在干嘛、第几张」，让用户跟得上。

### 1. planning — 策略

调 `ecom-detail-planner`：固化/复用视觉设定（含视觉调性一句话），吃卖点清单，排详情页结构，给每个卖点的视觉证据策略 + 3-4 个创意方向。

### 2. pilot — 试跑一个卖点

选**第一个卖点**，调 `grid-card-prompts` 段一（从 prompt-pack family 选方向）写 2x2 探方向提示词，调 `image-batch-agent` 出 pilot 图（`count: 1`，落 `输出/确认图/`）。

只跑一个卖点。不要一上来就并发全部——否则方向错了，十几张一起错。

### 3. 闸① 方向确认（停，对话里等用户）

把 pilot 图**直接展示给用户**，问两件事：选哪个方向？哪里崩了、要怎么改？

- 用户给：选中方向 + 哪里要锁（把手/反射/品牌区/木纹…）。
- 不满意：用用户指出的问题调词，回第 2 步重跑 pilot。
- 满意：进第 4 步。

可选·接前端：写 `stage=await_direction`、`openGate=direction`，等 `selection.json` 的 `directionDecision`。

### 4. calibrating — 沉淀校准 → 回写视觉设定（关键）

把用户在闸①指出的问题 + pilot 经验提炼成**产品级**校准，写 `输出/校准沉淀.json`（`scope=product`：`lockedCorrections`、`confirmedBaseline`、`winningPromptPattern`）。
据此回写视觉设定的校准层（交 `ecom-detail-planner`），再用**校准后的视觉设定**给**所有卖点**重新生成抽卡提示词（交 `grid-card-prompts`）。

只传播产品级（身份锁、材质光学、画幅光线、模型参数、参考图用法）。卖点级构图不进校准。

这一步是「一个卖点对、批量都对」的命脉，不能省。即使纯 Codex 内跑，这个文件也要写——它是回写视觉设定的依据，跟前端无关。

### 5. batch_draw — 批量并发抽卡

对所有卖点的选中方向，按 `grid-card-prompts` 段二展开多行独立全幅候选（每行 `count:1`、不同 id/output_name、带 `selected_direction_id` 和 `route_id`）。交 `image-batch-agent` 批量并发生成，落 `输出/确认图/`。

每张生成后，Agent **自己看图自检**，标 `pass`/`drift`/`reject`；明显崩的（reject）先自己淘汰，不拿去烦用户。

### 6. 闸② 选片（停，对话里等用户全部选完）

把存活候选**按卖点分组展示给用户**，让用户逐卖点选片，每张标：keep（留）/ repair（要修）/ reroll（重抽）。要求所有卖点都选完才继续。

- reroll：回第 5 步对该卖点重抽。
- 全部 keep/repair 才进第 7 步。

可选·接前端：写 `stage=await_selection`、`openGate=selection`，等 `selection.json` 的 `imageSelections`。

### 7. qa + repair — 诊断与批量修复

对 repair 的图（和自检标 drift 的），调 `product-detail-repair`：先分诊（可接受/局部修/重抽），对 blocked 的对照视觉设定产品白底图诊断偏差区域。
批量修复走 `product-detail-repair/scripts/repair_batch.py`：汇总修复清单 → `crop-batch` 批量切+出修复任务 → `image-batch-agent` banana2 批量重绘 → `paste-batch` 一图多区域链式贴回。全程无人值守。
修完复核，限两轮；两轮不过判 reroll 回抽卡。

选完所有图才统一批量修，不要边选边修。

### 8. 闸③ 终审（停，对话里等用户）

把修完的成品候选展示给用户终审：approved 进 `输出/成品`；redo 回对应步骤。

可选·接前端：写 `stage=await_final`、`openGate=final`，等 `selection.json` 的 `finalReview`。

### 9. done — 交付

approved 的图归 `输出/成品/`，写 `handoff.md` 记下每张来源（卖点/方向/route）和下一步归属。

注意：本流水线交付的是**确认图/成品图**，不含文字、参数、logo、版式叠加（那是后续确定性叠加层，不在本 skill）。

## 硬规则

- 三个闸（方向 / 选片 / 终审）必须真停，在对话里等用户回话才继续，不得擅自往下。
- 校准只回写产品级；卖点级不污染视觉设定。`校准沉淀.json` 必写（回写视觉设定的依据）。
- pilot 只跑一个卖点；并发只在校准之后。
- 自己不写最终提示词、不手搓接口参数：词交 `grid-card-prompts`/`product-detail-repair`，生成交 `image-batch-agent`。
- 默认不依赖前端/桥；标「可选·接前端」的文件只有接了前端才写。

## 交接

- 策略缺失 → `ecom-detail-planner`
- 抽卡提示词 → `grid-card-prompts`
- 实际生成 / 批量 → `image-batch-agent`
- 细节修复 / QA → `product-detail-repair`
- 顶层路由 / 项目入口 → `ecom-visual-director`
