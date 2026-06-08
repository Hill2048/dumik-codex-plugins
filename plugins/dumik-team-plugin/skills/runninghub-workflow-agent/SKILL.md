---
name: runninghub-workflow-agent
version: 0.1.4
description: "RunningHub 图片后处理执行入口。只负责把已配置好的 RunningHub 工作流或 AI App、图片输入和固定节点参数提交到 RunningHub，并下载输出结果；不负责写提示词、不负责普通图片生图、不负责改图文案。"
---

# RunningHub 执行

Use this skill only when the user explicitly asks for RunningHub / RH / 放大 / 超分 / 高清放大 / 抠图 / 去背景.

## Hard Rules

- 本 skill 只管 RunningHub 工作流或 AI App 提交与结果拉取。
- 不写提示词，不优化提示词，不判断画面文案。
- 不做普通图片生图或改图；普通图片提交走 `image-batch-agent`。
- 不把 API Key 写入仓库或日志。
- 没有 `workflowId` / `webappId`、输入节点映射或 API Key 时，不真实提交。

## Inputs

最少需要：

- `workflowId`
- 或 `webappId`
- 图片输入节点 `nodeId` / `fieldName`
- API Key

可选固定参数：

- `--reduce-size`：放大 AI App 的缩小尺寸，默认由 preset 决定
- `--upscale-size`：放大 AI App 的放大尺寸，默认由 preset 决定
- `--set-node`：临时覆盖其它节点参数

## One-line Run

先在本机私有目录准备 preset：

```text
  CODEX_HOME\dumik-team-plugin\runninghub-presets\upscale.json
  CODEX_HOME\dumik-team-plugin\runninghub-presets\matting.json
```

API Key 优先从这些位置读取：

- 命令行 `--api-key`
- 本机图片接口缓存 `CODEX_HOME\dumik-team-plugin\api_settings.py` 里的 `RUNNINGHUB_API_KEY`
- 环境变量 `RUNNINGHUB_API_KEY`

然后运行：

```powershell
python scripts\run_runninghub_workflow.py --preset upscale --image "<要放大的图片路径>" --out-dir "<输出目录>"
```

临时指定尺寸：

```powershell
python scripts\run_runninghub_workflow.py --preset upscale --image "<要放大的图片路径>" --reduce-size 1500 --upscale-size 4000 --out-dir "<输出目录>"
```

抠图 / 去背景：

```powershell
python scripts\run_runninghub_workflow.py --preset matting --image "<要抠图的图片路径>" --out-dir "<输出目录>"
```

只检查 API 连通性：

```powershell
python scripts\run_runninghub_workflow.py --config "references\runninghub-upscale-preset.example.json" --validate-auth
```

## Handoff

- 如果用户后续要普通图片生成或改图，交回 `image-batch-agent`。
- 如果用户要写提示词，交回对应提示词 skill。
