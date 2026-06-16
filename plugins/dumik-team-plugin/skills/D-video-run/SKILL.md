---
name: D-video-run
description: "项目制批量生视频。适用于先确认需求和输出路径，创建中文项目文件夹，让用户放入首帧/参考素材，再先出 1 条确认片，确认后用即梦 CLI 或 Veo 异步接口批量提交视频任务。默认走 Dreamina，全能参考 `multimodal2video`，模型为 `seedance2.0fast_vip`；用户明确选择 Veo 时走 NewAPI Business `/v1/videos`。"
version: 0.1.7
---

# 批量视频生成 Agent

Use this skill for project-based batch video generation with Dreamina（即梦） CLI or Veo async API. Workflow is fixed:

1. 确认需求。
2. 创建中文项目文件夹，让用户放素材。
3. 写逐条视频提示词，先出 1 条确认片，用户确认后再批量执行。

Do not skip the confirmation clip. Do not start full batch submission before the user approves the confirmation result.

## Hard Rules

- 开始前必须确认输出路径；不能静默使用默认路径继续。
- 写提示词、写 `提示词记录.json`、提交视频前，必须先确认当前项目的最新有效文件；不能凭记忆、浏览器当前页、旧报告、旧提示词或上一次对话猜参数。
- 最新文件确认必须至少做三件事：按修改时间列出项目最近文件；用关键词搜索目标镜头 / 故事板 / 时长 / 比例 / 模型；读取命中的最新相关 HTML、MD、JSON 或运行记录。
- 如果不同文件里的时长、比例、模型、镜头编号或故事板编号冲突，必须以“最新明确生产规格文件”为准，并在提交记录或回复里写清来源文件路径；不能静默沿用旧文件。
- 提交 `multimodal2video` 前必须校验所有参考视频 / 音频时长；视频参考必须在 CLI 当前允许范围内，超过上限要先裁剪到合规长度或移除，不能等接口报错。
- 如果参考视频上传返回远端 `502`、upload video/audio 失败、VOD 上传失败或类似网络上传错误，先把该参考视频处理成 `5` 秒以内、无音频、H.264 MP4、小体积版本，再替换 `reference_videos` 重提一次；不要反复提交同一个失败视频文件。
- Seedance2 / Dreamina 视频生成通常是 `10-30` 分钟级异步任务。提交成功并返回 `querying` / `Queueing` / `Generating` 后，不要把几分钟无结果误判成失败；按长任务节奏轮询和汇报。
- 每条视频默认生成 `1` 条，除非用户明确指定其他数量。
- 项目目录必须保留三个入口文件夹：`原图`、`参考`、`输出`；同时在 `输出` 内创建 `提示词`、`确认片`、`成片`、`运行记录`、`临时`，让后续产物归档到对应分类。
- 创建文件夹后必须暂停，让用户把首帧/分镜图放进 `原图`，参考素材放进 `参考`。
- 默认执行入口是 `dreamina` CLI，提交前先按子命令 help 确认参数。
- 用户明确选择 Veo 时，执行入口改为 NewAPI Business `/v1/videos` 异步接口；默认仍是 Dreamina。
- 批量执行前必须先出 1 条确认片，用户确认后再继续。
- 不要把单条视频任务写成一组互不相干的镜头合集。
- 默认模型是 `seedance2.0fast_vip`，默认模式是 `multimodal2video`。
- Veo 只接受文生视频或图生视频参考；不要给 Veo 提交参考视频或参考音频。
- Veo 比例只用 `16:9` 或 `9:16`，时长只用 `4`、`6`、`8` 秒；需要 `3:4` 或音视频参考时继续走 Dreamina。

## Default Dreamina Settings

- 默认命令：`dreamina multimodal2video`
- 默认模型：`seedance2.0fast_vip`
- 默认分辨率：`720p`
- 默认时长：仅当用户和最新项目文件都没有明确时长时才用 `5` 秒。
- 默认比例：`16:9`、`3:4`、`9:16` 中的一个；用户或最新项目文件有明确规格时必须优先使用该规格。
- 默认参考方式：全能参考，支持 `image` / `video` / `audio`
- 默认等待预期：Seedance2 视频生成常见等待 `10-30` 分钟，`15s`、多参考、VIP 队列也可能需要较长时间；只要状态是 `querying` / `Queueing` / `Generating` 就继续按异步任务查询。

Only switch to `image2video` when the user explicitly wants a single first-frame animation and does not need full mixed-media references.

## Veo 路线（仅用户明确选择时）

主文件只记三条硬限制：Veo 不收参考视频/音频；比例只有 `16:9` / `9:16`；时长只有 `4/6/8` 秒。其余接口、模型族、鉴权、任务行形状、参考图上限全部见 `references/veo.md`，走 Veo 前必读。

## Step 1: Confirm The Job

Ask the user for the minimum information needed to start:

- 本次项目名。
- 本次视频目标。
- 输出路径。
- 视频比例：`16:9`、`3:4`、`9:16`。
- 每条视频生成几条，默认 `1`。
- 时长，默认 `5` 秒。
- 是否有参考图 / 参考视频 / 参考音频，以及它们分别控制什么。
- 本次使用 Dreamina 还是 Veo；没有明确指定时默认 Dreamina。
- 如果用 Dreamina，是否直接使用默认模型 `seedance2.0fast_vip`。
- 如果用 Veo，确认模型族 Fast / Standard / Ref、时长 `4/6/8` 秒、比例 `16:9/9:16`、分辨率 `720p/1080p`、是否生成音频。

Default output path suggestion: 项目制按 `assets\project-env-protocol.md` 用仓库根 `project\<项目名>\`；用户给了别的路径就用用户的。

If the user accepts the suggested path, treat it as confirmed.

## Step 2: Create The Project Folder

Use the bundled helper when creating the project folder:

```powershell
python scripts\init_project.py --project-name "<项目名>" --root "<仓库根>\project"
```

Or pass an exact confirmed output path:

```powershell
python scripts\init_project.py --output-path "<已确认输出路径>"
```

The helper creates:

```text
<项目目录>\
  原图\
  参考\
  输出\
    提示词\
    确认片\
    成片\
    运行记录\
    临时\
```

After creating the folders, stop and tell the user:

- 把首帧 / 分镜图放进 `原图`。
- 把参考图、参考视频、参考音频放进 `参考`。
- 放好后让你继续。

Do not scan or generate until the user says the files are ready.

## Step 3: Prompt Writing And Confirmation Clip

When the user says the files are ready:

0. Confirm the newest source-of-truth files before writing or submitting anything.
1. Read `原图` and `参考`.
2. Choose the first source image in stable filename sort order as the confirmation sample.
3. Use `D-storyboard` for product storyboards, product videos, general continuous shots, and hybrid scene-product videos.
4. Generate one strict Chinese video prompt for that one item.
5. Save the prompt row to:

```text
输出\提示词\提示词记录.json
```

Use this row shape:

```json
{
  "id": "shot-001",
  "provider": "dreamina",
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

Veo 任务行形状见 `references/veo.md`。

Then call the generation script with `count: 1` and output to `输出\确认片`.

```powershell
python scripts\generate_batch_videos.py `
  --results-input "<项目目录>\输出\提示词\提示词记录.json" `
  --output-dir "<项目目录>\输出\确认片"
```

Show the confirmation clip path to the user and stop. Wait for approval or revision instructions.

## Step 4: Full Batch After Approval

Only after the user approves the confirmation clip:

1. Write one prompt row per item.
2. Use the confirmed per-item count, defaulting to `1`.
3. Save all rows to `输出\提示词\提示词记录.json`，并在需要兼容脚本时复制到 `输出\提示词记录.json`。
4. Run the generation script with output dir `输出\成片`.
5. Save or copy run records into `输出\运行记录`，不要混进成片目录。

Run pattern:

```powershell
python scripts\generate_batch_videos.py `
  --results-input "<项目目录>\输出\提示词\提示词记录.json" `
  --output-dir "<项目目录>\输出\成片"
```

## Prompt Writing Rules

For every video item:

- 先写比例、时长、参考来源，再写动作。
- 明确首帧、主体动作、镜头运动、环境变化、结束画面。
- 默认使用 `multimodal2video`，把参考图 / 参考视频 / 参考音频写成具体角色，不要只说“参考上传素材”。
- 如果使用 Veo，写清 `provider: "veo"`，只使用图像参考；普通 / Fast 把 2 张图理解为首帧 + 尾帧，Ref 把最多 3 张图理解为身份 / 产品 / 风格参考。
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
      "provider": "dreamina",
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

## Async Waiting And Querying

- Treat Dreamina and Veo video generation as asynchronous jobs, not immediate renders.
- Normal waiting expectation for Seedance2 video tasks is `10-30` minutes.
- Veo uses `queued`、`in_progress`、`completed`、`failed`; completed 后再下载 `/v1/videos/{task_id}/content`。
- After submit success, save `submit_id`, `credit_count`, queue status, output path, and prompt row immediately.
- Poll gently. Use longer intervals such as `60-180` seconds after the first quick checks; do not spam query calls every few seconds.
- User updates should say the real state: `Queueing`, `Generating`, `success`, or `fail`.
- Do not call the job stuck only because it has been generating for a few minutes.
- Only treat it as blocked when Dreamina returns `fail`, upload errors repeat after the lightweight fallback, login/authorization blocks the job, or the same unchanged status has exceeded the expected window and further querying gives no new information.

## Latest File Confirmation Before Submit

Before running `generate_batch_videos.py` or direct `dreamina` submit:

1. Locate the active project folder from the user's path, current report path, or prompt row paths.
2. List the newest files in that folder tree and identify likely source files, such as current HTML reports, MD方案, prompt JSON, storyboards, and run records.
3. Search those files with concrete keywords: target shot id, storyboard id, `时长`, `duration`, `比例`, `ratio`, `seedance`, `VIP`, `veo`, `gemini-veo`, `生成`.
4. Read the newest matching source file around the target shot / storyboard section.
5. Validate `ratio`, `duration`, `model_version`, `video_resolution`, main frame, references, and final prompt against that source.
6. Validate referenced media constraints with the current execution path. For `multimodal2video`, confirm image/video/audio count and duration limits before submit. For Veo, confirm only image references are used and image count does not exceed the selected model limit.
7. If reference video duration is too long, create a clearly named clipped reference inside `参考` or replace it with an allowed reference; record the replacement path.
8. If reference video upload fails with remote `502` / upload video/audio / VOD errors, create a lighter fallback reference: `<=5s`, no audio, H.264 MP4, compressed enough for stable upload. Use a clear filename like `*_5s.mp4`.
9. If the 5s lightweight reference still fails for the same upload reason, stop and report the upload blocker instead of burning repeated submissions; the next fallback is image-only or extracted frame-board reference, but that needs user awareness because video-reference strength changes.
10. If a prepared `提示词记录.json` conflicts with the latest source, update it only when the user has asked you to proceed with that source; otherwise stop and report the conflict.
11. The run record must preserve the actual submitted values so later review can see what was really sent.

Never infer duration or ratio from an older report when a newer planning file exists.

## Guardrails

- Do not create extra top-level project subfolders beyond `原图`、`参考`、`输出`; output categorization belongs under `输出`.
- Do not begin full batch generation from an unapproved confirmation clip.
- Do not generate prompts without a clear Dreamina execution path.
- Do not silently change ratio, duration, model, or reference roles.
- Do not submit from stale prompt rows; validate against the latest source files first.
- Do not submit over-length reference videos or audio to Dreamina; trim or replace them before the paid submit.
- Do not submit reference video/audio to Veo; switch to Dreamina or ask whether to convert to image-only references.
- Do not submit `3:4` or `5` 秒 rows to Veo; Veo only accepts `16:9` / `9:16` and `4` / `6` / `8` 秒模型。
- Do not keep retrying the same failed video reference after a remote upload error; use a short compressed fallback once, then stop if it still fails.
- Do not promise instant video output; Seedance2 normally takes `10-30` minutes, so keep the user updated while it runs.
- Before real submit, warn the user that the run will consume Dreamina credits or NewAPI/Veo quota.
- If the CLI returns `AigcComplianceConfirmationRequired`, tell the user to complete that web-side confirmation first, then retry.
