---
name: ecom-visual-director
description: "电商视觉总监顶层调度入口。用于电商图片、主图、详情页、白底精修、产品图改图、参考图融合、KV、场景图、批量图片任务、实际生图/改图接口调用前的路线判断；负责调度 image-prompt-optimizer、super-image-prompt、image-batch-agent，必要时把视频化需求转给 tvc-director / video-storyboard-prompts。"
version: 0.1.3
---

# 电商视觉总监

这个技能是电商视觉任务的顶层总监入口：先判断任务类型、保护产品结构、确定路线，再交给正确的 DUMIK 底层技能执行。

不要替代底层技能。先选对路线，再按对应底层技能的规则执行。

同时负责本次项目的前置环境部署：当任务进入项目制、批量、实际生图或需要多轮沉淀时，先创建项目文件夹、分好素材和产物分类、检查所需工具；工具缺失时优先自动安装或初始化，不能自动解决时再停下来说明缺口。

全量环境检查不要每次重复做。先查看插件 `assets\verified-environment-checklist.md`；如果清单版本与当前插件版本匹配，就复用清单结论，只做本次项目级检查和实际执行前的动态项轻量检查。

## 先给判断

开头先给一句短判断：

```text
判断：这是{任务类型}，先走 {skill-name}，原因是{一句话}。
```

如果用户明确要实际生成，再补一句：

```text
执行：已有可提交提示词后交给 image-batch-agent；未指定模型时按 image-batch-agent 默认。
```

如果需要项目环境，再补一句：

```text
项目：先创建本次项目目录，原图、参考、提示词、确认图、成品、运行记录分别归档；工具检查通过后再执行。
```

## 调度地图

- 产品改图、精修、白底图、保持角度、保护结构、保护品牌区、多参考图改图指令：使用 `image-prompt-optimizer`。
- 模糊电商视觉想法、KV 概念、场景视觉、材质光线增强、高级产品氛围：使用 `super-image-prompt`；如果最终交付是改图指令，再回到 `image-prompt-optimizer` 格式。
- 实际生图、实际改图接口调用、保存输出、单图执行：使用 `image-batch-agent` 单图模式。
- 批量生图、批量改图、项目制批量、多张图片、先出确认图再跑全量：使用 `image-batch-agent` 批量模式。
- 产品视频、故事板、视频镜头提示词、TVC、视频内容顺序、视频卖点顺序：转给 `tvc-director`；如果只需要转化逻辑，使用 `ecom-video-conversion`；如果需要镜头或故事板，使用 `video-storyboard-prompts`。

## 项目环境部署

遇到以下情况时，先部署项目环境，再调度底层技能：

- 用户明确说项目制、批量、多张、整组、成套、先出确认图、批量生成。
- 用户明确要求实际生图、改图接口调用，并且后续会继续沉淀素材或多轮返修。
- 任务包含多类素材：原图、产品参考、场景参考、提示词、确认图、成品和运行记录。

部署前先读 `assets\verified-environment-checklist.md`：

- 清单匹配当前插件版本时，不重复检查插件结构、脚本存在性、Python、FFmpeg、Dreamina 和敏感信息扫描。
- 只检查本次项目目录、分类目录、输入文件、提示词 JSON 和输出路径。
- 实际调用接口前，再轻量确认 API 缓存和本次动态权限。
- 使用 Banana2 本地参考图公网 URL 前，再轻量确认 tunnel URL 可达。

默认项目根路径：

```text
F:\AI HOME\CODEX\image\outputs\批量改图项目\<项目名-时间戳>\
```

项目目录由 `image-batch-agent` 的 `scripts\init_project.py` 创建。必须保持三大入口目录兼容底层脚本，同时在 `输出` 内分出产物分类：

```text
<项目目录>\
  原图\
  参考\
  输出\
    提示词\
    确认图\
    成品\
    运行记录\
    临时\
```

归档规则：

- 待处理图片放 `原图`。
- 产品、材质、场景、风格、结构参考放 `参考`。
- 上游提示词、任务 JSON、提示词记录放 `输出\提示词`。
- 先出确认图放 `输出\确认图`。
- 用户确认后的正式结果放 `输出\成品`。
- `运行记录.json`、`运行记录.md`、错误记录、参数记录放 `输出\运行记录`。
- 中间裁切、压缩、临时转换文件放 `输出\临时`，不要混进成品。

## 工具检查与自动处理

进入实际生图、批量、项目制前，先检查：

- Python 是否可运行。
- `image-batch-agent\scripts\init_project.py` 是否存在。
- `image-batch-agent\scripts\generate_batch_images.py` 是否存在。
- 图片接口配置是否可读取：优先本机 `CODEX_HOME\dumik-team-plugin\api_settings.py`；没有时运行插件根目录 `scripts\init_api_cache.py` 初始化；仍没有时再读 `CODEX_HOME\config.toml`、`CODEX_HOME\auth.json` 和环境变量。
- Banana2 本地参考图需要公网 URL 时，检查 NAS 发布配置或临时 tunnel 脚本是否可用。

能自动修复的直接做：

- 缺项目目录：创建目录。
- 缺 `输出` 内分类：补齐分类。
- 缺 API 缓存但本机配置存在：运行 `scripts\init_api_cache.py`。
- 缺 Python 依赖且项目已有明确依赖文件或脚本报出缺失模块：用当前 Python 环境安装对应依赖，安装后重新验证。

不能自动处理时才停下来：

- 缺 API key / token。
- 本机没有可用公网参考图发布路径，且 Banana2 必须读取本地参考图。
- 安装工具需要登录、管理员权限或外部账号确认。

## 总监检查项

调度前先确认：

- 目标：主图 / 详情页 / 白底 / 场景图 / KV / 批量 / 实际出图。
- 画幅依据：用户指定 / 目标图 / 背景图 / 场景图 / 平台要求 / 待确认。
- 图片角色：目标图、产品参考、结构参考、材质参考、场景参考、动作参考。
- 产品保护：轮廓、比例、把手、盖子、五金、品牌区、SKU 关系。
- 输出形式：只要提示词 / 改图指令 / 直接生图 / 批量项目。

如果画幅或目标图无法从现有上下文判断，而底层任务必须依赖它，就先问最少的问题，再写最终改图指令。

## 调度规则

- 不在本技能里调用图片接口。
- 任务是现有产品图改图时，不要改写成泛用文生图提示词。
- 不静默改变产品结构、把手、盖子、五金、品牌区、轮廓或 SKU 比例。
- 用户明确说批量、多张、整组、项目制时，不要走单图模式。
- 用户只要文字提示词、brief 或改图指令时，不要转给 `image-batch-agent` 执行。

## 常见链路

产品改图：

```text
ecom-visual-director -> image-prompt-optimizer
```

高级产品场景：

```text
ecom-visual-director -> super-image-prompt -> image-prompt-optimizer
```

已有提示词并明确实际出图：

```text
ecom-visual-director -> image-batch-agent
```

批量电商图片：

```text
ecom-visual-director -> image-batch-agent 批量模式
```

电商视觉转产品视频：

```text
ecom-visual-director -> tvc-director -> ecom-video-conversion / video-storyboard-prompts / video-batch-agent
```
