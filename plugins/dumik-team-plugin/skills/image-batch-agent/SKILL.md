---
name: image-batch-agent
version: 0.7.1
description: "图片生成、单图改图和项目制批量改图统一入口。默认按单图模式处理明确生图/出图/编辑图片请求；只有用户明确说批量、项目制批量、批量生成或多图成组处理时，才开启批量模式。提示词类请求仍默认只输出文字。"
---

# 图片生成与批量修改 Agent

Use this skill as the only team entry for actual image generation and image editing. It has two modes:

- 单图模式：默认模式。用于用户明确要求生图、出图、生成图片、编辑这张图、调用图片接口，但没有明确说批量。
- 批量模式：只有用户明确说批量、项目制批量、批量生成、多张图成组处理、先出确认图再批量时才启用。

Default to prompt-only work for requests like "写提示词", "整理提示词", "给我改图指令", "批量写提示词", or "生成提示词". Do not call the image API unless the user explicitly asks for actual generation or editing.

## Hard Rules

- 单图模式是默认；不要因为用户说“生图/出图”就自动走批量项目流程。
- 批量模式必须有明确批量意图；没有“批量/多张/整组/项目制/批量生成”等表达时，按单图处理。
- 提示词类请求默认只写提示词，不生图、不出确认图、不调用图片接口。
- 单图实际出图默认生成 `1` 张；批量实际出图每张默认生成 `2` 张。
- 批量模式开始前必须确认输出路径；不能静默使用默认路径继续。
- 批量项目目录内部只创建三个文件夹：`原图`、`参考`、`输出`。
- 批量创建文件夹后必须暂停，让用户把原图放进 `原图`，参考图放进 `参考`。
- 提示词必须使用 `image-prompt-optimizer` 的判断和输出规则。
- 每张原图单独分析、单独写提示词，不合并成一个总提示词；只有明确出图时才生成结果。
- 默认锁定产品结构、角度、品牌区、把手、盖子、五金、轮廓和 SKU 比例。
- 参考图只控制它该控制的内容，例如材质、风格、构图、产品结构或局部细节。

## Image API

The generation script uses OpenAI-compatible image API settings in this order:

- 命令行显式参数：`--base-url`、`--api-key`
- 本机缓存：先运行插件根目录 `scripts/init_api_cache.py`，写入 `CODEX_HOME/dumik-team-plugin/api_settings.py`
- Codex 配置：`CODEX_HOME/config.toml`、`CODEX_HOME/auth.json`
- 环境变量：`JUAIHUB_BASE_URL`、`OPENAI_BASE_URL`、`JUAIHUB_API_KEY`、`OPENAI_API_KEY`
- 安全默认 URL：`https://api.juaihub.cn`
- Image model: `gpt-image-2`

Do not store API keys in this public plugin package. Do not print keys or tokens.

## Output Size And Concurrency

Only apply these settings when the user explicitly asks for actual image generation:

- 故事板类任务默认标准化输出为整张 `4K 9:16 2160x3840`。
- Image2 规范：请求尺寸必须在生成接口里原生指定，宽高都为 16 的倍数、单边不超过 4000、宽高比在 `1:3` 到 `3:1`、总像素在 `655360` 到 `8294400`；`9:16 4K` 固定请求 `2160x3840`。
- 故事板必须在生成请求阶段直接使用目标比例和目标尺寸；不允许先生成其他比例再后期拉伸成 9:16。
- 如果图片接口不支持目标尺寸，任务必须失败并更换支持该比例的生成通道，不能产出假比例文件。
- 故事板类任务支持两种整张输出比例：`16:9 -> 3840x2160`、`9:16 -> 2160x3840`。
- `3:4` 默认表示每个分镜小格的画面比例，不作为整张故事板默认输出比例。
- 用户没指定时，电商产品故事板默认整张优先 `9:16 2160x3840`，每个分镜小格按 `3:4` 构图。
- 其他批量出图默认标准化输出为 `2K`，即长边 `2048`，保持原图比例。
- 单条 prompt row 可用 `output_size` 覆盖默认值，例如 `3840x2160`、`2160x3840`、`16:9-storyboard`、`9:16-storyboard`、`4K`、`2K`；兼容旧写法 `3:4-storyboard` 时按“单格 3:4、整张 9:16”处理。
- 批量生成脚本支持 `--concurrency 1-8`，默认 `3`。

## Single Image Mode

Use this mode by default when the user clearly asks to generate or edit one image.

Minimum inputs:

- 可执行提示词或已经确认的改图指令。
- 如果是改图：目标图路径。
- 输出位置；用户没指定时可使用当前项目的 `输出` 目录。
- 输出尺寸；没指定时按接口默认或任务类型判断。

Run pattern:

```powershell
python scripts\generate_batch_images.py `
  --prompt "<可执行中文提示词>" `
  --out "<输出图片路径>"
```

Single image edit:

```powershell
python scripts\generate_batch_images.py `
  --image "<目标图路径>" `
  --prompt "<可执行中文改图指令>" `
  --out "<输出图片路径>"
```

Single mode does not require creating a batch project folder.

## Batch Mode Step 1: Confirm The Job

Only enter this flow when the user explicitly asks for batch mode. Ask for the minimum information needed to start:

- 本次项目名。
- 本次要改什么。
- 输出路径。
- 故事板类任务使用哪种整张比例：`16:9`、`9:16`；默认每格分镜比例为 `3:4`。
- 是否有参考图，以及参考图分别控制什么。
- 是否只写提示词，还是需要实际出图。默认按只写提示词处理。
- 每张图生成几张，默认 `2`。仅在用户明确要求实际出图时询问。
- 使用哪个图片模型/API，如果当前环境没有默认配置。仅在用户明确要求实际出图时询问。

Default output path suggestion:

```text
F:\AI HOME\CODEX\image\outputs\批量改图项目\<项目名-时间戳>\
```

If the user accepts the suggested path, treat it as confirmed.

## Batch Mode Step 2: Create The Project Folder

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

## Batch Mode Step 3: Prompt Writing

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

## Batch Mode Step 4: Confirmation Image Only When Explicitly Requested

Only when the user explicitly says they want actual image generation, such as "生图", "出图", "生成图片", "调用接口", "先出确认图", or "批量生成", call the generation script with `count: 1` and output to `输出\确认图`.

```powershell
python scripts\generate_batch_images.py `
  --batch `
  --results-input "<项目目录>\输出\提示词记录.json" `
  --output-dir "<项目目录>\输出\确认图" `
  --concurrency 1 `
  --api-key "<图片接口 Key>"
```

Show the confirmation image path to the user and stop. Wait for approval or revision instructions.

## Batch Mode Step 5: Full Batch After Approval

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
  --batch `
  --results-input "<项目目录>\输出\提示词记录.json" `
  --output-dir "<项目目录>\输出" `
  --concurrency 3 `
  --api-key "<图片接口 Key>"
```

## Prompt Writing Rules

For every image item:

- State the image ratio and ratio basis first.
- 如果是故事板，明确写清整个故事板的输出比例，只允许 `16:9`、`9:16` 两种标准比例，不能模糊写“竖版”或“横版”；同时写清每个分镜小格默认按 `3:4` 构图。
- 如果是故事板，必须写清画面标注规范：红色实线箭头表示运动方向，箭头长度表示速度，长箭头代表快，短箭头代表慢；蓝色虚线方框标注位置 / 区域，并标注中心点坐标，例如“方框 1 中心 (x:300,y:400)”；白色粗体数字标注时序，例如“1→2→3”，或标注角色 ID，例如“角色 A=1，角色 B=2”。
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
