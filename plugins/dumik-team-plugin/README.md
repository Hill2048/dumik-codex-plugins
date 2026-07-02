# DUMIK 团队插件

这是给 DUMIK 团队共享的 Codex 插件包，保留本项目最核心的统一路由、电商视觉总监、TVC 总导演、项目入口协议、已检查清单、图片提示词、改图指令、单图生图/改图、明确批量时的批量改图、统一视频故事板、视频写作和批量生视频流程。

## 已收纳流程

- `D-init`：工作台初始化。新仓库/新电脑装好插件后跑一次，按模板生成入口文件（AGENTS.md、CLAUDE.md、CURRENT_PROJECT.md、CONTEXT.md），按需建第一个项目目录并做环境检查；只补缺不覆盖。
- `D-psb-install`：安装 PSB 智能对象工具。把内置 CEP 稳定版复制到 Adobe CEP 扩展目录，重启 Photoshop 后从「窗口 > 扩展功能（旧版）」打开。
- `ecom-visual-director`：电商视觉总监顶层入口，先按统一路由判断是否进入项目制，再统筹主图、详情页、白底精修、产品改图、KV、批量图片和实际生图链路。
- `tvc-director`：TVC 总导演顶层入口，先按统一路由判断是否进入项目制，再统筹电商视频、TVC、卖点顺序、故事板、连续分镜、逐镜提示词和批量生视频链路。
- `D-detail-plan`：详情页出图策略层，固化视觉设定，规划详情页结构、每卖点视觉证据和创意方向，是图片线对称于视频线 `D-video-plan` 的转化策划入口。
- `D-grid-prompt`：详情页发散层，两段式四宫格抽卡，段一 2x2 探方向、段二选中后展开全幅候选，引用视觉设定不重写 SKU。
- `D-detail-auto`：详情页批量出图的 Agent 模式编排器，完全在 Agent（Codex / Hermes）内跑，把策划、抽卡、生图、修复串成自动流水线；三个闸（方向 / 选片 / 终审）在对话里停等用户，校准回写视觉设定后再批量；进度写一份轻量 run-state 到运行记录用于断点续跑，不接前端、不起桥服务。（早期的本地桥 + BatchRefiner 前端方案已归档到 `archive/bridge-frontend-legacy/`。）
- `D-image-repair`：抽卡选片后的细节修复质量门，诊断漂移的产品细节，给局部切图指引，再用 banana2 加产品白底图作参考写局部修复提示词。
- `D-image-prompt`：图片提示词唯一入口，双模式。改图模式：白底精修、多参考图、产品结构保护、可复制改图指令；brief 模式：KV 概念、场景母体、材质光影、人像皮肤，把模糊视觉需求整理成美术指导语言（原 `super-image-prompt` 已并入，归档在 `archive/super-image-prompt-merged/`）。
- `D-image-run`：统一承接实际生图和改图。默认单图模式；只有明确说批量、项目制批量或批量生成时才进入批量模式；生图前可选 `gpt-image-2` 或 `banana2`。
- `D-video-plan`：先梳理电商视频的转化逻辑和卖点顺序。
- `D-storyboard`：统一产品故事板、Image2 身份板、连续分镜、关键帧和逐镜生视频提示词。
- `D-video-run`：项目制批量生视频，先建项目、写逐条视频提示词，先出确认片，确认后用 Dreamina CLI 批量提交。

## 流程地图

- Markdown 版：`assets/workflow-map.md`
- 可视化版：`assets/workflow-map.html`
- Agent 路由：`assets/agent-skill-routing.md`
- 项目入口与环境协议（唯一来源）：`assets/project-env-protocol.md`
- 已检查清单：`assets/verified-environment-checklist.md`
- PSB 智能对象工具：`assets/psb-smart-object-tools/`

## 团队使用建议

优先把任务说成真实工作目标，例如“这张锅图保留结构，改成天猫主图风格”“根据这些参考图写改图指令”“批量给这组图片写提示词”“把这个卖点写成 30 秒视频分镜”。

图片改图默认遵守本项目规则：先判断图片角色，锁定产品结构和品牌区域，明确比例和目标图，最终给可直接复制的中文改图指令。

所有图片和视频技能默认只交付文字提示词、brief、脚本或分镜，不自动生图、不自动生视频、不调用生成接口。只有明确要求“生图 / 出图 / 生成图片 / 调用接口 / 生成视频 / 调用即梦”时才进入实际生成。进入项目制或批量执行前，先按 `assets/agent-skill-routing.md` 确认项目入口：已有当前项目就沿用，没有当前项目就问项目名，用户也可以切换项目或本次不进入项目。

## 钩子

`hooks/` 只保留团队默认触发提示；完整路由以 `assets/agent-skill-routing.md` 为准。电商图片和视觉任务先走 `ecom-visual-director`；视频、TVC、分镜和生视频任务先走 `tvc-director`；底层再按任务分别交给对应技能。

## 注意

插件不包含历史输出图片、临时项目、采集流程、个人缓存或 API Key。图片接口优先读取本机缓存：先运行 `scripts/init_api_cache.py`，它会从 `CODEX_HOME/config.toml` 和 `CODEX_HOME/auth.json` 读取可用 URL + key，写入本机 `CODEX_HOME/dumik-team-plugin/api_settings.py`。日常调用先读这个缓存；命令行显式参数可覆盖；没有缓存时再读 Codex 配置、环境变量，最后才用安全默认 URL。批量生视频需要本机已登录并可用的 `dreamina` CLI。

本机缓存只留在用户电脑，不进公开插件包；任何脚本都不能打印 key 或 token。

默认不自动生图。只有明确要求“生图 / 出图 / 生成图片 / 调用接口”时才调用图片接口；没有明确说批量时，默认按单图处理。

生图前先选模型：`gpt-image-2` 或 `banana2`。`banana2` 会提交为 `nano-banana-2`。

各 skill 版本号见 `assets/skill-versions.json`。
