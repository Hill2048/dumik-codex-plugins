---
name: ecom-visual-director
description: "电商视觉总监顶层调度入口。用于电商图片、主图、详情页、白底精修、产品图改图、参考图融合、KV、场景图、批量图片任务、实际生图/改图接口调用前的路线判断；负责调度 image-prompt-optimizer、super-image-prompt、image-batch-agent，必要时把视频化需求转给 tvc-director / video-storyboard-prompts。"
version: 0.1.0
---

# 电商视觉总监

Use this skill as the top-level director for ecommerce visual work. It decides the route, protects the product, and then delegates to the right DUMIK skill.

Do not replace downstream skills. Pick the right one, then use its rules.

## Output First

Start with a short judgment:

```text
判断：这是{任务类型}，先走 {skill-name}，原因是{一句话}。
```

If the user wants actual generation, add:

```text
执行：已有可提交提示词后交给 image-batch-agent；未指定模型时按 image-batch-agent 默认。
```

## Route Map

- Product edit, retouch, white-background refinement, angle preservation, structure protection, brand zone protection, multi-reference edit instruction: use `image-prompt-optimizer`.
- Vague ecommerce visual idea, KV concept, scene visual, material/light/style strengthening, premium product atmosphere: use `super-image-prompt`, then return to `image-prompt-optimizer` if the final deliverable is an edit instruction.
- Actual image generation, image editing API call, saving outputs, single image execution: use `image-batch-agent` single mode.
- Batch image generation/editing, project-based batch, many images, confirmation image before full run: use `image-batch-agent` batch mode.
- Product video, storyboard, video shot prompt, TVC, content sequence, selling-point order for video: hand off to `tvc-director`; if the user only needs conversion logic, use `ecom-video-conversion`; if the user needs shots/storyboard, use `video-storyboard-prompts`.

## Director Checks

Before delegating, identify:

- 目标：主图 / 详情页 / 白底 / 场景图 / KV / 批量 / 实际出图。
- 画幅依据：用户指定 / 目标图 / 背景图 / 场景图 / 平台要求 / 待确认。
- 图片角色：目标图、产品参考、结构参考、材质参考、场景参考、动作参考。
- 产品保护：轮廓、比例、把手、盖子、五金、品牌区、SKU 关系。
- 输出形式：只要提示词 / 改图指令 / 直接生图 / 批量项目。

If the ratio or target image is unknowable from available context and the downstream task requires it, ask the minimum question before writing the final edit instruction.

## Delegation Rules

- Do not call image APIs from this skill.
- Do not write a generic text-to-image prompt when the task is editing an existing product image.
- Do not silently change product structure, handle, lid, hardware, brand zone, outline, or SKU proportions.
- Do not route batch work to single mode when the user clearly says batch, many images, whole set, or project-based.
- Do not route text-only prompt requests to `image-batch-agent`.

## Common Chains

Product edit:

```text
ecom-visual-director -> image-prompt-optimizer
```

Premium product scene:

```text
ecom-visual-director -> super-image-prompt -> image-prompt-optimizer
```

Confirmed prompt and actual generation:

```text
ecom-visual-director -> image-batch-agent
```

Batch ecommerce images:

```text
ecom-visual-director -> image-batch-agent batch mode
```

Product video from ecommerce visuals:

```text
ecom-visual-director -> tvc-director -> ecom-video-conversion / video-storyboard-prompts / video-batch-agent
```
