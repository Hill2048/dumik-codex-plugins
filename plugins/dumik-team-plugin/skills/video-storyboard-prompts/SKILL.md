---
name: video-storyboard-prompts
description: "统一视频故事板、产品故事板、连续分镜、关键帧提示词和逐镜生视频提示词。适用于产品视频、电商视频、Image2 产品故事板、通用连续镜头、剧情/场景分镜和需要跨镜头保持一致的视频提示词；默认只输出文字和可执行提示词，不提交图片或视频生成任务。"
version: 1.0.0
---

# 视频故事板与分镜提示词

Use this skill as the single storyboard and shot-prompt entry for video work.

The old split between product storyboard and sequential storyboard is folded into one logic:

- `product` mode: 产品视频、电商视频、SKU、详情页、产品身份板、Image2 产品故事板。
- `sequential` mode: 非产品的连续镜头、剧情、场景、人物动作、通用视频分镜。
- `hybrid` mode: 产品广告片、生活方式短片、产品 + 场景叙事。

默认只输出提示词、分镜、关键帧和逐镜视频提示词。不要调用生图、生视频或 CLI。只有用户明确说“生成 / 出图 / 出片 / 提交 / 跑任务 / 调用接口”时，才交给 `image-batch-agent` 或 `video-batch-agent` 执行。

## When To Use

Use this skill when the user asks for any of these:

- 产品故事板、Image2 故事板、产品身份板、产品视频分镜。
- 分镜、连续镜头、关键帧、镜头语言、视频 AI 序列提示词。
- 每个镜头的生视频提示词、首帧 / 尾帧提示词、故事板生图提示词。
- 产品广告片、详情页视频、短视频脚本的画面分镜和逐镜提示词。

If the user only asks for selling-point order, content strategy, or a 30-60 second commercial structure, use `ecom-video-conversion` first, then return here to make the visual storyboard and shot prompts.

## Core Principle

Product storyboard and continuous storyboard share the same base logic:

1. Lock stable anchors.
2. Split the video into visible stages.
3. Keep adjacent frames connected.
4. Give every shot one main action and one main camera movement.
5. Define start frame, movement, environmental change, and end frame.
6. Preserve identity across images, storyboards, and video generation.

Product mode adds stronger identity constraints: SKU, silhouette, structure, material, color, proportions, handle/lid/hardware, brand zone, and non-changeable features.

## Mode Selection

Choose the mode silently and state it in the output header.

- `product`: product, 商品, SKU, 主图, 详情页, 材质, 品牌区, 产品故事板, Image2.
- `sequential`: 人物, 场景, 剧情, 氛围片, 连续镜头, 非产品分镜.
- `hybrid`: 产品在生活场景里被使用、产品广告片、产品 + 人物动作、产品 + 场景叙事.

When unsure, use `hybrid` and keep product identity constraints if a real product appears.

## Output Blocks

Default output:

1. 视频模式与目标
2. 稳定锚点表
3. 故事板 / 连续分镜提示词
4. 分镜拆解表
5. 逐镜生视频提示词
6. 返修检查点

Only output the blocks the user asks for if the request is narrow.

## Stable Anchors

Always establish anchors before writing frames.

```text
视频目标：
模式：product / sequential / hybrid
主体：
主体身份锚点：
外观结构 / 角色特征：
材质颜色 / 服装道具：
场景与空间逻辑：
光线与色调：
运动节奏：
整体比例：16:9 / 9:16
单格分镜比例：默认 3:4
分镜数量：
不能改变的特征：
禁止出现：
```

Product extension:

```text
产品名称：
品类：
核心卖点：最多 3 个，按画面优先级排序
关键部件：
品牌区 / 标识区：
可动状态：
使用场景：
产品身份参考：
```

## Image2 Product Identity Board

Only use this block when the work includes a product whose identity must stay stable.

Purpose: lock the product identity before storyboard and video generation.

```text
创建一张艺术性的 16:9 产品身份板。

主体：{产品名称}
外观结构：{外观结构}
材质颜色：{材质颜色}

背景为纯白色或柔和米白色；无环境、无道具、无水印。

创建电影感、高端、艺术书式的产品身份板，不要做机械参数表。
布局不对称、优雅、有大片留白；避免网格、蓝图、目录式排版和重复视角。

放置一个大型产品英雄主视角作为视觉锚点。
围绕它排列辅助研究：正面、侧面、俯视、关键结构、材质细节、开合状态、使用状态。

所有视角保持严格一致：
相同轮廓、相同比例、相同材质、相同颜色、相同关键结构。
不要改变：{不能改变的产品特征}

添加简约产品 ID 信息块，仅使用：名称、品类、核心卖点、视觉标志。
风格：简约、电影感、高端、干净、适用于后续图像和视频制作。
```

## Storyboard Image Prompt

This prompt is for image generation. Keep API parameters outside `final_instruction`.

Write in the image prompt:

- Canvas / layout, such as `12 格视频故事板，3 列 × 4 行`.
- Reference roles.
- Visual language.
- Frame-by-frame visible action nodes.
- Minimal risk control.

Do not write in the image prompt:

- File paths, upload steps, commands, output folders, model names, API keys.
- `输出规格`、`原生生成`、`尺寸 2160x3840`、`4K` 等 execution parameters.
- Long execution notes or marketing copy that should be in a report, subtitle, or JSON.

Storyboard ratio rules:

- `16:9`: horizontal storyboard for website videos, landscape ads, product films.
- `9:16`: vertical storyboard for ecommerce, short-video platforms, mobile.
- `3:4`: default single-panel frame ratio; not the default whole-board ratio.
- Product ecommerce default: whole board `9:16`, panels composed around `3:4`.

Professional annotations are allowed if useful:

- Small frame numbers.
- Thin red motion arrows.
- Restrained blue dashed composition boxes.
- White bold timing numbers / role IDs.

Avoid cheap sticker arrows, glowing trails, heavy HUD, blueprint graphics, marketing text, watermarks, or garbled text.

Template:

```text
{N} 格{产品/场景/连续镜头}故事板，{列数} 列 × {行数} 行。

参考图角色：@MAIN_REF 锁定主体身份；@SCENE_REF 控制场景和光线；@ACTION_REF 控制动作；@MOTION_REF 只参考镜头路径和剪辑节奏。

画面表现：{一句话说明本段视频目的和可见证明}。保持主体、光线、空间逻辑连续。

连续动作：
01 {起点画面和动作节点}；
02 {与 01 相连的变化}；
03 {动作推进}；
...
{N} {结尾定格，方便接下一镜}。

保留克制分镜序号，可加少量专业运动箭头和构图框。不要画营销文字、水印或乱码。
```

## Previous Storyboard Continuity

If a storyboard depends on a previous storyboard, the previous selected storyboard image must be a real reference.

- Reference name: `@PREV_STORYBOARD_REF`.
- It controls only the first frame's subject position, light direction, focus, scene continuation, and ending state from the previous board.
- Do not promise "继承上一张" unless the previous storyboard image can be passed as a reference.
- If the execution tool cannot pass the previous image, say continuity will be weaker and rewrite as text-only continuity.

Short prompt example:

```text
参考图角色：@PREV_STORYBOARD_REF 承接上一张结尾的主体位置、光线和焦点；@PRODUCT_REF 锁定产品结构；@ACTION_REF 控制手部动作。

01 依据 @PREV_STORYBOARD_REF 继承上一张第 12 格的主体位置，手部从画外靠近。
```

## Sequential Frame Rules

Each frame or shot must include:

- Subject.
- Distance / viewpoint / camera position.
- Camera movement or hold state.
- Environment, light, and atmosphere.
- One visible change compared with the previous frame.

Continuity rules:

- Treat the sequence as one continuous world.
- Do not output unrelated posters.
- Keep product identity, character identity, material, space, light, and color stable.
- Adjacent frames must be different without breaking continuity.
- Continuous does not mean repetitive.

Motion rules:

- One main movement plus one supporting change.
- Prefer restrained motion: push closer, drift sideways, slide in, skim across, lift slightly, decelerate into a stop, hover steadily.
- Avoid multiple fighting actions in one frame.

## Shot Breakdown Table

After a storyboard is defined or generated, break each panel into executable video fields.

```text
镜头编号：
画面目标：
起始画面：主体位置、景别、构图
主体动作：只保留一个主动作
镜头运动：只保留一个镜头动作
环境变化：只保留一个辅助变化
结束画面：最后停在哪里
连续性依赖：上一镜 / 下一镜 / 无
生视频注意事项：
```

If a panel is unclear, write `需重画该格`; do not invent missing visual facts.

## Per-Shot Video Prompt

Write one prompt per shot. Do not put multiple unrelated shots into one video prompt.

Product or hybrid template:

```text
使用 @IDENTITY_REF 保持主体身份一致，使用 @STORYBOARD_REF 的第 {镜头编号} 格作为画面来源，生成 {时长} 秒视频片段。

身份锚点：
{主体 / 产品身份锚点}。不要改变 {不能改变的特征}。

起始画面：
从第 {镜头编号} 格的构图开始，主体位置是 {主体位置}，景别是 {景别}。

主体动作：
{主体动作}

镜头运动：
{镜头运动}

环境变化：
{环境变化}

结束画面：
停在 {结束画面}，方便衔接下一镜。

限制：
不新增无关部件，不切换无关场景，不改变主体身份，不出现无关文字或水印。动作克制清晰，一个主动作配一个镜头运动。
```

Sequential template:

```text
基于 @STORYBOARD_REF 的第 {镜头编号} 格生成 {时长} 秒视频片段。
保持同一主体、同一空间逻辑、同一光线方向和色调。
起始画面为 {起始画面}。
主体动作是 {主体动作}。
镜头运动是 {镜头运动}。
环境变化是 {环境变化}。
结束在 {结束画面}，与下一镜保持可衔接。
不要字幕、水印、跳切、身份漂移或无关元素。
```

Dreamina / Seedance default:

- Write for `seedance2.0` stability by default.
- Use `seedance2.0fast` only when the user explicitly asks for speed, quick draft, or lower waiting time.
- If the target tool cannot choose a model, omit forced model parameters and keep the prompt tool-agnostic.

## Linear Sequence Prompt

If the user wants a single continuous video-AI sequence description, write it after the frame blocks.

```text
同一主体在同一空间中连续运动：从 {起点} 开始，镜头 {镜头运动 1}，主体 {动作 1}；随后 {动作 2}，环境 {变化 2}；最后镜头 {结束运动} 停在 {结尾画面}。保持 {身份锚点}、{光线}、{材质/角色特征} 一致，不出现文字、水印或身份漂移。
```

## Revision Diagnosis

- 主体漂移：回到身份锚点 / 产品身份板。
- 动作错误：改对应格或单镜提示词。
- 镜头乱飞：减少镜头动词。
- 画面太杂：收紧环境和道具。
- 产品结构变化：加强不能改变的产品特征。
- 故事板不可接：补起始画面、结束画面、上一镜依赖。
- 标注廉价：只保留专业细箭头、构图框和克制序号。

## Guardrails

- Do not submit generation tasks from this skill.
- Do not produce API keys, file upload commands, or execution paths inside image prompts.
- Do not promise continuity that the references cannot support.
- Do not mix product mode and generic mode blindly; choose `product`, `sequential`, or `hybrid`.
