# DUMIK 团队插件钩子

当前插件校验不接受在 `plugin.json` 里声明 `hooks` 字段，所以这里用目录保存团队默认钩子规则，供安装后合并到项目级指令或团队默认上下文。

## 触发点

- 会话启动或上下文压缩后：确认本插件只使用 DUMIK 插件内 skills。
- 电商图片、主图、详情页、白底、产品改图、KV、批量图片或实际生图任务前：先用 `ecom-visual-director` 做顶层判断，再调度图片类底层 skills。
- TVC、电商视频、卖点顺序、故事板、连续分镜、逐镜提示词、关键帧或批量生视频任务前：先用 `tvc-director` 做顶层判断，再调度视频类底层 skills。
- 图片改图执行前：由 `ecom-visual-director` 调度 `image-prompt-optimizer` 判断图片角色、比例、目标图和锁定范围。
- 视觉语言增强时：由 `ecom-visual-director` 调度 `super-image-prompt` 提升场景、材质、光线和真实质感表达。
- 明确要求生图、出图、生成图片、编辑图片或调用接口时：由 `ecom-visual-director` 调度 `image-batch-agent` 单图模式；生图前选择 `gpt-image-2` 或 `banana2`；优先读本机 `CODEX_HOME/dumik-team-plugin/api_settings.py` 缓存。
- 批量改图任务前：由 `ecom-visual-director` 判断批量意图，再用 `image-batch-agent` 批量模式建项目、提交上游已准备的逐图提示词；明确实际出图时先选模型、再出确认图。
- 视频故事板、产品故事板、连续分镜、关键帧和逐镜视频提示词任务前：由 `tvc-director` 调度 `video-storyboard-prompts`，内部按 product / sequential / hybrid 模式处理。
- 视频转化顺序任务前：由 `tvc-director` 调度 `ecom-video-conversion` 梳理卖点顺序，再用 `video-storyboard-prompts` 写镜头和序列提示词。
- 批量生视频任务前：由 `tvc-director` 调度 `video-batch-agent` 建项目、写逐条视频提示词、先出确认片，确认后再批量提交。
- 最终交付改图指令时：仍以 `image-prompt-optimizer` 的格式为准。
- 所有图片和视频流程默认停在文字交付；只有用户明确要求实际生成时才调用生成工具。
