# DUMIK 团队插件

这是给 DUMIK 团队共享的 Codex 插件包，保留本项目最核心的图片提示词、改图指令、单图生图/改图、明确批量时的批量改图、产品故事板、视频写作和批量生视频流程。

## 已收纳流程

- `image-prompt-optimizer`：图片改图、白底精修、多参考图、产品结构保护、可复制改图指令。
- `super-image-prompt`：把模糊视觉需求整理成更强的美术指导语言。
- `image-batch-agent`：统一承接实际生图和改图。默认单图模式；只有明确说批量、项目制批量或批量生成时才进入批量模式；生图前可选 `gpt-image-2` 或 `banana2`。
- `product-storyboard-video-prompts`：把产品资料整理成 Image2 产品身份板、产品故事板生图提示词和逐镜生视频提示词。
- `ecom-video-conversion`：先梳理电商视频的转化逻辑和卖点顺序。
- `sequential-storyboard-prompts`：写连续分镜、关键帧和视频 AI 序列提示词。
- `video-batch-agent`：项目制批量生视频，先建项目、写逐条视频提示词，先出确认片，确认后用 Dreamina CLI 批量提交。

## 团队使用建议

优先把任务说成真实工作目标，例如“这张锅图保留结构，改成天猫主图风格”“根据这些参考图写改图指令”“批量给这组图片写提示词”“把这个卖点写成 30 秒视频分镜”。

图片改图默认遵守本项目规则：先判断图片角色，锁定产品结构和品牌区域，明确比例和目标图，最终给可直接复制的中文改图指令。

所有图片和视频 skills 默认只交付文字提示词、brief、脚本或分镜，不自动生图、不自动生视频、不调用生成接口。只有明确要求“生图 / 出图 / 生成图片 / 调用接口 / 生成视频 / 调用即梦”时才进入实际生成。

## 钩子

`hooks/` 里放了团队默认触发规则：单张图片提示词任务优先走 `image-prompt-optimizer` 和 `super-image-prompt`；明确要求实际生图/改图时走 `image-batch-agent` 单图模式；明确批量时才走 `image-batch-agent` 批量模式；产品 Image2 故事板走 `product-storyboard-video-prompts`；普通视频脚本、分镜、镜头顺序任务优先走 `ecom-video-conversion` 和 `sequential-storyboard-prompts`；批量生视频走 `video-batch-agent`。

## 注意

插件不包含历史输出图片、临时项目、采集流程、个人缓存或 API Key。图片接口优先读取本机缓存：先运行 `scripts/init_api_cache.py`，它会从 `CODEX_HOME/config.toml` 和 `CODEX_HOME/auth.json` 读取可用 URL + key，写入本机 `CODEX_HOME/dumik-team-plugin/api_settings.py`。日常调用先读这个缓存；命令行显式参数可覆盖；没有缓存时再读 Codex 配置、环境变量，最后才用安全默认 URL。批量生视频需要本机已登录并可用的 `dreamina` CLI。

本机缓存只留在用户电脑，不进公开插件包；任何脚本都不能打印 key 或 token。

默认不自动生图。只有明确要求“生图 / 出图 / 生成图片 / 调用接口”时才调用图片接口；没有明确说批量时，默认按单图处理。

生图前先选模型：`gpt-image-2` 或 `banana2`。`banana2` 会提交为 `nano-banana-2`。

各 skill 版本号见 `assets/skill-versions.json`。
