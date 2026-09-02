# 图片 API 固定基准

## 测试目的

使用同一组双参考改图任务，检查图片 API 的：

- 模型是否可用；
- `1K / 2K / 4K` 是否被真实执行；
- `1:1 / 3:4 / 16:9` 是否返回正确比例；
- 单张耗时、平均值、中位数和异常慢请求；
- 是否正确替换食材，同时保持锅、锅铲、手、机位和厨房环境。

## 固定资产

- `assets/image-edit-cookware/image1-target.png`：目标图，锅内原有青椒炒肉。
- `assets/image-edit-cookware/image2-reference.png`：菜品参考图，已炒好的番茄炒蛋。

不要用临时目录里的原图替代这两张固定资产。

## 固定提示词

每个比例只替换第一行比例，正文不变：

```text
比例：<1:1 | 3:4 | 16:9>

image1：目标图，锁定炒锅、锅铲、手部、机位与厨房环境。
image2：菜品参考，只控制番茄炒蛋的食材形态、色泽与熟度。

以 image1 为目标图做局部食材替换，保持 image1 的炒锅结构、灰色不粘锅内壁、锅铲位置、右侧手部、俯拍角度、裁切、灶台和背景不变。将锅内全部青椒炒肉替换为 image2 中已经炒好的番茄炒蛋：金黄柔嫩的炒蛋块、熟透但保持块状的红色番茄、少量自然橙红汤汁，按照 image1 原有锅内面积和翻炒分布自然铺在锅底，食材与锅面接触真实，锅铲仍处于翻炒动作，食材的透视、光线、景深和清晰度与 image1 完全一致。

约束：不要保留青椒或肉丝；不要复制 image2 的白盘、桌面和背景；不要改变锅体、锅铲、手、灶台和相机角度；不要新增文字、水印或无关食材。
```

## 固定矩阵

每个模型独立执行以下 9 项，每项 `count: 1`：

| 档位 | 1:1 请求尺寸 | 3:4 请求尺寸 | 16:9 请求尺寸 |
| --- | --- | --- | --- |
| 1K | 1024x1024 | 768x1024 | 1024x576 |
| 2K | 2048x2048 | 1536x2048 | 2048x1152 |
| 4K | 4096x4096 | 3072x4096 | 4096x2304 |

默认测试模型：

- Flash：`gemini-3.1-flash-image-preview`
- Pro：`gemini-3-pro-image-preview`

模型可按供应商实际名称覆盖，但报告必须记录真实提交名。

## 执行

PowerShell：

```powershell
$env:DUMIK_API_TEST_KEY = "<本次测试密钥>"
python scripts\run_image_benchmark.py `
  --base-url "https://example.com" `
  --models flash pro `
  --concurrency 3 `
  --model-timeout-seconds 1800 `
  --output-dir "<报告目录>"
Remove-Item Env:DUMIK_API_TEST_KEY
```

只检查任务单，不发请求：

```powershell
python scripts\run_image_benchmark.py `
  --base-url "https://example.com" `
  --models flash pro `
  --output-dir "<报告目录>" `
  --dry-run
```

## 判定

技术通过：

- HTTP 请求成功且保存一张可解码图片；
- 图片不是空白图；
- 实际比例与目标比例误差不超过 3%；
- 运行记录包含真实像素和耗时。

人工画面复核：

- 锅内青椒和肉丝已全部替换为番茄炒蛋；
- 没有复制参考图的白盘和背景；
- 锅体、锅铲、手、机位和厨房环境基本保持；
- 没有新增水印、乱码或明显结构变形；
- 高分辨率不是单纯放大，细节应随档位提升。

正式选型不要只看平均速度：先看成功率，再看中位数和最慢请求，最后看画面通过率。
