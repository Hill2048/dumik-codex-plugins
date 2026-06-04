# DUMIK 图片与视频任务默认提示

完整路由只看：

```text
assets/agent-skill-routing.md
```

本文件只提醒三件事：

- 图片主线先走 `ecom-visual-director`。
- 视频旁路先走 `tvc-director`。
- 默认只交付文字；只有用户明确要求生成、出图、提交或调用接口时，才进入执行 agent。
