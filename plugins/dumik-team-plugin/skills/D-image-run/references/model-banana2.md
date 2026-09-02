# Banana 系列参数规范

适用模型：Banana2、Banana Pro。请求结构按 G-AISC Gemini 原生接口执行。

使用时机：用户明确说用 `banana`、`banana2`、`bananapro` 或 `Banana Pro`，或上游明确要求 Banana 系列生成 / 改图。

## 模型路由

用户不需要说完整模型名，脚本按别名路由：

| 用户意图 | 实际提交模型 | 默认输出 |
| --- | --- | --- |
| `banana` / `banana2` | `gemini-3.1-flash-image-preview` | `2K` |
| `bananapro` / `banana-pro` | `gemini-3-pro-image-preview` | `2K` |

如果用户没有指定任何模型，整个普通生图 skill 默认使用 `banana2`，即 `gemini-3.1-flash-image-preview`。

## 调用入口

Juaihub 与 808Relay 的客户端发包格式相同，只替换 Base URL 和 Key；不能因供应商变化改成 Image2 的 OpenAI 格式。

- 接口形态：`POST {base}/v1beta/models/{model}:generateContent`
- 默认 Base URL：`https://sub.juaihub.cn`。另已验证 `https://api.juaihub.cn`、`https://api.808relay.com`；只有用户明确指定时才切换。Base URL 不要改成 `/v1/images/generations`。
- 鉴权：`Authorization: Bearer <API_KEY>`
- 请求头：`Content-Type: application/json`
- Base URL 和 Key 读取仍按团队规则：优先本机缓存、再读 Codex 配置 / auth、最后环境变量；不要写死文档示例 URL 或打印 key。

## 请求结构

```json
{
  "contents": [
    {
      "role": "user",
      "parts": [
        { "text": "完整中文提示词" },
        {
          "inlineData": {
            "mimeType": "image/png",
            "data": "参考图 base64"
          }
        }
      ]
    }
  ],
  "generationConfig": {
    "responseModalities": ["TEXT", "IMAGE"],
    "imageConfig": {
      "aspectRatio": "1:1",
      "imageSize": "2K"
    }
  }
}
```

## 字段规则

- `model`：放在 URL path 中，不放进 JSON body。
- `contents[].parts[].text`：完整中文提示词或改图指令。
- `contents[].parts[].inlineData`：参考图；本地图片、data URL 和公网图都转成 `mimeType + base64 data`。纯文生图不传这一项。
- `generationConfig.responseModalities`：图片任务固定 `['TEXT', 'IMAGE']`。
- `generationConfig.imageConfig.aspectRatio`：脚本从 `1:1`、`3:2`、`2:3`、`3:4`、`1:4`、`4:1`、`4:3`、`4:5`、`5:4`、`1:8`、`8:1`、`9:16`、`16:9`、`21:9`、`9:21` 中选择最接近目标尺寸的一项。
- `generationConfig.imageConfig.imageSize`：默认 `2K`；明确 4K 输出时写 `4K`；小尺寸才写 `1K`。
- Banana 系列的 `output_size` 用来选择比例和 `imageSize` 档位，不承诺返回精确像素；脚本会记录实际尺寸，并校验返回比例不能明显偏离请求比例。
- 参考图改图：目标图和参考图按 `contents[].parts[]` 顺序分别作为多个 `inlineData` 部分发送，不能放进 `images`、`image` 或 multipart 字段。
- 多张候选：每张图使用独立 `count: 1` 请求；需要并发时只并发任务行，不把多张候选合并到一个请求里。
- 返回图片可能是 PNG 或 JPEG，统一从 Gemini 响应的 inline data 解码保存，不按文件扩展名判断格式。

## 返回结构

成功返回通常包含：

```json
{
  "candidates": [
    {
      "content": {
        "role": "model",
        "parts": [
          {
            "inlineData": {
              "mimeType": "image/png",
              "data": "生成图 base64"
            }
          }
        ]
      }
    }
  ]
}
```

团队脚本读取 `candidates[].content.parts[].inlineData.data` 并保存图片，同时兼容其他 base64 或 URL 字段。

## 默认建议

- 普通单图：`output_size` 不填，脚本默认请求 `2048x2048`，Banana 参数为 `aspectRatio: 1:1`、`imageSize: 2K`。
- 故事板：`output_size` 用 `2160x3840` 或 `3840x2160`，让脚本写入对应比例和 `4K`。
- 批量多候选：拆成多条 row，每条 `count: 1`，不要依赖一个 row 里多张返回。

## 禁止混用

- 不要给 Banana2 传 Image2 的 `quality`、`response_format`、`n`、`size`。
- 不要再传旧链路的顶层 `model`、`prompt`、`images`、`aspectRatio`、`imageSize`、`replyType`。
- 不要把本规范套到 `gpt-image-2`。

## 供应商差异边界

- 客户端层面：Juaihub 与 808Relay 使用相同的 URL 路径、JSON body、参考图编码、鉴权头和响应解析。
- 服务端层面：供应商内部可能有不同的排队、重试、上游转发或响应大小限制；不能把供应商耗时写成 Gemini 的确定行为。
- 出现 `image result exceeds 20971520 bytes` 时记录为供应商转换失败，不伪装成成功。

## 来源

- G-AISC Gemini 文档：`https://qwe.g-aisc.com/docs`。
- Gemini 3.1 Flash Image (Nano Banana 2) 官方文档：`https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/gemini/3-1-flash-image`
