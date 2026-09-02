---
name: D-image-run
description: "普通图片接口执行入口。收到明确生图或改图要求后立即发包并保存结果；单张直接调用，多候选独立并发。默认不做预检、看图审核、尺寸复核或候选推荐。"
---

# 图片执行 Agent

目标只有一个：从用户说“生图 / 出图 / 编辑图片”到接口发包、图片落盘和回传，路径尽可能短。

## 默认全流程

1. 把用户本轮描述视为已确认要求；上游已有 `prompt` / `prompt-file` / `final_instruction` 就直接使用。
2. 用户同时要求“改图 + 生图”时，`D-image-prompt` 在内部写完可执行提示词后直接交接；不展示提示词，不等二次确认。
3. 按用户指定或本 skill 默认值选模型、尺寸和数量，立即发包。
4. 单张走单请求；N 张候选拆成 N 个独立单图请求并发提交，每条 `count: 1`、独立文件名。
5. 图片落 `输出/确认图/`，脚本自动写运行记录。
6. 文件保存成功后立即回传图片、路径和实际返回数量，结束。

## 只保留这些判断

- 改图却没有目标图，或多图职责冲突到可能改错对象：才问一句。
- `RunningHub / RH / 超分 / 放大 / 抠图 / 去背景`：交 `D-rh`。
- 视频任务：交视频线。
- 用户只要提示词、不要求生成：交 `D-image-prompt` 并停在文字。
- 接口真实失败：按“失败处理”执行。

除此之外不做项目扫描、脚本搜索、API 预检、配置盘点、模型比较、方案分析或确认等待。

## 默认参数

- 供应商：`https://sub.juaihub.cn`；Key 从本机缓存读取，不写进插件或运行记录。
- 未指定模型：`banana2`，即 `gemini-3.1-flash-image-preview`。
- `banana / banana2`：`gemini-3.1-flash-image-preview`。
- `bananapro / banana-pro`：`gemini-3-pro-image-preview`。
- 未指定尺寸：`2K`；明确 4K 就用 `4K` 或 `source-4k`。
- 改图默认跟随目标图比例：2K 用 `source-2k`，4K 用 `source-4k`。
- N 张候选默认并发数为 `min(N, 8)`。

## 最快执行入口

### 单张文生图

优先调用已加载的 Juaihub 图片 MCP，一次请求直接回传。MCP 未加载或失败才走脚本：

```powershell
python scripts\generate_batch_images.py `
  --prompt "<最终提示词>" `
  --image-model banana `
  --out "<输出图片路径>"
```

### 单张改图

直接用固定 preset，不临场拼模型名和尺寸：

```powershell
scripts\presets\banana-source-2k.ps1 `
  -Image "<目标图路径>" `
  -PromptFile "<提示词.txt>" `
  -Out "<输出图片路径>"
```

4K 把 preset 换成 `banana-source-4k.ps1`；用户指定 Banana Pro 时换同名 `bananapro-*` preset。

### xN 多候选

`-Count N` 对 Banana 系列会在脚本内部拆成 N 个独立单图请求并发提交，不依赖接口一次返回多张：

```powershell
scripts\presets\banana-source-4k.ps1 `
  -Image "<目标图路径>" `
  -PromptFile "<提示词.txt>" `
  -Count 3 `
  -Out "<输出目录>\candidate.png"
```

已有批任务 JSON 时继续使用批量入口，每行必须 `count: 1`，并发数按任务数设置：

```powershell
python scripts\generate_batch_images.py `
  --batch `
  --results-input "<任务 JSON>" `
  --output-dir "<输出目录>" `
  --image-model banana `
  --concurrency 3
```

## 默认不做

- 不在发包前展示、重述或等待确认提示词。
- 不做接口健康检查、模型列表查询或尺寸探测。
- 不在生成后重新打开图片、逐张看图、比较、排序或推荐。
- 不验证画面内容、文字、结构、材质、比例或清晰度。
- 不额外写 `qaVerdict`、QA 报告或候选点评。
- 不把确认图复制到成品目录，不等待用户确认后再回传。

只有用户明确说“审核 / 检查 / 选图 / 推荐 / 看看有没有问题”时，才进入相应审核流程。

## 失败处理

- `401`：用 `plugins\dumik-team-plugin\scripts\init_api_cache.py --check` 刷新本机缓存并重试一次。
- 用户提供临时 Key：只用于当前进程，不写项目、插件或运行记录。
- 其他接口失败：保留失败记录并直接回报错误；用户没要求排障时不展开诊断。
- 批量结束只核对生成文件数量是否等于用户要求数量；这是收包完整性检查，不是画面审核。

## 结束条件

- 要求的图片数量已经保存，或接口失败已经明确返回。
- 成功时只回传图片、保存路径和数量；不附流程说明和审核结论。

## 参数细节

- Image2：`references/model-image2.md`
- Banana：`references/model-banana2.md`
- 批量 JSON：`references/results-input-example.json`
