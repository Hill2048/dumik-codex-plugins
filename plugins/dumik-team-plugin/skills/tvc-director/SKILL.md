---
name: tvc-director
description: "TVC 总导演顶层调度入口。用于电商视频、TVC、产品广告片、卖点顺序、视频脚本、故事板、Image2 产品故事板、连续分镜、关键帧、逐镜生视频提示词、批量生视频和 Dreamina 提交前的路线判断；负责调度 ecom-video-conversion、video-storyboard-prompts、video-batch-agent，必要时调用 ecom-visual-director / image-batch-agent 处理故事板生图。"
version: 0.1.1
---

# TVC 总导演

这个技能是视频和 TVC 任务的顶层导演入口：先判断任务属于策略、故事板、逐镜提示词、故事板生图，还是真实生视频执行。

不要替代底层技能。先选对路线，再按对应底层技能的规则执行。

## 先给判断

开头先给一句短判断：

```text
判断：这是{视频任务类型}，先走 {skill-name}，原因是{一句话}。
```

如果任务跨多个阶段，直接说明链路：

```text
链路：ecom-video-conversion -> video-storyboard-prompts -> video-batch-agent
```

## 调度地图

- 卖点顺序、转化逻辑、30 到 60 秒电商视频结构、证据链、开头钩子：使用 `ecom-video-conversion`。
- 产品故事板、Image2 身份板、Image2 产品故事板提示词、连续分镜、关键帧、逐镜生视频提示词：使用 `video-storyboard-prompts`。
- 项目制批量生视频、确认片、Dreamina 提交、多条视频提示词执行：使用 `video-batch-agent`。
- 故事板生图或关键帧生图，且提示词已确认：使用 `image-batch-agent`；如果视觉提示词还需要产品改图纪律，先转给 `ecom-visual-director`。
- 没有视频意图的静态电商视觉任务：转给 `ecom-visual-director`。

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
