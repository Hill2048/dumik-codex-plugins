# RunningHub 执行

## 适用场景

- 用户明确说用 RunningHub、RH、放大、超分、高清放大、抠图、去背景。
- 已经在 RunningHub 做好工作流或 AI App，并能拿到 `workflowId` 或 `webappId`。
- 输入图片节点已知道 `nodeId` 和 `fieldName`。

## 一次性配置

把示例 preset 复制到本机私有配置：

```powershell
$dir = "$env:CODEX_HOME\dumik-team-plugin\runninghub-presets"
New-Item -ItemType Directory -Force -Path $dir
Copy-Item "plugins\dumik-team-plugin\skills\runninghub-workflow-agent\references\runninghub-upscale-preset.example.json" "$dir\upscale.json"
Copy-Item "plugins\dumik-team-plugin\skills\runninghub-workflow-agent\references\runninghub-matting-preset.example.json" "$dir\matting.json"
```

工作流 preset 改：

- `workflowId`
- `inputs[0].nodeId`
- 必要时改 `inputs[0].fieldName`
- 必要时补 `nodeInfoList` 里的固定参数，比如倍率、模型、降噪强度

AI App preset 改：

- `webappId`
- `instanceType`
- `inputs[0].nodeId`
- 必要时改 `inputs[0].fieldName`
- 放大 AI App 可配置 `parameterAliases.reduce-size` 和 `parameterAliases.upscale-size`

API Key 默认和图片接口 key 放在同一个本机缓存，不写进 preset：

```text
CODEX_HOME\dumik-team-plugin\api_settings.py
```

字段名：

```text
RUNNINGHUB_API_BASE_URL
RUNNINGHUB_API_KEY
```

也可以临时放环境变量：

```powershell
$env:RUNNINGHUB_API_KEY = "你的 RunningHub API Key"
```

只检查 API Key 是否可用：

```powershell
python scripts\run_runninghub_workflow.py --config "references\runninghub-upscale-preset.example.json" --validate-auth
```

## 一句话调用

放大：

```powershell
python plugins\dumik-team-plugin\skills\runninghub-workflow-agent\scripts\run_runninghub_workflow.py --preset upscale --image "<要放大的图片路径>" --out-dir "project\纯钛+乌檀木菜板\输出\成品\runninghub-upscale"
```

指定尺寸：

```powershell
python plugins\dumik-team-plugin\skills\runninghub-workflow-agent\scripts\run_runninghub_workflow.py --preset upscale --image "<要放大的图片路径>" --reduce-size 1500 --upscale-size 4000 --out-dir "project\纯钛+乌檀木菜板\输出\成品\runninghub-upscale"
```

抠图：

```powershell
python plugins\dumik-team-plugin\skills\runninghub-workflow-agent\scripts\run_runninghub_workflow.py --preset matting --image "<要抠图的图片路径>" --out-dir "project\纯钛+乌檀木菜板\输出\成品\runninghub-matting"
```

## 临时覆盖节点参数

优先用 `--reduce-size` / `--upscale-size` 覆盖放大尺寸；其它节点再用 `--set-node "节点.字段=值"`。

## 执行记录

脚本会把结果图下载到 `--out-dir`，并写入：

```text
runninghub-run.json
```

记录包含 `remoteId`、`taskId`、RunningHub 输出 URL 和本地保存路径。

## 边界

- 不把 API Key 写入插件、项目目录或日志。
- 没有 `workflowId` / `webappId` 和图片输入节点 ID 时不能真实提交。
- 本入口只负责提交和保存，不改提示词、不改 SKU、不做图像质量判断。
