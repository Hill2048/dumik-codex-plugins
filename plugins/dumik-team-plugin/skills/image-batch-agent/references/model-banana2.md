# Banana 系列参数规范

适用模型：Banana2、Banana2 VIP、Banana Pro、Banana Pro VIP。除模型名和自动路由外，其他参数按 Apifox 文档执行。

使用时机：用户明确说用 `banana`、`banana2`、`bananapro`、`Banana Pro` 或 `VIP`，或上游明确要求 Banana 系列生成 / 改图。

## 模型路由

用户不需要说具体分辨率模型名，脚本按需求自动路由：

| 用户意图 | 实际提交模型 | 默认输出 |
| --- | --- | --- |
| `banana` / `banana2` | `nano-banana-2` | `2K` |
| `banana-vip` / `banana2-vip`，普通 2K 任务 | `nano-banana-2-vip-2k` | `2K` |
| `banana-vip` / `banana2-vip`，明确 4K / 故事板 4K | `nano-banana-2-vip-4k` | `4K` |
| `bananapro` / `banana-pro` | `nano-banana-pro` | `2K` |
| `bananapro-vip` / `banana-pro-vip` | `nano-banana-pro-vip` | `2K` |

如果用户没有指定任何模型，整个生图 skill 默认使用 `gpt-image-2`，不是 Banana。

## 调用入口

- 接口形态：`POST {base}/v1/images/generations`
- 鉴权：`Authorization: Bearer <API_KEY>`
- 请求头：`Content-Type: application/json`
- Base URL 和 Key 读取仍按团队规则：优先本机缓存、再读 Codex 配置 / auth、最后环境变量；不要写死文档示例 URL 或打印 key。

## 请求结构

```json
{
  "model": "按路由得到的实际 Banana 模型名",
  "prompt": "完整中文提示词",
  "images": [
    "https://example.com/input.png"
  ],
  "aspectRatio": "1:1",
  "imageSize": "2K",
  "replyType": "json"
}
```

## 字段规则

- `model`：由脚本按上面的模型路由决定。
- `prompt`：必填，传完整中文提示词或改图指令。
- `images`：图片参考数组。
  - 文生图时传空数组 `[]`。
  - 公网图片 URL 原样传入。
  - 本地图片由团队脚本先发布到 NAS 公网链路，验通后把公网 URL 传入。
  - 如果 NAS 公网 URL 验证失败，任务必须在提交 Banana2 前失败。
- `aspectRatio`：由 `output_size` 自动换算，当前脚本输出 `1:1`、`16:9`、`9:16`、`4:3`、`3:4` 中最接近的一种。
- `imageSize`：默认 `2K`；明确 4K 输出时写 `4K`；小尺寸才写 `1K`。
- `replyType`：固定 `json`。

## 返回结构

成功返回通常包含：

```json
{
  "id": "generate_xxx",
  "model": "nano-banana-2",
  "object": "image.generation",
  "created": 1764215996,
  "results": [
    {
      "url": "https://..."
    }
  ],
  "status": "succeeded"
}
```

团队脚本会优先读取 `results[].url` 并下载图片；如果服务返回 base64 或其他 URL 字段，也会尽量兼容解析。

## 默认建议

- 普通单图：`output_size` 不填，脚本默认请求 `2048x2048`，Banana 参数为 `aspectRatio: 1:1`、`imageSize: 2K`。
- 故事板：`output_size` 用 `2160x3840` 或 `3840x2160`，让脚本写入对应比例和 `4K`。
- 批量多候选：拆成多条 row，每条 `count: 1`，不要依赖一个 row 里多张返回。

## 禁止混用

- 不要给 Banana2 传 Image2 的 `quality`、`response_format`、`n`、`size`。
- 不要给 Banana2 传 Gemini `contents`、`parts`、`generationConfig`、`imageConfig`。
- 不要把本规范套到 `gpt-image-2`。

## 来源

- 本机实测：`https://api.juaihub.cn/v1/images/generations` 支持 `nano-banana-2`、`images`、`aspectRatio`、`imageSize`、`replyType`。
- Apifox Banana2 文档：`https://qmy27nhsd9.apifox.cn/452392911e0`
