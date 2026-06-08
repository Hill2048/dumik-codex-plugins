---
name: image-batch-agent
version: 1.3.2
description: "普通图片接口执行入口。只负责把已确认的提示词、原图和参考图提交到 Image2 / Banana 系列接口并保存结果；不写提示词、不做 RunningHub 工作流、不做视频。"
---

# 图片执行 Agent

本 skill 是普通图片接口的执行层，不是策划层，也不是提示词层。

## 先分流

- `RunningHub` / `RH` / `放大工作流` / `超分` / `高清放大`
  -> 交给 `runninghub-workflow-agent`
- `视频` / `TVC` / `生视频` / `确认片`
  -> 交给 `video-batch-agent` 或视频线
- `写提示词` / `优化提示词` / `改图指令`
  -> 交给 `image-prompt-optimizer`、`super-image-prompt` 或对应上游
- `生成图片` / `出图` / `编辑图片` / `调用普通图片接口`
  -> 本 skill

## 职责

- 提交已经确认的 `prompt` / `prompt-file` / `final_instruction`。
- 单图生成或单图编辑。
- 明确批量时，按任务 JSON 批量提交。
- 保存图片结果和运行记录。
- 结果落 `输出/确认图/` 并记录运行记录；`qaVerdict` 自检结论建议一并记录。接前端/桥时再额外按文件合同回写 `bridge/run-state.json`（可选，纯 Codex 内跑不强制）。

## 不负责

- 不写词，不优化词，不改写上游指令。
- 不判断画面创意，不做产品策略。
- 不执行 RunningHub 工作流。
- 不做视频生成。
- 不把 API Key 写进插件或日志。

## 默认选择

- 没说批量：按单图。
- 没说模型：默认 `gpt-image-2`，默认 `2K`。
- 明确说 `banana` / `banana2`：用 `nano-banana-2`。
- 明确说 `bananapro`：用 `nano-banana-pro`。
- 多候选：必须拆成多条 row，每条 `count: 1`，不要依赖 `count > 1`。

## 执行入口

单图生成：

```powershell
python scripts\generate_batch_images.py `
  --prompt "<已确认提示词>" `
  --image-model banana `
  --out "<输出图片路径>"
```

单图编辑：

```powershell
python scripts\generate_batch_images.py `
  --image "<目标图路径>" `
  --prompt "<已确认改图指令>" `
  --image-model banana `
  --out "<输出图片路径>"
```

批量提交：

```powershell
python scripts\generate_batch_images.py `
  --batch `
  --results-input "<任务 JSON>" `
  --output-dir "<输出目录>" `
  --image-model banana `
  --concurrency 3
```

## 读细节

- Image2 参数：`references/model-image2.md`
- Banana 参数：`references/model-banana2.md`
- 批量输入示例：`references/results-input-example.json`
- 检查模板：`references/checklist-template.md`
- Agent 批量合同：`assets/批量协作-文件合同.md`

## 结束条件

- 结果图片已保存到指定目录。
- 运行记录已保存到 `输出\运行记录` 或同级记录文件。
- 如果是确认图，只产出确认图并停下等用户确认。
