---
name: sequential-storyboard-prompts
version: 0.1.0
description: "从一个视觉概念写出中文连续分镜和视频 AI 序列提示词。适用于用户要求分镜、四格拆解、关键帧提示词、连续镜头描述或需要跨帧保持视觉一致的视频生成顺序提示词。"
---

# 连续分镜提示词

Turn one visual idea into a continuous, usable sequence of shots. Keep continuity stronger than novelty.

## Default Flow

1. Lock stable anchors:
   - product identity
   - form
   - material
   - light
   - color tone
   - space logic
2. Split into:
   - what must stay stable
   - what may change
3. Output a short setup:
   - prompt purpose
   - product description
   - scene setup
4. Output storyboard blocks.
5. End with one linear video-AI sequence description.

## Per-Frame Requirements

Each frame must include:

- subject
- distance, viewpoint, or viewing position
- camera movement or hold state
- environment, light, and atmosphere
- one visible change compared with the previous frame

## Continuity Rules

- Treat the sequence as stages of one continuous shot or one continuous world.
- Do not output four unrelated posters.
- Prefer positive continuity language such as "keep the same warm side light" instead of long negative lists.

## Motion Rules

Use restrained motion. One main movement plus one supporting change is usually enough.

## Dreamina Video Default

When writing prompts for Dreamina（即梦）video generation, target `seedance2.0` by default.
Write the storyboard and final video-AI sequence with `seedance2.0` continuity and quality in mind: clear subject anchors, controlled camera motion, and stable materials across frames.
Use `seedance2.0fast` only when the user explicitly asks for speed, fast draft, quick preview, or lower waiting time.
If the target video tool cannot choose a model, do not mention a forced model parameter; keep the prompt usable for that tool.

Common verbs:

- slide in
- push closer
- skim across
- drift sideways
- lift slightly
- press toward the focal zone
- decelerate into a stop
- hover steadily

## Output Modes

- Default: two separate plain-text code blocks, one for storyboard blocks and one for the video-AI sequence description.
- If the user explicitly asks for JSON, return valid JSON only.

## Quality Bar

- Product identity, material, space, and light stay stable.
- Adjacent frames are clearly different without breaking continuity.
- Continuous does not mean repetitive.

## Reference

Read [references/original.md](references/original.md) for the full template and examples.
