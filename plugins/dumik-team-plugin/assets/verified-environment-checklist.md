# DUMIK 插件已检查清单

检查时间：2026-06-03 21:00（Asia/Shanghai）

适用版本：

- 插件版本：`0.1.6`
- `ecom-visual-director`：`0.1.3`
- `tvc-director`：`0.1.3`
- `image-batch-agent`：`1.2.9`
- `video-batch-agent`：`0.1.6`
- `video-storyboard-prompts`：`1.0.0`

## 已确认正确

- 源插件、本机插件缓存、GitHub 发布仓库三边都有 8 个技能目录和对应 `SKILL.md`。
- `plugin.json`、`assets/skill-versions.json` 可正常解析，版本矩阵一致。
- `assets/workflow-map.html` 可解析，本地引用存在，包含项目环境部署、图片确认图、视频确认片和版本 `0.1.5`。
- 图片项目初始化脚本可创建：

```text
原图\
参考\
输出\
  提示词\
  确认图\
  成品\
  运行记录\
  临时\
```

- 视频项目初始化脚本可创建：

```text
原图\
参考\
输出\
  提示词\
  确认片\
  成片\
  运行记录\
  临时\
```

- 本机 Python 可用：`Python 3.12.10`。
- 本机 FFmpeg 可用：`ffmpeg 8.1.1-full_build-www.gyan.dev`。
- 本机 Dreamina CLI 可用，可打开 help。
- 图片生成脚本存在：`skills\image-batch-agent\scripts\generate_batch_images.py`。
- 视频生成脚本存在：`skills\video-batch-agent\scripts\generate_batch_videos.py`。
- API 本机缓存存在，base URL 格式正确，已检测到 key 存在；清单不记录、不展示 key。
- NAS 本机参考图目录存在：`Z:\文件临时传送\banana2_refs`。
- Banana2 参考图公网配置存在，已标准化为 UTF-8 无 BOM JSON，检查时公网 URL 可达。
- 插件包敏感信息扫描通过：未发现明文 API key、Bearer token 或私钥。

## 后续调用规则

如果当前插件版本仍为 `0.1.6`，且本清单存在：

- 不要每次重新做全量插件结构、版本矩阵、脚本存在性、Python、FFmpeg、Dreamina、敏感信息扫描。
- 项目制、批量或生成执行前，只做本次项目级检查：项目目录是否存在、分类目录是否齐全、输入文件是否到位、提示词 JSON 是否在正确位置、输出目录是否写入当前项目。
- 实际调用图片或视频接口前，仍需轻量确认本次所需动态项：API 缓存是否存在且 key 非空、Dreamina 是否仍登录、Veo 是否有权限、FFmpeg 是否仍在 PATH。
- 使用 Banana2 本地参考图公网 URL 前，仍需轻量确认当前 tunnel URL 可达；不可达时运行 `skills\image-batch-agent\scripts\start_nas_public_tunnel.ps1` 重启，并将 `nas_image_url.json` 标准化为 UTF-8 无 BOM JSON。
- 如果插件版本、技能版本、目录脚本、生成脚本或模型接口规范发生变化，本清单失效，必须重新全量检查并更新清单。

## 不能跳过的检查

- 不跳过真实生成前的额度、登录、key、权限检查。
- 不跳过本次项目源文件的新旧冲突检查。
- 不跳过视频任务的参考视频 / 音频时长、格式和平台限制检查。
- 不跳过用户明确要求“重新检查一遍”的全量检查。
