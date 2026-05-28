---
name: image-batch-agent
version: 0.1.2
description: "项目制批量修改图片。适用于先确认需求和输出路径，创建中文项目文件夹，让用户放入原图/参考图，再用 image-prompt-optimizer 为每张图生成独立中文改图提示词。默认只写提示词；只有用户明确要求生图、出图、生成图片、调用接口或批量生成时，才调用图片模型。支持明确出图后的输出尺寸和并发控制。"
---

# 批量图片修改 Agent

Use this skill for project-based batch image editing. The workflow is fixed:

1. 确认需求。
2. 创建中文项目文件夹，让用户放图。
3. 用 `image-prompt-optimizer` 逐图生成提示词。
4. 只有用户明确要求生图、出图、生成图片、调用接口或批量生成时，才先出 1 张确认图，用户确认后再批量生图。

Default to prompt-only work. Do not call the image API for requests like "写提示词", "整理提示词", "给我改图指令", "批量写提示词", or "生成提示词". Do not skip the confirmation image when the user explicitly asks for actual image generation. Do not start full batch generation before the user approves the confirmation result.

## Hard Rules

- 开始前必须确认输出路径；不能静默使用默认路径继续。
- 默认只写提示词，不生图、不出确认图、不调用图片接口。
- 每张图默认生成 `2` 张只适用于用户明确要求实际出图时；只写提示词时不要询问生成数量。
- 项目目录内部只创建三个文件夹：`原图`、`参考`、`输出`。
- 创建文件夹后必须暂停，让用户把原图放进 `原图`，参考图放进 `参考`。
- 提示词必须使用 `image-prompt-optimizer` 的判断和输出规则。
- 每张原图单独分析、单独写提示词，不合并成一个总提示词；只有明确出图时才生成结果。
- 默认锁定产品结构、角度、品牌区、把手、盖子、五金、轮廓和 SKU 比例。
- 参考图只控制它该控制的内容，例如材质、风格、构图、产品结构或局部细节。

## Image API

The generation script uses OpenAI-compatible image API settings passed by the user or environment:

- Base URL: `https://api.juaihub.cn`
- Image model: `gpt-image-2`
- API key: pass `--api-key` or set `OPENAI_API_KEY`

Do not store API keys in this public plugin package.

## Output Size And Concurrency

Only apply these settings when the user explicitly asks for actual image generation:

- 故事板类任务默认标准化输出为 `4K 3:4 2880x3840`。
- 其他批量出图默认标准化输出为 `2K`，即长边 `2048`，保持原图比例。
- 单条 prompt row 可用 `output_size` 覆盖默认值，例如 `2880x3840`、`2048x2048`、`4K`、`2K`。
- 批量生成脚本支持 `--concurrency 1-8`，默认 `3`。

## Step 1: Confirm The Job

Ask the user for the minimum information needed to start:

- 本次项目名。
- 本次要改什么。
- 输出路径。
- 是否有参考图，以及参考图分别控制什么。
- 是否只写提示词，还是需要实际出图。默认按只写提示词处理。
- 每张图生成几张，默认 `2`。仅在用户明确要求实际出图时询问。
- 使用哪个图片模型/API，如果当前环境没有默认配置。仅在用户明确要求实际出图时询问。

Default output path suggestion:

```text
F:\AI HOME\CODEX\image\outputs\批量改图项目\<项目名-时间戳>\
```

If the user accepts the suggested path, treat it as confirmed.

## Step 2: Create The Project Folder

Use the bundled helper when creating the project folder:

```powershell
python scripts\init_project.py --project-name "<项目名>" --root "F:\AI HOME\CODEX\image\outputs\批量改图项目"
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

- 把待处理图片放进 `原图`。
- 把参考图放进 `参考`。
- 放好后让你继续。

Do not scan or generate until the user says the files are ready.

## Step 3: Prompt Writing

When the user says the files are ready:

1. Read `原图` and `参考`.
2. Sort source images by stable filename order.
3. Load and follow `image-prompt-optimizer`.
4. Generate one strict Chinese edit prompt for each image.
5. Save the prompt rows to:

```text
输出\提示词记录.json
```

Use this row shape:

```json
{
  "id": "img-001",
  "file": "完整原图路径",
  "task": "本次改图目标",
  "count": 1,
  "output_name": "img-001.png",
  "output_size": "2K",
  "final_instruction": "按 image-prompt-optimizer 规则写出的完整中文改图提示词"
}
```

Stop here by default. Return `输出\提示词记录.json` and tell the user that no image has been generated yet.

## Step 4: Confirmation Image Only When Explicitly Requested

Only when the user explicitly says they want actual image generation, such as "生图", "出图", "生成图片", "调用接口", "先出确认图", or "批量生成", call the generation script with `count: 1` and output to `输出\确认图`.

```powershell
python scripts\generate_batch_images.py `
  --results-input "<项目目录>\输出\提示词记录.json" `
  --output-dir "<项目目录>\输出\确认图" `
  --concurrency 1 `
  --api-key "<图片接口 Key>"
```

Show the confirmation image path to the user and stop. Wait for approval or revision instructions.

## Step 5: Full Batch After Approval

Only after the user approves the confirmation image:

1. Use `image-prompt-optimizer` for every source image in `原图`.
2. Review or update one prompt row per image.
3. Use the confirmed per-image count, defaulting to `2`.
4. Save all rows to `输出\提示词记录.json`.
5. Run the generation script with output dir `输出`.
6. Save run records in `输出\运行记录.json` and `输出\运行记录.md`.

Run pattern:

```powershell
python scripts\generate_batch_images.py `
  --results-input "<项目目录>\输出\提示词记录.json" `
  --output-dir "<项目目录>\输出" `
  --concurrency 3 `
  --api-key "<图片接口 Key>"
```

## Prompt Writing Rules

For every image item:

- State the image ratio and ratio basis first.
- Identify the target image and every reference image role.
- Default to locked mode.
- Convert the user's edit goal into visible image language.
- Keep the final Chinese image-edit instruction in the row's `final_instruction`.
- Do not rewrite an image-edit task as pure text-to-image generation.

If multiple references exist, assign each one a specific role:

- 材质参考
- 风格参考
- 构图参考
- 产品结构参考
- 局部细节参考

Do not say only "参考上传图片".

## Generation Input Shape

The generation script accepts either an array or an object with `items`:

```json
{
  "items": [
    {
      "id": "img-001",
      "file": "F:/path/to/source.jpg",
      "task": "保持产品结构不变，内胆改成雾面微暖黑",
      "count": 2,
      "output_name": "img-001.png",
      "output_size": "2K",
      "final_instruction": "完整中文改图提示词"
    }
  ]
}
```

Read [references/checklist-template.md](references/checklist-template.md) if the user needs an input template.
Read [references/results-input-example.json](references/results-input-example.json) when checking the JSON shape.

## Guardrails

- Do not create extra project subfolders beyond `原图`、`参考`、`输出`.
- Do not begin full batch generation from an unapproved confirmation image.
- Do not generate prompts without `image-prompt-optimizer`.
- Do not silently change SKU, structure, angle, handle, lid, hardware, brand zone, or outline.
- If the API only supports text-to-image and cannot accept source images, tell the user before running.
