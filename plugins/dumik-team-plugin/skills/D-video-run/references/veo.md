# Veo 路线细节

只有用户明确选择 Veo 时才走这条路线；默认始终是 Dreamina。主文件只保留关键限制，接口细节都在这里。

## 默认设置

- 默认接口：`POST /v1/videos`、`GET /v1/videos/{task_id}`、`GET /v1/videos/{task_id}/content`
- 默认基础地址：`https://apibusiness.bafang.me`
- 默认鉴权：优先读取 `CODEX_HOME\dumik-team-plugin\api_settings.py` 的本机缓存；缓存没有时再读 `CODEX_HOME\config.toml` 和 `CODEX_HOME\auth.json`；`CODEX_HOME` 未设时用 `C:\Users\admin\.codex`；命令行 `--base-url`、`--api-key` 可覆盖；不要打印 token/key。
- 默认模型族（Fast）：`gemini-veo-3.1-fast-generate-preview-{4s|6s|8s}`
- Standard 模型：`gemini-veo-3.1-generate-preview-{4s|6s|8s}`
- Ref 模型：`gemini-veo-3.1-generate-preview-ref-{4s|6s|8s}`
- 默认分辨率：`720p`，可选 `1080p`
- 支持尺寸：`1280x720`、`720x1280`、`1920x1080`、`1080x1920`
- 普通 / Fast 最多 `2` 张参考图，含首帧和尾帧；Ref 最多 `3` 张参考图，更适合稳定产品外观。
- 本地图片由脚本转成 data URL；公网图片 URL 可直接写入 `images` 或 `image_url`。

## 任务行形状

```json
{
  "id": "shot-001",
  "provider": "veo",
  "file": "完整首帧路径或公网图片 URL",
  "task": "本次视频目标",
  "count": 1,
  "output_name": "shot-001",
  "ratio": "16:9",
  "duration": 4,
  "mode": "veo-fast",
  "model_version": "gemini-veo-3.1-fast-generate-preview-4s",
  "video_resolution": "720p",
  "reference_images": [],
  "reference_videos": [],
  "reference_audios": [],
  "images": [],
  "generate_audio": true,
  "negative_prompt": "字幕、水印、文字、变形",
  "final_instruction": "按视频提示词规则写出的完整中文生视频提示词"
}
```

## 异步状态

`queued` -> `in_progress` -> `completed` / `failed`；completed 后再下载 `/v1/videos/{task_id}/content`。

## 硬限制（提交前必须校验）

- 只接受文生视频或图生视频参考；**不要**提交参考视频或参考音频，需要它们就继续走 Dreamina。
- 比例只用 `16:9` 或 `9:16`；时长只用 `4`、`6`、`8` 秒。`3:4` 或 `5` 秒的行不许提交给 Veo。
- 写提示词时：普通 / Fast 把 2 张图理解为首帧 + 尾帧；Ref 把最多 3 张图理解为身份 / 产品 / 风格参考。
- 提交前确认参考图数量不超过所选模型上限。
