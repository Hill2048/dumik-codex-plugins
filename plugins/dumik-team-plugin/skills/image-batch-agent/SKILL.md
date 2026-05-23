---
name: image-batch-agent
description: "项目制批量修改图片。适用于先确认需求和输出路径，创建中文项目文件夹，让用户放入原图/参考图，再用 image-prompt-optimizer 为每张图生成独立中文改图提示词，先出 1 张确认图，确认后批量调用图片模型生成结果。"
---

# 批量图片修改 Agent

Use this skill for project-based batch image editing. The workflow is fixed:

1. 确认需求。
2. 创建中文项目文件夹，让用户放图。
3. 用 `image-prompt-optimizer` 逐图生成提示词，先出 1 张确认图，用户确认后再批量生图。

Do not skip the confirmation image. Do not start full batch generation before the user approves the confirmation result.

## Hard Rules

- 开始前必须确认输出路径；不能静默使用默认路径继续。
- 每张图默认生成 `2` 张，除非用户明确指定其他数量。
- 项目目录内部只创建三个文件夹：`原图`、`参考`、`输出`。
- 创建文件夹后必须暂停，让用户把原图放进 `原图`，参考图放进 `参考`。
- 提示词必须使用 `image-prompt-optimizer` 的判断和输出规则。
- 每张原图单独分析、单独写提示词、单独生成结果，不合并成一个总提示词。
- 默认锁定产品结构、角度、品牌区、把手、盖子、五金、轮廓和 SKU 比例。
- 参考图只控制它该控制的内容，例如材质、风格、构图、产品结构或局部细节。

## Image API

The generation script uses OpenAI-compatible image API settings passed by the user or environment:

- Base URL: `https://api.juaihub.cn`
- Image model: `gpt-image-2`
- API key: pass `--api-key` or set `OPENAI_API_KEY`

Do not store API keys in this public plugin package.

## Step 1: Confirm The Job

Ask the user for the minimum information needed to start:

- 本次项目名。
- 本次要改什么。
- 输出路径。
- 每张图生成几张，默认 `2`。
- 是否有参考图，以及参考图分别控制什么。
- 使用哪个图片模型/API，如果当前环境没有默认配置。

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

## Step 3: Prompt Writing And Confirmation Image

When the user says the files are ready:

1. Read `原图` and `参考`.
2. Choose the first source image in a stable filename sort order as the confirmation sample.
3. Load and follow `C:\Users\admin\.cc-switch\skills\image-prompt-optimizer\SKILL.md`.
4. Generate one strict Chinese edit prompt for that one image.
5. Save the prompt row to:

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
  "final_instruction": "按 image-prompt-optimizer 规则写出的完整中文改图提示词"
}
```

Then call the generation script with `count: 1` and output to `输出\确认图`.

```powershell
python scripts\generate_batch_images.py `
  --results-input "<项目目录>\输出\提示词记录.json" `
  --output-dir "<项目目录>\输出\确认图" `
  --api-key "<图片接口 Key>"
```

Show the confirmation image path to the user and stop. Wait for approval or revision instructions.

## Step 4: Full Batch After Approval

Only after the user approves the confirmation image:

1. Use `image-prompt-optimizer` for every source image in `原图`.
2. Write one prompt row per image.
3. Use the confirmed per-image count, defaulting to `2`.
4. Save all rows to `输出\提示词记录.json`.
5. Run the generation script with output dir `输出`.
6. Save run records in `输出\运行记录.json` and `输出\运行记录.md`.

Run pattern:

```powershell
python scripts\generate_batch_images.py `
  --results-input "<项目目录>\输出\提示词记录.json" `
  --output-dir "<项目目录>\输出" `
  --api-key "<图片接口 Key>"
```

## Prompt Writing Rules

For every image item:

- State the image ratio and ratio basis first.
- Identify the target image and every reference image role.
- Default to locked mode.
- Convert the user's edit goal into visible image language.
- Keep the final Banana Pro Chinese edit instruction in the row's `final_instruction`.
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
