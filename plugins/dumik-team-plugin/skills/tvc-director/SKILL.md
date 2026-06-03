---
name: tvc-director
description: "TVC 总导演顶层调度入口。用于电商视频、TVC、产品广告片、卖点顺序、视频脚本、故事板、Image2 产品故事板、连续分镜、关键帧、逐镜生视频提示词、批量生视频和 Dreamina 提交前的路线判断；负责调度 ecom-video-conversion、video-storyboard-prompts、video-batch-agent，必要时调用 ecom-visual-director / image-batch-agent 处理故事板生图。"
version: 0.1.3
---

# TVC 总导演

这个技能是视频和 TVC 任务的顶层导演入口：先判断任务属于策略、故事板、逐镜提示词、故事板生图，还是真实生视频执行。

不要替代底层技能。先选对路线，再按对应底层技能的规则执行。

同时负责本次视频项目的前置环境部署：当任务进入项目制、批量生视频、确认片、关键帧生图或多轮制作时，先创建项目文件夹、分好素材和产物分类、检查 Dreamina / Veo / 图片生成所需工具；工具缺失时优先自动安装或初始化，不能自动解决时再停下来说明缺口。

全量环境检查不要每次重复做。先查看插件 `assets\verified-environment-checklist.md`；如果清单版本与当前插件版本匹配，就复用清单结论，只做本次项目级检查和实际执行前的动态项轻量检查。

## 先给判断

开头先给一句短判断：

```text
判断：这是{视频任务类型}，先走 {skill-name}，原因是{一句话}。
```

如果任务跨多个阶段，直接说明链路：

```text
链路：ecom-video-conversion -> video-storyboard-prompts -> video-batch-agent
```

如果需要项目环境，再补一句：

```text
项目：先创建本次项目目录，首帧、参考、提示词、确认片、成片、运行记录分别归档；工具检查通过后再执行。
```

## 调度地图

- 卖点顺序、转化逻辑、30 到 60 秒电商视频结构、证据链、开头钩子：使用 `ecom-video-conversion`。
- 产品故事板、Image2 身份板、Image2 产品故事板提示词、连续分镜、关键帧、逐镜生视频提示词：使用 `video-storyboard-prompts`。
- 项目制批量生视频、确认片、Dreamina 提交、多条视频提示词执行：使用 `video-batch-agent`。
- 故事板生图或关键帧生图，且提示词已确认：使用 `image-batch-agent`；如果视觉提示词还需要产品改图纪律，先转给 `ecom-visual-director`。
- 没有视频意图的静态电商视觉任务：转给 `ecom-visual-director`。

## 项目环境部署

遇到以下情况时，先部署项目环境，再调度底层技能：

- 用户明确说项目制、批量生视频、先出确认片、确认后批量、出片、提交 Dreamina / Veo。
- 任务包含首帧、故事板、参考图、参考视频、参考音频、逐镜提示词、确认片、成片和运行记录。
- 视频项目需要先生成故事板图片或关键帧图片，再进入生视频。

部署前先读 `assets\verified-environment-checklist.md`：

- 清单匹配当前插件版本时，不重复检查插件结构、脚本存在性、Python、FFmpeg、Dreamina 和敏感信息扫描。
- 只检查本次项目目录、分类目录、输入文件、提示词 JSON、参考素材和输出路径。
- 实际提交视频前，再轻量确认 Dreamina 登录 / Veo 权限 / API 缓存 / FFmpeg 当前可用。
- 使用 Banana2 生成关键帧且依赖本地参考图公网 URL 时，再轻量确认 tunnel URL 可达。

默认视频项目根路径：

```text
F:\AI HOME\CODEX\video\outputs\批量视频项目\<项目名-时间戳>\
```

项目目录由 `video-batch-agent` 的 `scripts\init_project.py` 创建。必须保持三大入口目录兼容底层脚本，同时在 `输出` 内分出产物分类：

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

归档规则：

- 首帧、分镜图、关键帧图片放 `原图`。
- 参考图、参考视频、参考音频放 `参考`。
- 视频脚本、逐镜提示词、任务 JSON、提示词记录放 `输出\提示词`。
- 先出确认片放 `输出\确认片`。
- 用户确认后的正式视频放 `输出\成片`。
- `运行记录.json`、`运行记录.md`、提交 ID、队列状态、错误记录放 `输出\运行记录`。
- 裁切、压缩、抽帧、转码等中间文件放 `输出\临时`。

如果视频项目需要先生成故事板图片或关键帧图片，转给 `ecom-visual-director` / `image-batch-agent` 时，输出位置必须仍落在当前视频项目的 `输出\提示词`、`输出\确认片` 或 `输出\临时` 对应分类里，不要另起无关项目目录。

## 工具检查与自动处理

进入真实生视频、批量、确认片或关键帧生图前，先检查：

- Python 是否可运行。
- `video-batch-agent\scripts\init_project.py` 是否存在。
- `video-batch-agent\scripts\generate_batch_videos.py` 是否存在。
- 默认 Dreamina 路线：检查 `dreamina` CLI 是否可用，并先看对应子命令 help。
- Veo 路线：检查 API 配置是否可读取，优先本机 `CODEX_HOME\dumik-team-plugin\api_settings.py`；没有时运行插件根目录 `scripts\init_api_cache.py` 初始化；仍没有时再读 `CODEX_HOME\config.toml`、`CODEX_HOME\auth.json` 和环境变量。
- 需要裁切、压缩、抽帧或转码时，检查 FFmpeg 是否可用。

能自动修复的直接做：

- 缺项目目录：创建目录。
- 缺 `输出` 内分类：补齐分类。
- 缺 API 缓存但本机配置存在：运行 `scripts\init_api_cache.py`。
- 缺 Python 依赖且项目已有明确依赖文件或脚本报出缺失模块：用当前 Python 环境安装对应依赖，安装后重新验证。
- 缺 FFmpeg 且本机包管理器可用：自动安装并重新验证。

不能自动处理时才停下来：

- Dreamina 未登录、额度不足或需要网页确认。
- Veo / NewAPI 缺 key 或权限。
- 安装工具需要管理员权限、登录外部账号或用户确认。
- 视频参考文件超过平台限制且自动裁切会改变用户想保留的关键内容。

## 导演检查项

调度前先确认：

- 视频目标：种草 / 转化 / 质感片 / 功能证明 / TVC / 详情页视频 / 批量素材。
- 主体：产品 / 人物 / 场景 / 产品 + 人物 / 产品 + 场景。
- 阶段：策略顺序 / 故事板 / 逐镜提示词 / 关键帧生图 / 真实生视频。
- 比例：9:16 / 16:9 / 1:1 / 待确认。
- 时长：总时长、镜头数、单镜时长。
- 稳定锚点：产品结构、角色身份、空间、光线、色调、前后镜头衔接。
- 执行边界：只写提示词，还是要生成图片/视频。

如果用户说要 TVC，但缺少产品、受众、卖点或时长，只问会卡住下一步的最少问题。

## 调度规则

- 不在本技能里提交视频生成。
- 需求是卖点顺序或“视频为什么能转化”时，不要跳过转化逻辑。
- 不再把产品故事板和连续分镜拆回旧入口；统一走 `video-storyboard-prompts`。
- 用户没有明确说生成、提交、跑任务、出确认片或批量生视频时，不要使用 `video-batch-agent`。
- 不因为存在故事板提示词就自动生图；只有用户明确要故事板图片或关键帧图片时才调用图片生成链路。

## 常见链路

只做视频策略：

```text
tvc-director -> ecom-video-conversion
```

故事板和逐镜提示词：

```text
tvc-director -> video-storyboard-prompts
```

完整电商 TVC 策划：

```text
tvc-director -> ecom-video-conversion -> video-storyboard-prompts
```

提示词确认后的故事板生图：

```text
tvc-director -> video-storyboard-prompts -> image-batch-agent
```

真实批量生视频：

```text
tvc-director -> video-batch-agent
```
