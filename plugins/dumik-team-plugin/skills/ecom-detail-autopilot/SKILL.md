---
name: ecom-detail-autopilot
version: 0.2.1
description: "详情页批量出图的自动编排器，完全在 Agent（Codex / Hermes）内跑。把 ecom-detail-planner / grid-card-prompts / image-batch-agent / product-detail-repair 串成一条流水线：先用 1 个卖点试跑、停下让用户在对话里确认方向、沉淀产品级校准回写视觉设定、再批量并发抽卡、用户选片、自检 QA、批量局部修复、终审交付。三个闸（方向 / 选片 / 终审）在对话里停等用户，Agent 直接把图展示出来。进度与每张图状态写一份轻量 run-state.json 到运行记录，仅供 Agent 自己断点续跑，不依赖任何前端或桥服务。只有用户明确要求项目制自动串跑 / 批量出图时才进入。"
---

# 详情页批量出图编排器

这是详情页流水线唯一会**主动驱动生成**的 skill，是其他 skill「默认只出文字」规则的例外。只有用户明确要批量、项目制自动串跑时才进入；否则仍走手动逐步链路。

**完全在 Agent 内跑**：Agent 自己生成、自己看图自检，到闸口直接把图展示给用户，用户在对话里确认方向、选片、终审，Agent 据此继续。不接前端、不起桥服务、不开端口。

唯一的落盘是一份**轻量 run-state.json**，写在 `输出/运行记录/`，只给 Agent 自己用：会话中断后凭它断点续跑，不用从头重来。它不是对外合同，没有前端读它。

## 触发

- 用户明确说：批量出详情页、整套详情页自动跑、项目制批量抽卡。
- 已有视觉设定或能现做，且卖点清单 ≥ 1。

不触发：用户只要一句提示词、一次改图、单卖点手动探方向 —— 那走原有逐步链路。

## 前置

进入前确认：
- 当前项目（`CURRENT_PROJECT.md`）和项目目录已就位。
- 图片接口可用（按 `image-batch-agent` 的 API 缓存规则）。

## 状态文件（断点续跑用）

路径：`输出/运行记录/run-state.json`。每推进一步、每出一张图就更新它。**进入流水线前先读它**：

- 不存在或 `stage=done`：从头开始（planning）。
- 存在且停在某个闸（`stage=await_*`）：把对应的图重新展示给用户，接着等用户回话，不要重跑已完成的步骤。
- 存在且停在生成中途（`batch_draw` 等）：只补跑 `status` 不是 `Success` 的任务，已成功的不重抽。

字段保持精简，够 Agent 自己恢复即可：

```json
{
  "schemaVersion": 2,
  "projectName": "纯钛+乌檀木菜板 详情页",
  "updatedAt": 1733500000000,
  "stage": "batch_draw",
  "sellingPointId": "双面生熟分离",
  "message": "批量抽卡：12 张已出 7 张",
  "openGate": null,
  "stats": { "total": 12, "running": 3, "done": 7, "failed": 0 },
  "tasks": [
    {
      "id": "卖点A-方向2-cand-1",
      "title": "双面生熟分离 · 方向2 · 候选1",
      "sellingPointId": "双面生熟分离",
      "directionId": "double-side-direction-2",
      "routeId": "material_macro",
      "status": "Success",
      "promptText": "引用视觉设定的完整中文提示词……",
      "resultImage": "输出/确认图/卖点A-方向2-1.png",
      "qaVerdict": "pass",
      "qaNotes": ""
    }
  ]
}
```

写盘用「先写 `.tmp` 再改名」，避免中断时留半截文件。`stage` 取值：`planning / pilot / await_direction / calibrating / batch_draw / await_selection / qa_repair / await_final / done`。

## 编排顺序

每一步在对话里用一句话简报「现在第几步、在干嘛、第几张」，让用户跟得上。

### 1. planning — 策略

调 `ecom-detail-planner`：固化/复用视觉设定（含视觉调性一句话），吃卖点清单，排详情页结构，给每个卖点的视觉证据策略 + 3-4 个创意方向。

### 2. pilot — 试跑一个卖点

选**第一个卖点**，调 `grid-card-prompts` 段一（从 prompt-pack family 选方向）写 2x2 探方向提示词，调 `image-batch-agent` 出 pilot 图（`count: 1`，落 `输出/确认图/`）。

只跑一个卖点。不要一上来就并发全部——否则方向错了，十几张一起错。

### 3. 闸① 方向确认（停，对话里等用户）

把 pilot 图**直接展示给用户**，问两件事：选哪个方向？哪里崩了、要怎么改？写 `stage=await_direction`、`openGate=direction` 到 run-state，然后停。

- 用户给：选中方向 + 哪里要锁（把手/反射/品牌区/木纹…）。
- 不满意：用用户指出的问题调词，回第 2 步重跑 pilot。
- 满意：进第 4 步。

收到用户回话、确认要继续后，先把 `openGate` 清回 null 再往下，避免续跑时误判还停在闸上。

### 4. calibrating — 沉淀校准 → 回写视觉设定（关键）

把用户在闸①指出的问题 + pilot 经验提炼成**产品级**校准，写 `输出/校准沉淀.json`（`scope=product`：`lockedCorrections`、`confirmedBaseline`、`winningPromptPattern`）。
据此回写视觉设定的校准层（交 `ecom-detail-planner`），再用**校准后的视觉设定**给**所有卖点**重新生成抽卡提示词（交 `grid-card-prompts`）。

只传播产品级（身份锁、材质光学、画幅光线、模型参数、参考图用法）。卖点级构图不进校准。

这一步是「一个卖点对、批量都对」的命脉，不能省。

### 5. batch_draw — 批量并发抽卡

对所有卖点的选中方向，按 `grid-card-prompts` 段二展开多行独立全幅候选（每行 `count:1`、不同 id/output_name、带 `selected_direction_id` 和 `route_id`）。交 `image-batch-agent` 批量并发生成，落 `输出/确认图/`。

每张生成后，Agent **自己看图自检**，标 `pass`/`drift`/`reject`；明显崩的（reject）先自己淘汰，不拿去烦用户。每出一张就更新 run-state 的 `tasks[]` 和 `stats`，方便中途断了接着补。

### 6. 闸② 选片（停，对话里等用户全部选完）

把存活候选**按卖点分组展示给用户**，让用户逐卖点选片，每张标：keep（留）/ repair（要修）/ reroll（重抽）。写 `stage=await_selection`、`openGate=selection`，要求所有卖点都选完才继续。

- reroll：回第 5 步对该卖点重抽。
- 全部 keep/repair 才进第 7 步。
- 选片完成后，按本批每条 route 汇总 keep / repair / reroll，追加写入 `assets/detail-page-prompt-packs/route-feedback.json`（规则见该目录 README），让 route 资产越用越准。

### 7. qa + repair — 诊断与批量修复

对 repair 的图（和自检标 drift 的），调 `product-detail-repair`：先分诊（可接受/局部修/重抽），对 blocked 的对照视觉设定产品白底图诊断偏差区域。
批量修复走 `product-detail-repair/scripts/repair_batch.py`：汇总修复清单 → `crop-batch` 批量切+出修复任务 → `image-batch-agent` banana2 批量重绘 → `paste-batch` 一图多区域链式贴回。全程无人值守。
修完复核，限两轮；两轮不过判 reroll 回抽卡。

选完所有图才统一批量修，不要边选边修。

### 8. 闸③ 终审（停，对话里等用户）

把修完的成品候选展示给用户终审：approved 进 `输出/成品`；redo 回对应步骤。写 `stage=await_final`、`openGate=final`，然后停。

### 9. done — 交付

approved 的图归 `输出/成品/`，写 `handoff.md` 记下每张来源（卖点/方向/route）和下一步归属。run-state 写 `stage=done`。

注意：本流水线交付的是**确认图/成品图**，不含文字、参数、logo、版式叠加（那是后续确定性叠加层，不在本 skill）。

## 硬规则

- 三个闸（方向 / 选片 / 终审）必须真停，在对话里等用户回话才继续，不得擅自往下。
- 闸的"开/关"以 run-state 的 `stage` / `openGate` 为准；继续前先清 `openGate`，避免断点续跑误判。
- 校准只回写产品级；卖点级不污染视觉设定。`校准沉淀.json` 必写（回写视觉设定的依据）。
- pilot 只跑一个卖点；并发只在校准之后。
- 自己不写最终提示词、不手搓接口参数：词交 `grid-card-prompts`/`product-detail-repair`，生成交 `image-batch-agent`。
- run-state 只为 Agent 自己断点续跑，不对外、不接前端、不起服务；不要把它当成给别人读的合同来设计字段。

## 交接

- 策略缺失 → `ecom-detail-planner`
- 抽卡提示词 → `grid-card-prompts`
- 实际生成 / 批量 → `image-batch-agent`
- 细节修复 / QA → `product-detail-repair`
- 顶层路由 / 项目入口 → `ecom-visual-director`
