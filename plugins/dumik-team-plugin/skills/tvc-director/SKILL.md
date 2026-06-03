---
name: tvc-director
description: "TVC 总导演顶层调度入口。用于电商视频、TVC、产品广告片、卖点顺序、视频脚本、故事板、Image2 产品故事板、连续分镜、关键帧、逐镜生视频提示词、批量生视频和 Dreamina 提交前的路线判断；负责调度 ecom-video-conversion、video-storyboard-prompts、video-batch-agent，必要时调用 ecom-visual-director / image-batch-agent 处理故事板生图。"
version: 0.1.0
---

# TVC 总导演

Use this skill as the top-level director for video and TVC work. It decides whether the job is strategy, storyboard, per-shot prompting, storyboard image generation, or actual video execution.

Do not replace downstream skills. Pick the right one, then use its rules.

## Output First

Start with a short judgment:

```text
判断：这是{视频任务类型}，先走 {skill-name}，原因是{一句话}。
```

If the task spans multiple phases, state the chain:

```text
链路：ecom-video-conversion -> video-storyboard-prompts -> video-batch-agent
```

## Route Map

- Selling-point order, conversion logic, 30-60 second ecommerce video structure, proof sequence, opening hook: use `ecom-video-conversion`.
- Product storyboard, Image2 identity board, Image2 product storyboard prompt, continuous storyboard, keyframes, per-shot video prompt: use `video-storyboard-prompts`.
- Project-based batch video generation, confirmation clip, Dreamina CLI submission, many video prompts to execute: use `video-batch-agent`.
- Storyboard image generation or keyframe image generation after prompts are confirmed: use `image-batch-agent`; if the visual prompt still needs product edit discipline, hand off through `ecom-visual-director`.
- Static ecommerce visual work without video intent: hand off to `ecom-visual-director`.

## Director Checks

Before delegating, identify:

- 视频目标：种草 / 转化 / 质感片 / 功能证明 / TVC / 详情页视频 / 批量素材。
- 主体：产品 / 人物 / 场景 / 产品 + 人物 / 产品 + 场景。
- 阶段：策略顺序 / 故事板 / 逐镜提示词 / 关键帧生图 / 真实生视频。
- 比例：9:16 / 16:9 / 1:1 / 待确认。
- 时长：总时长、镜头数、单镜时长。
- 稳定锚点：产品结构、角色身份、空间、光线、色调、前后镜头衔接。
- 执行边界：只写提示词，还是要生成图片/视频。

If the user asks for a TVC but gives no product, audience, selling point, or duration, ask only the missing item that blocks the next step.

## Delegation Rules

- Do not submit video generation from this skill.
- Do not skip conversion logic when the request is about selling order or why the video should work.
- Do not split product storyboard and continuous storyboard into separate old routes; both go through `video-storyboard-prompts`.
- Do not use `video-batch-agent` until the user clearly asks to generate, submit, run, produce a confirmation clip, or batch-create videos.
- Do not call image generation just because a storyboard prompt exists; only do it when the user asks for actual storyboard images or keyframes.

## Common Chains

Video strategy only:

```text
tvc-director -> ecom-video-conversion
```

Storyboard and per-shot prompts:

```text
tvc-director -> video-storyboard-prompts
```

Full ecommerce TVC planning:

```text
tvc-director -> ecom-video-conversion -> video-storyboard-prompts
```

Storyboard images after prompts are approved:

```text
tvc-director -> video-storyboard-prompts -> image-batch-agent
```

Real batch video production:

```text
tvc-director -> video-batch-agent
```
