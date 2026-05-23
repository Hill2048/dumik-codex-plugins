# DUMIK 团队插件

这是给 DUMIK 团队共享的 Codex 插件包，只保留本项目最核心的图片提示词、改图指令和视频写作流程。

## 已收纳流程

- `image-prompt-optimizer`：图片改图、白底精修、多参考图、产品结构保护、可复制改图指令。
- `super-image-prompt`：把模糊视觉需求整理成更强的美术指导语言。
- `ecom-video-conversion`：先梳理电商视频的转化逻辑和卖点顺序。
- `sequential-storyboard-prompts`：写连续分镜、关键帧和视频 AI 序列提示词。

## 团队使用建议

优先把任务说成真实工作目标，例如“这张锅图保留结构，改成天猫主图风格”“根据这些参考图写改图指令”“把这个卖点写成 30 秒视频分镜”。

图片改图默认遵守本项目规则：先判断图片角色，锁定产品结构和品牌区域，明确比例和目标图，最终给可直接复制的中文改图指令。

## 钩子

`hooks/` 里放了团队默认触发规则：图片任务优先走 `image-prompt-optimizer` 和 `super-image-prompt`；视频脚本、分镜、镜头顺序任务优先走 `ecom-video-conversion` 和 `sequential-storyboard-prompts`。

## 注意

插件不包含历史输出图片、临时项目、采集流程、批量生成脚本、额外图片生成工具或个人缓存。
