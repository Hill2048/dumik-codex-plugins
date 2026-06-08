---
name: grid-card-prompts
version: 0.1.1
description: "详情页出图的发散层，用两段式四宫格抽卡把一个卖点变成十几个可能。段一用单张 2x2 四宫格低成本探 4 个方向；段二把选中的方向展开成多行独立全幅候选。引用视觉设定，不重写 SKU 身份。默认只输出可复制提示词和批量行，不调用生图接口；实际生成交给 image-batch-agent。"
---

# 四宫格抽卡提示词

把一个卖点变成十几个可能，但别让选片把人淹了。核心是两段式：先用便宜的 2x2 探方向，选中后再量产全幅。

上游策略来自 `ecom-detail-planner`：一个卖点 + 它的视觉证据策略 + 3 到 4 个创意方向 + 视觉设定路径。本 skill 只把这些发散成提示词，不重新设计卖点。

## 执行边界

默认只输出可复制的中文提示词和批量行 JSON，不调用 `image-batch-agent`、图片 API 或任何生图工具。

- 用户明确说生图、出图、抽卡生成、批量生成：把准备好的行交给 `image-batch-agent`。
- 抽卡选片后产品细节偏了：交给 `product-detail-repair`。
- 缺卖点策略或视觉设定：回到 `ecom-detail-planner` 先编排。

## 引用视觉设定，不重写身份

抽卡提示词不重新描述产品 SKU。读 `输出\提示词\视觉设定.md`，用一句话引用产品身份，例如“产品沿用视觉设定：镜面纯钛+乌檀木双面板，结构、把手、品牌区、材质均按视觉设定，不漂移”。把 4 格之间的差异留给创意方向，把产品身份留给视觉设定。这是“做一步等于十几步”的来源。

同时读视觉设定最前面的「视觉调性一句话」，把它当全套图的氛围底色（弱牵引），让调性一致，但不锁构图、不盖过产品身份。

## 从 prompt-pack 选方向，不临场想

不要每次让模型自由发挥 4 个方向。先从 `assets/detail-page-prompt-packs/` 的 family 里选方向，让抽卡成为可复用系统。

- 六个 family：对比证明 / 场景证明 / 材质微距 / 结构指示 / 生活方式 / 广告化。索引见该目录 `README.md`。
- 按卖点匹配 1-2 个 family（看 family 的 `suits_selling_points`）。
- 段一的 3-4 个方向，从选中 family 的 `composition_variables` / `routes` 里取，不再凭空想。
- 按 family 的 `common_drift` 做风险收口；按 `needs_white_bg_ref` 决定要不要带产品白底图参考。
- `fits_stage1_2x2=false` 的 family（如结构指示）不强塞 2x2，直接走全幅。
- 卖点不匹配任何 family 时，回 `ecom-detail-planner` 或新增一个 family JSON，不要把临场想法散落进抽卡。

## 段一：2x2 四宫格抽卡（低成本探方向）

用单张图内 2x2 四格，一次看 4 个创意方向。每格分辨率低，只用来探方向，不当详情页成品。

写法：

- 整图比例和分区分两层写。整图比例按详情页用途或目标图判断（默认竖版 9:16），内部排成 2x2 四宫格；四宫格只控制内部排版，不控制整图比例。
- 四格共享：同一个卖点要证明的判断、同一个视觉设定引用、同一个场景母版。
- 四格差异：只写视角、构图、场景、对比手法的差异，对应上游给的 3 到 4 个创意方向。不要在每格重复产品身份描述。
- 风险收口：只点最可能崩的 1 到 2 点（产品变形、品牌区错、四格风格不统一）。

段一只产出一条提示词（一张 2x2 图）。把它交给用户或 `image-batch-agent` 出 1 张确认图，让用户挑哪个方向。

## 视觉目标闸：没选中方向不进段二

段一 2x2 出图后，必须先记录用户选了哪个方向，才能进段二量产。这是两段式的命脉——没有选中记录，fan-out 会退化成「生几十张靠人记」。

段一出图后写 `输出\运行记录\详情页-<卖点>\selection.json`：

```json
{
  "project": "纯钛+乌檀木菜板",
  "selling_point": "双面生熟分离",
  "stage": "direction_2x2",
  "selected_direction_id": "",
  "selected_image": "",
  "rejected": [
    { "direction_id": "", "reason": "" }
  ],
  "next_action": "expand_full_candidates | repair | final_composite | reroll",
  "notes": ""
}
```

硬闸：`selected_direction_id` 为空时，不允许进入段二全幅候选。段二生成的 `id` / `output_name` 必须带上 `selected_direction_id`，让候选可追溯到来源方向。

## 段二：选中方向展开独立全幅候选（量产）

用户从 2x2 选中方向后，把那个方向展开成多张独立全幅候选。这才是“做一张等于十几张”。

规则按 `image-batch-agent` 的多候选硬规则：

- 不要用 `count` 一行出多张。多候选必须拆成多行，每行 `count: 1`、不同 `id`、不同 `output_name`。
- 每行是一张独立全幅图，不是 2x2 小格，每张都能直接当详情页素材。
- 每行在选中方向内只微调一个变量：机位、距离、光线角度、对比强度、道具位置。产品身份仍引用视觉设定，不重写。
- 整图比例用选中方向的目标比例，不要先出别的比例再拉伸。

输出批量行形状（交给 `image-batch-agent` 的 `提示词记录.json`）：

```json
{
  "items": [
    {
      "id": "卖点A-方向2-cand-1",
      "file": "产品白底图或目标图路径",
      "task": "卖点A 方向2 全幅候选1",
      "count": 1,
      "output_name": "卖点A-方向2-1.png",
      "output_size": "9:16-storyboard 或 2K，按比例依据",
      "final_instruction": "引用视觉设定的完整中文提示词，本候选只微调一个变量"
    }
  ]
}
```

## 选片负担压在便宜的阶段

不要一上来就全幅量产十几张，那样选片会被淹。顺序固定：先 2x2 探 4 方向（便宜）→ 用户选方向 → 再全幅量产候选（每张可用）。多卖点时逐卖点走这条线，不要并行炸出几十张全幅。

## 输出

返回：

1. 视觉设定引用确认：用了哪份、产品身份一句话引用。
2. 段一：1 条 2x2 四宫格抽卡提示词（含整图比例 + 内部分区 + 四格差异）。
3. 等用户选方向后，段二：选中方向的多行全幅候选 JSON。
4. 交接说明：要生图时怎么交给 `image-batch-agent`。

## 交接

- 段一 2x2 和段二全幅候选都只写文字；实际生成交给 `image-batch-agent`。
- 不调用图片接口、不优化已有改图指令（那是 `image-prompt-optimizer` 的职责）。
- 不在四格或多行里偷偷改产品结构、把手、盖子、五金、品牌区、轮廓或 SKU 比例。

## 批量协作合同（Agent 模式）

> 本段是**接前端/桥时**的可选合同。纯 Codex 内跑时，方向确认、选片在对话里完成，不强制写 run-state；但 `selected_direction_id` / `route_id` 这类溯源字段建议照写，便于复盘。

在 `ecom-detail-autopilot` 串跑时，本 skill 产出的抽卡行要能落进 `bridge/run-state.json` 的 `tasks[]`。合同字段见 `assets/批量协作-文件合同.md`。

- 段二每行除现有字段外，带上 `selected_direction_id` 和 `route_id`，对应 run-state 里 `task.directionId` / `task.routeId`，便于复盘「哪条 route 有效」。
- 校准后重生成：Agent 模式下，闸① 通过、视觉设定回写校准层后，本 skill 用**校准后的视觉设定**给所有卖点重写提示词，再进批量。
- `selection.json` 已是本流程的选片合同；`selected_direction_id` 来自 `directionDecision.approvedDirectionId`，不再自己臆测方向。
- 手动逐步链路按原规则即可，本段只在 Agent 模式生效。
