---
name: sequential-storyboard-prompts
description: Write Chinese sequential storyboard blocks and video-AI sequence prompts from one visual concept. Use when the user asks for storyboards, four-panel breakdowns, keyframe prompts, sequence prompts, continuous shot descriptions, or video AI order prompts that must stay visually consistent across frames.
---

# Sequential Storyboard Prompts

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
