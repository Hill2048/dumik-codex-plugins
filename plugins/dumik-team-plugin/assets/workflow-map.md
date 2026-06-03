# DUMIK 团队核心流程地图

## 图片改图

入口：`image-prompt-optimizer`，必要时叠加 `super-image-prompt`。

适合：图片改图、白底精修、角度保持、结构保护、多参考图融合、品牌文字修正。默认只写提示词或改图指令，不调用生图工具。

## 高级视觉语言

入口：`super-image-prompt`，最终改图交付仍回到 `image-prompt-optimizer` 格式。

适合：把模糊需求转成可执行的美术指导语言，补齐场景母体、主角关系、材质、光线和真实质感。默认只交付文字 brief。

## 图像生成编辑

入口：`image-batch-agent` 单图模式。

适合：用户明确要求生图、出图、生成图片、编辑图片或调用接口，且没有明确说批量时，通过图片接口生成或编辑单张图片。生图前先选 `gpt-image-2` 或 `banana2`。用户只要提示词、brief 或改图指令时不要调用接口。

## 批量改图

入口：`image-batch-agent`。

适合：用户明确说批量、多张、整组、项目制或批量生成时，先建项目文件夹，提交上游已准备的逐图提示词。默认不生图；只有明确要求生图/出图/调用接口时，才先选模型、出确认图，确认后再批量生成；出图时支持 `output_size`、`--image-model` 和 `--concurrency`。

## 视频写作

入口：`ecom-video-conversion`、`video-storyboard-prompts`。

适合：电商视频卖点顺序、30 秒到 60 秒视频结构、连续分镜、关键帧和视频 AI 序列提示词。默认只写脚本和提示词，不调用视频生成工具。

## 视频故事板与分镜提示词

入口：`video-storyboard-prompts`。

适合：用户明确要求产品故事板、Image2 故事板、产品身份板、连续分镜、关键帧、视频 AI 序列提示词或逐镜生视频提示词时使用。内部按 product / sequential / hybrid 模式处理；需要卖点顺序时仍先用 `ecom-video-conversion`。

## 批量生视频

入口：`video-batch-agent`。

适合：项目制批量生视频，先确认需求和输出路径，创建中文项目文件夹，让用户放首帧/分镜图/参考素材；先出 1 条确认片，确认后用 Dreamina CLI 批量提交。
