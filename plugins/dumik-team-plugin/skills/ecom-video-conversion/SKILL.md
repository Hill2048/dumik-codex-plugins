---
name: ecom-video-conversion
version: 0.1.0
description: "在写分镜前规划中文电商视频的转化逻辑。适用于用户要做商品短视频、投放视频、种草视频、详情页视频或电商脚本，需要先明确人群、痛点、卖点顺序、证据链和转化节奏时使用。"
---

# 电商视频转化策划

Solve message order before camera language. Decide what the viewer must understand, believe, and remember first.

## Priority

Do first:

- product definition
- module order
- selling-point priority
- trust-building path

Do later:

- storyboard
- camera movement
- line-level copy
- music rhythm

## Placement

First determine where the video lives:

- Main image or list-page video
- Detail-page video
- Paid ad video
- Content or social video

This changes compression level and how much explanation is allowed.

## Conversion Drivers

Choose the dominant driver:

- Cognition
- Trust
- Usage Pleasure
- Differentiation
- Brand Closure

## Ordering Questions

Answer these before proposing structure:

1. What must the viewer understand first?
2. What will they doubt next?
3. What visual evidence removes that doubt?
4. Which usage benefit deserves memory priority?
5. What brand memory should close the video?

## Compression Rules

- One module should usually do one job.
- Prefer fewer stronger modules over many weak ones.
- Delete or weaken selling points that do not change belief or action.

## Dreamina Video Default

When this plan is intended for Dreamina（即梦）video generation, assume the downstream model is `seedance2.0` by default.
Plan the conversion rhythm, visual evidence, and shot complexity for `seedance2.0` quality rather than the fast preview path.
Use `seedance2.0fast` only when the user explicitly asks for speed, fast draft, quick preview, or lower waiting time.
If the final command or workflow does not support model selection, keep the plan model-neutral and do not invent a model parameter.

## Output

Return:

1. Core conversion obstacle
2. Recommended conversion chain
3. Module order table
4. Each module's job
5. What to delete, postpone, or weaken
6. A note on storyboard direction if the user wants to continue

## Handoff

If the user later asks for storyboards, keep the conversion order fixed and translate each module into shots rather than redesigning the structure.

## Reference

Read [references/original.md](references/original.md) for the full source text.
