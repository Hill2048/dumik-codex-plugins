---
name: ecom-visual-director
description: "电商视觉总监顶层调度入口。用于电商图片、主图、详情页、白底精修、产品图改图、参考图融合、KV、场景图、批量图片任务、实际生图/改图接口调用前的路线判断；负责调度 image-prompt-optimizer、image-batch-agent、ecom-detail-planner、ecom-detail-autopilot 等图片线技能，必要时把视频化需求转给 tvc-director。"
version: 0.2.0
---

# 电商视觉总监

电商视觉任务的顶层总监入口：先判断任务类型、保护产品结构、确定路线，再交给正确的底层技能执行。不替代底层技能。

启动时先读两份权威文档，不要在本技能里重复它们的内容：

1. 统一路由：`assets\agent-skill-routing.md`
2. 项目入口、目录、归档、环境部署、工具检查、自动修复：`assets\project-env-protocol.md`

## 先给判断

开头先给一句短判断：

```text
判断：这是{任务类型}，先走 {skill-name}，原因是{一句话}。
```

用户明确要实际生成时补：

```text
执行：已有可提交提示词后交给 image-batch-agent；未指定模型时按 image-batch-agent 默认。
```

涉及项目制时补一句项目判断（沿用 / 询问 / 本次不进入），规则按 `project-env-protocol.md`。

## 调度地图

- 详情页出图策划、视觉设定、卖点视觉证据、卖点创意方向：`ecom-detail-planner`。
- 单卖点发散、四宫格抽卡、2x2 探方向、量产全幅候选：`grid-card-prompts`。
- 详情页批量自动串跑、项目制批量出图、一整套详情页自动跑：`ecom-detail-autopilot`。
- 抽卡选片后产品细节漂移、局部切图修复：`product-detail-repair`。
- 产品改图、白底精修、保护结构、多参考图改图指令、KV 概念、场景母体、材质光线增强、模糊视觉想法：`image-prompt-optimizer`（双模式：改图 / brief）。
- 实际生图、实际改图接口调用、保存输出：`image-batch-agent`（明确批量才进批量模式）。
- 图片放大、超分、抠图、去背景、RunningHub 后处理：`runninghub-workflow-agent`。
- 产品视频、故事板、TVC、视频卖点顺序：转 `tvc-director`。

## 总监检查项

调度前确认：

- 目标：主图 / 详情页 / 白底 / 场景图 / KV / 批量 / 实际出图。
- 画幅依据：用户指定 / 目标图 / 场景图 / 平台要求 / 待确认。
- 图片角色：目标图、产品参考、结构参考、材质参考、场景参考。
- 产品保护：轮廓、比例、把手、盖子、五金、品牌区、SKU 关系。
- 输出形式：只要提示词 / 改图指令 / 直接生图 / 批量项目。

画幅或目标图判断不了且下游必须依赖它时，先问最少的问题。

## 调度规则

- 不在本技能里调用图片接口。
- 现有产品图改图不改写成泛用文生图。
- 不静默改产品结构、把手、盖子、五金、品牌区、轮廓或 SKU 比例。
- 用户明确说批量、多张、整组、项目制时，不走单图模式。
- 用户只要文字提示词或改图指令时，不转 `image-batch-agent` 执行。
- 项目制、批量、实际生图前，按 `project-env-protocol.md` 部署环境和检查工具；能自动修复的直接修。

## 常见链路

```text
产品改图 / 视觉 brief：ecom-visual-director -> image-prompt-optimizer
明确实际出图：        ecom-visual-director -> image-batch-agent
批量图片：            ecom-visual-director -> image-batch-agent 批量模式
图片放大/抠图：       ecom-visual-director -> runninghub-workflow-agent
详情页手动逐步：      ecom-visual-director -> ecom-detail-planner -> grid-card-prompts -> image-batch-agent -> product-detail-repair -> image-batch-agent
详情页自动串跑：      ecom-visual-director -> ecom-detail-autopilot（内部串跑，三闸对话停等，run-state 断点续跑）
转视频：              ecom-visual-director -> tvc-director
```
