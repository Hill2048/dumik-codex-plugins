---
name: ecom-visual-director
description: "电商视觉总监顶层调度入口。用于电商图片、主图、详情页、白底精修、产品图改图、参考图融合、KV、场景图、批量图片任务、实际生图/改图接口调用前的路线判断；负责调度 image-prompt-optimizer、super-image-prompt、image-batch-agent，必要时把视频化需求转给 tvc-director / video-storyboard-prompts。"
version: 0.1.1
---

# 电商视觉总监

这个技能是电商视觉任务的顶层总监入口：先判断任务类型、保护产品结构、确定路线，再交给正确的 DUMIK 底层技能执行。

不要替代底层技能。先选对路线，再按对应底层技能的规则执行。

## 先给判断

开头先给一句短判断：

```text
判断：这是{任务类型}，先走 {skill-name}，原因是{一句话}。
```

如果用户明确要实际生成，再补一句：

```text
执行：已有可提交提示词后交给 image-batch-agent；未指定模型时按 image-batch-agent 默认。
```

## 调度地图

- 产品改图、精修、白底图、保持角度、保护结构、保护品牌区、多参考图改图指令：使用 `image-prompt-optimizer`。
- 模糊电商视觉想法、KV 概念、场景视觉、材质光线增强、高级产品氛围：使用 `super-image-prompt`；如果最终交付是改图指令，再回到 `image-prompt-optimizer` 格式。
- 实际生图、实际改图接口调用、保存输出、单图执行：使用 `image-batch-agent` 单图模式。
- 批量生图、批量改图、项目制批量、多张图片、先出确认图再跑全量：使用 `image-batch-agent` 批量模式。
- 产品视频、故事板、视频镜头提示词、TVC、视频内容顺序、视频卖点顺序：转给 `tvc-director`；如果只需要转化逻辑，使用 `ecom-video-conversion`；如果需要镜头或故事板，使用 `video-storyboard-prompts`。

## 总监检查项

调度前先确认：

- 目标：主图 / 详情页 / 白底 / 场景图 / KV / 批量 / 实际出图。
- 画幅依据：用户指定 / 目标图 / 背景图 / 场景图 / 平台要求 / 待确认。
- 图片角色：目标图、产品参考、结构参考、材质参考、场景参考、动作参考。
- 产品保护：轮廓、比例、把手、盖子、五金、品牌区、SKU 关系。
- 输出形式：只要提示词 / 改图指令 / 直接生图 / 批量项目。

如果画幅或目标图无法从现有上下文判断，而底层任务必须依赖它，就先问最少的问题，再写最终改图指令。

## 调度规则

- 不在本技能里调用图片接口。
- 任务是现有产品图改图时，不要改写成泛用文生图提示词。
- 不静默改变产品结构、把手、盖子、五金、品牌区、轮廓或 SKU 比例。
- 用户明确说批量、多张、整组、项目制时，不要走单图模式。
- 用户只要文字提示词、brief 或改图指令时，不要转给 `image-batch-agent` 执行。

## 常见链路

产品改图：

```text
ecom-visual-director -> image-prompt-optimizer
```

高级产品场景：

```text
ecom-visual-director -> super-image-prompt -> image-prompt-optimizer
```

已有提示词并明确实际出图：

```text
ecom-visual-director -> image-batch-agent
```

批量电商图片：

```text
ecom-visual-director -> image-batch-agent 批量模式
```

电商视觉转产品视频：

```text
ecom-visual-director -> tvc-director -> ecom-video-conversion / video-storyboard-prompts / video-batch-agent
```
