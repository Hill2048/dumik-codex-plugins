---
name: video-batch-agent
description: "项目制批量生视频。适用于先确认需求和输出路径，创建中文项目文件夹，让用户放入首帧/参考素材，再先出 1 条确认片，确认后用即梦 CLI 批量提交视频任务。默认走 Dreamina 全能参考 `multimodal2video`，模型为 `seedance2.0fast_vip`。"
version: 0.1.0
---

# 批量视频生成 Agent

Use this skill for project-based batch video generation with Dreamina（即梦） CLI. Workflow is fixed:

1. 确认需求。
2. 创建中文项目文件夹，让用户放素材。
3. 写逐条视频提示词，先出 1 条确认片，用户确认后再批量执行。

Do not skip the confirmation clip. Do not start full batch submission before the user approves the confirmation result.

## Hard Rules

- 开始前必须确认输出路径；不能静默使用默认路径继续。
- 每条视频默认生成 `1` 条，除非用户明确指定其他数量。
- 项目目录内部只创建三个文件夹：`原图`、`参考`、`输出`。
- 创建文件夹后必须暂停，让用户把首帧/分镜图放进 `原图`，参考素材放进 `参考`。
- 默认执行入口是 `dreamina` CLI，提交前先按子命令 help 确认参数。
- 批量执行前必须先出 1 条确认片，用户确认后再继续。
- 不要把单条视频任务写成一组互不相干的镜头合集。
- 默认模型是 `seedance2.0fast_vip`，默认模式是 `multimodal2video`。

## Default Dreamina Settings

- 默认命令：`dreamina multimodal2video`
- 默认模型：`seedance2.0fast_vip`
- 默认分辨率：`720p`
- 默认时长：`5` 秒
- 默认比例：`16:9`、`3:4`、`9:16` 中的一个，用户没指定时按项目场景选
- 默认参考方式：全能参考，支持 `image` / `video` / `audio`

Only switch to `image2video` when the user explicitly wants a single first-frame animation and does not need full mixed-media references.

## Step 1: Confirm The Job

Ask the user for the minimum information needed to start:

- 本次项目名。
- 本次视频目标。
- 输出路径。
- 视频比例：`16:9`、`3:4`、`9:16`。
- 每条视频生成几条，默认 `1`。
- 时长，默认 `5` 秒。
- 是否有参考图 / 参考视频 / 参考音频，以及它们分别控制什么。
- 是否直接使用默认模型 `seedance2.0fast_vip`。

Default output path suggestion:

```text
F:\AI HOME\CODEX\video\outputs\批量视频项目\<项目名-时间戳>\
```

If the user accepts the suggested path, treat it as confirmed.

## Step 2: Create The Project Folder

Use the bundled helper when creating the project folder:

```powershell
python scripts\init_project.py --project-name "<项目名>" --root "F:\AI HOME\CODEX\video\outputs\批量视频项目"
```

Or pass an exact confirmed output path:

```powershell
python scripts\init_project.py --output-path "<已确认输出路径>"
```

The helper creates only:

```text
<项目目录>\
  原图\
  参考\
  输出\
```

After creating the folders, stop and tell the user:

- 把首帧 / 分镜图放进 `原图`。
- 把参考图、参考视频、参考音频放进 `参考`。
- 放好后让你继续。

Do not scan or generate until the user says the files are ready.

## Step 3: Prompt Writing And Confirmation Clip

When the user says the files are ready:

1. Read `原图` and `参考`.
2. Choose the first source image in stable filename sort order as the confirmation sample.
3. If the task is product storyboard or product video, use `product-storyboard-video-prompts`.
4. If the task is general continuous shots, use `sequential-storyboard-prompts`.
5. Generate one strict Chinese video prompt for that one item.
6. Save the prompt row to:

```text
输出\提示词记录.json
```

Use this row shape:

```json
{
  "id": "shot-001",
  "file": "完整首帧路径",
  "task": "本次视频目标",
  "count": 1,
  "output_name": "shot-001",
  "ratio": "3:4",
  "duration": 5,
  "mode": "multimodal2video",
  "model_version": "seedance2.0fast_vip",
  "video_resolution": "720p",
  "reference_images": [],
  "reference_videos": [],
  "reference_audios": [],
  "final_instruction": "按视频提示词规则写出的完整中文生视频提示词"
}
```

Then call the generation script with `count: 1` and output to `输出\确认片`.

```powershell
python scripts\generate_batch_videos.py `
  --results-input "<项目目录>\输出\提示词记录.json" `
  --output-dir "<项目目录>\输出\确认片"
```

Show the confirmation clip path to the user and stop. Wait for approval or revision instructions.

## Step 4: Full Batch After Approval

Only after the user approves the confirmation clip:

1. Write one prompt row per item.
2. Use the confirmed per-item count, defaulting to `1`.
3. Save all rows to `输出\提示词记录.json`.
4. Run the generation script with output dir `输出`.
5. Save run records in `输出\运行记录.json` and `输出\运行记录.md`.

Run pattern:

```powershell
python scripts\generate_batch_videos.py `
  --results-input "<项目目录>\输出\提示词记录.json" `
  --output-dir "<项目目录>\输出"
```

## Prompt Writing Rules

For every video item:

- 先写比例、时长、参考来源，再写动作。
- 明确首帧、主体动作、镜头运动、环境变化、结束画面。
- 默认使用 `multimodal2video`，把参考图 / 参考视频 / 参考音频写成具体角色，不要只说“参考上传素材”。
- 只保留一个主动作和一个主镜头变化，避免一条里塞多个互相打架的动作。
- 保持产品身份、结构、材质、比例和品牌区一致。
- 不要把提示词写成字幕说明或分镜解说。

If multiple references exist, assign each one a specific role:

- 首帧参考
- 产品结构参考
- 镜头 / 构图参考
- 节奏参考
- 声音 / 氛围参考

Do not say only "参考上传素材".

## Generation Input Shape

The generation script accepts either an array or an object with `items`:

```json
{
  "items": [
    {
      "id": "shot-001",
      "file": "F:/path/to/first_frame.png",
      "task": "高压锅开盖展示内胆结构",
      "count": 1,
      "output_name": "shot-001",
      "ratio": "3:4",
      "duration": 5,
      "mode": "multimodal2video",
      "model_version": "seedance2.0fast_vip",
      "video_resolution": "720p",
      "reference_images": ["F:/path/to/ref1.png"],
      "reference_videos": [],
      "reference_audios": [],
      "final_instruction": "完整中文生视频提示词"
    }
  ]
}
```

Read [references/results-input-example.json](references/results-input-example.json) when checking the JSON shape.

## Guardrails

- Do not create extra project subfolders beyond `原图`、`参考`、`输出`.
- Do not begin full batch generation from an unapproved confirmation clip.
- Do not generate prompts without a clear Dreamina execution path.
- Do not silently change ratio, duration, model, or reference roles.
- Before real submit, warn the user that the run will consume Dreamina credits.
- If the CLI returns `AigcComplianceConfirmationRequired`, tell the user to complete that web-side confirmation first, then retry.
