# Image2 参数规范

适用模型：`gpt-image-2`。

使用时机：用户明确选择 `gpt-image-2`，或需要走 OpenAI-compatible `/images/generations`、`/images/edits` 图像接口。

## 调用入口

- 文生图：`POST {base}/v1/images/generations`
- 改图 / 多参考图：`POST {base}/v1/images/edits`
- 鉴权：`Authorization: Bearer <API_KEY>`
- 文生图请求体：JSON。
- 改图请求体：multipart，图片字段名为 `image`，可传多张。
- Base URL 和 Key 读取仍按团队规则：优先本机缓存、再读 Codex 配置 / auth、最后环境变量；不要写死文档示例 URL 或打印 key。

## 文生图请求结构

```json
{
  "model": "gpt-image-2",
  "prompt": "完整中文提示词",
  "n": 1,
  "size": "2048x2048",
  "quality": "high",
  "response_format": "b64_json"
}
```

## 改图请求结构

```text
model=gpt-image-2
prompt=完整中文改图指令
n=1
size=2048x2048
quality=high
response_format=b64_json
image=@目标图.png
image=@参考图.png
```

## 尺寸规则

当前团队脚本按 Image2 自定义尺寸规则校验：

- 宽高都必须是 `16` 的倍数。
- 单边不超过 `3840`。
- 宽高比必须在 `1:3` 到 `3:1` 之间。
- 总像素必须在 `655360` 到 `8294400` 之间。
- `9:16` 4K 固定用 `2160x3840`。
- `16:9` 4K 固定用 `3840x2160`。
- 故事板默认整张优先 `9:16 2160x3840`，每格分镜可按 `3:4` 构图。
- 普通单图和普通批量默认用 `2048x2048`。

常用值：

- `2048x2048`：默认 2K 方图。
- `1024x1024`：小尺寸预览，只有用户明确要求时使用。
- `3840x2160`：16:9 故事板 / 横版主图。
- `2160x3840`：9:16 故事板 / 竖版主图。

## quality

- 当前团队脚本按 gpt-image-2 Skill 指南固定使用 `high`。
- 需要更快预览时可后续扩展为 `medium`，但不要在主流程里静默降级。

## response_format

- 当前团队脚本固定请求 `b64_json`，收到后直接保存为本地图片。
- 如果接口返回 URL，脚本也会下载，但不要依赖 URL 作为主路径。

## 参考图规则

- `file` 是目标图。
- `reference_files` 是附加参考图。
- 文生图不要传 `image`。
- 改图时必须确认每张图角色，提示词里写清“目标图”“结构参考”“风格参考”等。

## 禁止混用

- 不要给 Image2 传 Banana2 的 `generationConfig`、`imageConfig`、`responseModalities`。
- 不要把 `imageSize: 4K` 当作 Image2 参数；Image2 用 `size: 宽x高`。
- 不要用 `count > 1` 做批量候选；拆成多条 row。

## 来源

- gpt88 Codex gpt-image-2 Skill 指南：`https://doc.gpt88.cc/docs/guides/codex-gpt-image-2-skill/`
- gpt88 Images API 文档：`https://doc.gpt88.cc/docs/api/images/`
