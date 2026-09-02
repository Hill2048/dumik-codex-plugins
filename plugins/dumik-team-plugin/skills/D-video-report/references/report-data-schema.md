# 拉片报告数据协议

报告网页只读取 `window.videoReportData`。先按本协议写 `report-data.json`，再运行构建脚本，不手写重复 HTML。

## 必填

- `title`：报告名称。
- `shots[]`：逐镜数组。
- `shots[].id`：稳定且唯一，使用 `shot-01` 格式。
- `shots[].title`：镜头名称。
- `shots[].start` / `end`：秒数。
- `shots[].frames[]`：关键帧；逐镜报告默认 A/B 两张。
- `shots[].frames[].src`：相对 `index.html` 的图片路径。
- `shots[].frames[].time`：点击后跳转的精确秒数。

## 推荐

- `summary`：一句话结论。
- `video.src` / `video.poster`：原片与封面相对路径。
- `metrics`：时长、分辨率和证据数量。
- `chapters[]`：结构导航；`id` 必须对应镜头 ID。
- `shots[].purpose` / `note` / `key`：镜头任务、分析和关键标记。
- `transcript[]`：`start`、`end`、`text`。
- `findings[]`：可复用结论。
- `uncertainties[]`：无法从证据确认的内容。
- `sourceNote`：字幕、转写和画面证据来源。

完整形状见 `report-data.example.json`。
