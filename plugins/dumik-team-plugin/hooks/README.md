# DUMIK 团队插件钩子

当前插件校验不接受在 `plugin.json` 里声明 `hooks` 字段，所以这里用目录保存团队默认钩子规则，供安装后合并到项目级指令或团队默认上下文。

## 触发点

- 会话启动或上下文压缩后：确认本插件只使用图片和视频写作核心 skills。
- 图片改图任务前：先用 `image-prompt-optimizer` 判断图片角色、比例、目标图和锁定范围。
- 视觉语言增强时：再用 `super-image-prompt` 提升场景、材质、光线和真实质感表达。
- 明确要求生图、出图、生成图片、编辑图片或调用接口时：使用 `imagegen`，且需要本机 `JUAIHUB_API_KEY`。
- 批量改图任务前：用 `image-batch-agent` 建项目、写逐图提示词；只有用户明确要求生图/出图/调用接口时才先出确认图。
- 产品 Image2 故事板任务前：用 `product-storyboard-video-prompts` 输出产品身份板、故事板生图提示词和逐镜生视频提示词。
- 视频写作任务前：先用 `ecom-video-conversion` 梳理卖点顺序，再用 `sequential-storyboard-prompts` 写镜头和序列提示词。
- 最终交付改图指令时：仍以 `image-prompt-optimizer` 的格式为准。
- 所有图片和视频流程默认停在文字交付；只有用户明确要求实际生成时才调用生成工具。
