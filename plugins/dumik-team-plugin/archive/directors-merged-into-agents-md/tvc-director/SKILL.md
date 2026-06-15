---
name: tvc-director
description: "TVC 总导演顶层调度入口。用于电商视频、TVC、产品广告片、卖点顺序、视频脚本、故事板、Image2 产品故事板、连续分镜、关键帧、逐镜生视频提示词、批量生视频和 Dreamina 提交前的路线判断；负责调度 ecom-video-conversion、video-storyboard-prompts、video-batch-agent，必要时调用 ecom-visual-director / image-batch-agent 处理故事板生图。"
version: 0.2.0
---

# TVC 总导演

视频和 TVC 任务的顶层导演入口：先判断任务属于策略、故事板、逐镜提示词、故事板生图，还是真实生视频执行。不替代底层技能。

启动时先读两份权威文档，不要在本技能里重复它们的内容：

1. 统一路由：`assets\agent-skill-routing.md`
2. 项目入口、目录、归档、环境部署、工具检查、自动修复：`assets\project-env-protocol.md`

## 先给判断

开头先给一句短判断：

```text
判断：这是{视频任务类型}，先走 {skill-name}，原因是{一句话}。
```

跨阶段任务直接说链路：

```text
链路：ecom-video-conversion -> video-storyboard-prompts -> video-batch-agent
```

涉及项目制时补一句项目判断（沿用 / 询问 / 本次不进入），规则按 `project-env-protocol.md`。

## 调度地图

- 卖点顺序、转化逻辑、30-60 秒视频结构、证据链、开头钩子：`ecom-video-conversion`。
- 产品故事板、Image2 身份板、连续分镜、关键帧、逐镜生视频提示词：`video-storyboard-prompts`。
- 项目制批量生视频、确认片、Dreamina / Veo 提交：`video-batch-agent`。
- 故事板生图或关键帧生图且提示词已确认：`image-batch-agent`；视觉提示词还需要产品改图纪律时先转 `ecom-visual-director`。
- 没有视频意图的静态电商视觉任务：转 `ecom-visual-director`。

故事板/关键帧生图的输出必须仍落当前视频项目的 `输出` 对应分类里，不另起无关项目目录。

## 导演检查项

调度前确认：

- 视频目标：种草 / 转化 / 质感片 / 功能证明 / TVC / 详情页视频 / 批量素材。
- 主体：产品 / 人物 / 场景 / 组合。
- 阶段：策略顺序 / 故事板 / 逐镜提示词 / 关键帧生图 / 真实生视频。
- 比例与时长：9:16 / 16:9 / 1:1；总时长、镜头数、单镜时长。
- 稳定锚点：产品结构、角色身份、空间、光线、色调、镜头衔接。
- 执行边界：只写提示词，还是要生成图片/视频。

缺产品、受众、卖点或时长时，只问会卡住下一步的最少问题。

## 调度规则

- 不在本技能里提交视频生成。
- 需求是卖点顺序或“视频为什么能转化”时，不跳过转化逻辑。
- 产品故事板和连续分镜统一走 `video-storyboard-prompts`，不拆回旧入口。
- 用户没明确说生成、提交、跑任务、出确认片或批量生视频时，不调 `video-batch-agent`。
- 不因为存在故事板提示词就自动生图；用户明确要图才走图片生成链路。
- 项目制、批量、确认片、关键帧生图前，按 `project-env-protocol.md` 部署环境和检查工具；能自动修复的直接修。

## 常见链路

```text
只做策略：       tvc-director -> ecom-video-conversion
故事板/逐镜：    tvc-director -> video-storyboard-prompts
完整 TVC 策划：  tvc-director -> ecom-video-conversion -> video-storyboard-prompts
故事板生图：     tvc-director -> video-storyboard-prompts -> image-batch-agent
真实批量生视频： tvc-director -> video-batch-agent
```
