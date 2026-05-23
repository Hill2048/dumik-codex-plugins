# DUMIK 团队核心流程地图

## 图片改图

入口：`image-prompt-optimizer`，必要时叠加 `super-image-prompt`。

适合：图片改图、白底精修、角度保持、结构保护、多参考图融合、品牌文字修正。

## 高级视觉语言

入口：`super-image-prompt`，最终改图交付仍回到 `image-prompt-optimizer` 格式。

适合：把模糊需求转成可执行的美术指导语言，补齐场景母体、主角关系、材质、光线和真实质感。

## 视频写作

入口：`ecom-video-conversion`、`sequential-storyboard-prompts`。

适合：电商视频卖点顺序、30 秒到 60 秒视频结构、连续分镜、关键帧和视频 AI 序列提示词。
