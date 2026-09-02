# 固定模板库

合并自原 `super-image-prompt`。主文件给规则，这里给可直接套用的大块模板。只换主体、场景、产品细节，不改结构。

## 抽象词翻译表

把空话翻成可见画面语言：

- “高级感” -> 受控的光线方向、主体与背景干净分离、克制的高光、背景层次不抢主体。
- “自然融合” -> 透视一致、色温一致、接触阴影、台面反射、边缘光一致。
- “更有质感” -> 写光打在材质上的可见表现，不是只报材质名。
- “产品更清楚” -> 主体明亮可读、轮廓清晰、有边缘光、背景比主体暗或安静。
- “不要像贴上去的” -> 物体接触台面、有重量感、投影、台面反射、同一相机角度。
- “电影感氛围” -> 背景可以暗，但产品必须保留可读边缘和有意图的高光。
- “构图干净” -> 视觉主角明确、道具只做支撑、留白服务呼吸感或文案位。

## 摄影 brief 顺序

画质要求高时按摄影师语言写：

1. 场景母版：材质、颜色、背景纵深、台面或环境。
2. 主体层级：第一视觉中心、次级支撑元素、负空间。
3. 空间关系：前景、中景、背景、接触点、支撑、遮挡、比例。
4. 相机：平视、低角度、俯视、特写、长焦、广角透视、灭点；光圈只在有用时写。
5. 光线三段式：光位（从哪来）、光质（软硬、羽化、窄光、漫射、方向性）、光的功能（揭示主体、分离边缘、塑形、制造反射、压暗背景）。
6. 材质响应：该表面在这种光下做什么。
7. 风险收口：短、具体、有限。

## 材质语言（光学行为写法）

- 镜面不锈钢：大块银白高光、干净反射区、曲面金属纵深、受控边缘阴影。
- 拉丝金属：细密方向性纹理、柔和线状高光，不是划痕不是脏。
- 钛：克制银灰、低饱和、冷调反射、轻但结实的工业感。
- 哑光塑料：细微纹理、柔和漫反射，高级时写干净暖白或象牙白。
- 玻璃：通透边缘、真实折射、受控镜面高光，不发雾不像塑料。
- 石材台面：细微孔隙、表面重量感、接触阴影、抛光处有柔和反射。
- 3D 金属文字：真实厚度、倒角、接触阴影、台面反射、与场景同透视同光向。

不要停在“高质量”“质感好”；写可见效果。

## 镜面不锈钢炊具专项

- 避免碎乱细反射线；主语言是宽大、连续、干净的高光块。
- 高光可以亮，但不能死白：高光内部保留窗光渐变、台面反射、明暗柔和过渡和曲面纵深。
- 白区不塌成平白块：保留灰阶变化、弧面过渡、微小环境反射。
- 黑区不塌成死黑块：保留低对比反射、边缘分离、暗部体积。
- 减少细碎反射线、划痕状条纹、水波纹噪点、密集碎高光。
- 原图反射乱时，改写成场景化反射：宽窗光带、克制的台面剪影、柔和环境形状、受控边缘阴影。
- 暗调场景里把氛围和可读性分开：背景可以暗和电影感，但不锈钢主体大部分要亮且有反射，暗区只留在边缘和曲面转折。
- 炊具上的浅色塑料件：干净暖白或象牙白 + 精细哑光微反射；除非用户要暖米色，否则压黄调；不要死白、发灰、廉价或脱离场景光。

### 镜面不锈钢（可直接引用块）

```text
The cookware body should read as mirror stainless steel with broad silver-white highlight blocks, clean reflection zones, and curved metal depth. Keep the bright areas large and readable, but not blown out. Inside the highlights, preserve subtle window-light gradients, countertop reflections, and soft dark-to-light transitions. Do not let the white areas become flat white slabs; keep fine gray shading, soft arc transitions, and tiny reflected environment clues inside the highlight. Do not let the black areas become dead black blocks; keep low-key dark reflections, edge separation, and faint surface structure inside the shadow zones. Reduce fragmented thin lines, scratch-like stripes, and noisy reflection clutter.
```

### 钛

```text
The cookware should read as pure titanium or titanium-inspired metal with restrained silver-gray color, lower saturation than ordinary steel, and a calm industrial sheen. Keep the reflection controlled and refined, with a cooler metal tone, clean edges, and a strong but quiet premium feel. Avoid yellow cast, fake chrome shine, and noisy mirror reflections.
```

### 拉丝铝 / 铝合金

```text
The cookware should read as brushed aluminum or aluminum alloy with a softer metallic sheen, fine directional grain, and smoother, less mirror-like reflection. Keep the surface clean and light, with visible brushing direction and soft highlight bands. Avoid dark muddy metal, rough scratches, and chrome-like overreflection.
```

### 哑光塑料盖 / 手柄

```text
The plastic parts should read as premium matte plastic with fine micro-texture, soft diffuse reflection, and a clean warm-white or ivory-white tone when needed. Keep the surface refined but not glossy, not yellowed, not gray, and not cheap-looking. Let the light reveal the shape gently rather than producing hard plastic glare.
```

### 玻璃盖 / 透明件

```text
The transparent part should read as real glass, with a clean edge, realistic refraction, controlled specular highlight, and believable thickness. Keep the transparency clear but not overly sterile. Avoid cloudy plastic, milky haze, and fake transparency.
```

## 人像与皮肤精修

适用：真实时尚人像、模特图、美妆人像、生活方式人物场景、现有图人像皮肤修整。

**第一定律：先去油光和廉价磨皮，再考虑加质感。**不要上来就加毛孔、绒毛、红血丝、“更多质感”。先消掉大片连成片的高光、湿亮玻璃感反射、滤镜磨皮、蜡感塑料皮。皮肤到半哑光、干净之后，再判断要不要加细微质感。

先定视觉层级：脸、眼神、产品、配饰、手势、服装、皮肤还是整体氛围。皮肤只做支撑；除非用户明确要皮肤特写，否则不让皮肤纹理、泛红、毛孔、油光变成主角。

新人像提示词顺序：情绪状态 -> 光线关系 -> 场景结构 -> 人物身份 -> 肢体动作 -> 表情控制 -> 单一视觉焦点 -> 收尾和风险收口。

现有图修皮肤：锁定模式。冻结身份、五官结构、表情方向、姿势、服装、发型、背景、产品、裁切和比例。优先局部皮肤材质重建，不整景重生。编辑区域限脸、颈、锁骨、手臂、手。

毛孔判断：先看目标图里毛孔是否真实可读（距离、分辨率、焦点、皮肤面积）。不可读就不要加明显毛孔，用低对比自然肤质和细微色调变化；可读就轻柔保留；过强就先降毛孔对比。

失败诊断：

- 改了场景皮肤没变 -> 切局部皮肤材质重建，明确冻结场景、姿势、服装、裁切。
- 油皮：大片连片高光、暗部被抬、鼻颊玻璃反光 -> 先收窄收软高光，再谈质感。
- 廉价感：脏高光、硬高光、橘皮颗粒、AI 噪点、滤镜磨皮 -> 恢复干净高端商业修图。
- 过红：红鼻头、红脸颊、过敏样泛红 -> 降鼻尖、鼻翼、脸颊、眼下、嘴周、颈部红色饱和。
- 质感过头：毛孔绒毛颗粒泛红成了主角 -> 降毛孔对比、降泛红、降锐利纹理。
- 疲惫脸：眼皮重、眼神无落点、嘴颌松 -> 表情保持轻盈，给眼神一个明确落点，不强行瞪眼。

高端商业皮肤默认目标：半哑光不油亮；干净但不塑料；底色平滑带细微色调变化；高光小而受控只在骨点转折；阴影干净保留面部体积；低饱和自然肤色无明显红鼻红颊；质感只在目标支持处出现。

结果已接近时只做小收尾：去残余油光、恢复眼眉唇发际衣领织物折边的自然边缘清晰度、轻微改善眼神聚焦。参考人像只用于皮肤质感方向（哑光程度、高光控制、泛红水平、纹理细腻度），不复制参考者的身份、长相、姿势、配饰、服装、背景。

### 锁定修皮肤（可直接引用块）

```text
Keep the target image structure locked. Locally rebuild only the person's skin material and portrait-light response into high-end commercial retouching: semi-matte, clean, low-saturation, controlled small highlights, clean face volume, subtle natural skin texture only where visible, no oily film, no cheap filter smoothing, no red nose or red cheeks. Keep expression light but not empty by giving the eyes a clear landing point without changing the gaze direction or forcing wide eyes.
```

## 人物 / 模特保真案例

适用：AI 模特图、服装/美妆/生活方式人像、产品与真人同框、换背景但保留真人身份、把参考模特改成品牌模特。先锁“这个人是谁”，再锁“人怎么站、怎么拿、怎么被光照”，最后才写服装、产品和场景。

写法顺序：

1. 身份：脸型、五官比例、发型、年龄感、气质。
2. 姿态：头颈角度、眼神、肩线、手势、身体重心、衣物接触。
3. 造型：服装版型、面料、妆发、配饰。
4. 场景：背景、产品、光线、相机距离。
5. 收口：不换脸、不网红脸、不塑料磨皮、不多手指、不改服装结构。

默认目标：

- 保留真实脸部特征和轻微不对称，不往尖下巴、大眼、过窄鼻梁上拧。
- 表情有一点肌肉状态，别做空洞笑脸。
- 皮肤半哑光、干净、低对比，不要油皮、蜡皮、过度磨皮。
- 手和身体按真实骨骼走，接触、褶皱、压力都要合理。
- 服装和产品要清楚可读，不被人物修图吃掉。

### 模特保真改图模板

```text
比例：[比例池比例]

image1：目标人物图，锁定身份、姿态、服装和构图。image2：风格/场景参考，只管光线、氛围和摄影质感。

以 image1 为目标图做锁定改图：保留脸型、五官比例、发型、年龄感、表情方向、头颈角度、身体姿态、服装版型和主体位置，只把画面升级到 image2 的光线和场景氛围。人物皮肤走半哑光商业修图，高光小而受控，眼神有落点，真实个人特征保留。服装面料、褶皱、袖口、纽扣、logo 和配饰保持清楚，身体与衣物接触自然，背景和光线服务人物，不抢主体。

约束：不要换脸，不要网红脸、尖下巴、大眼滤镜或过度美颜；不要改年龄感、发型、姿态和服装结构；不要油皮、蜡像皮、塑料磨皮、红鼻红脸；不要多手指、断指、肢体变形、衣服贴图错位或新增无关装饰。
```

### 人物设定提示词逻辑

有目标人物图时，目标不是重新“设计一个更漂亮的人”，而是把原人物转译成稳定、可复现的设定。先从图中提取六组可见锚点：身份与年龄感、妆发、身材体态、姿态手势、神态视线、服装造型。把用户说的“不要变”翻成正向可见描述，再把最容易漂移的 3-6 项放到末尾约束。

用户给参考提示词结构时，只借它的段落顺序、相机、镜头、灯光和背景语言。参考文案里的人物年龄、五官、发型、服装、身材、姿态和表情，只有与目标图一致或用户明确要求时才可采用；冲突时全部回到目标图。不要因为范例写了“25 岁、对称、正面”就强改原人物。

没有目标图、要从零建立人物设定时，再把六组锚点写成身份卡；用户没给的年龄、地域、职业或身体特征不要擅自补成事实。身份卡之后再写场景、动作、镜头和光线，让摄影语言服务人物而不是反向改造人物。

### 纯白摄影棚人物锁定模板

单张目标图直接使用，不写 `image1` 角色行；比例由目标图真实尺寸归一到比例池。

```text
比例：[比例池比例]

以当前目标图做锁定式摄影棚改图：完整保留人物的真实身份、原年龄感、脸型、五官比例、个人特征、发型轮廓和妆面；保持原有视线方向、表情开合、面部肌肉状态、头颈角度、肩线、身体朝向、身材比例、体态、手势、接触关系、原裁切和头顶空间。完整保留原服装的颜色、版型、领口、袖长、衣长、面料纹理、褶皱、闭合件、logo、配饰和露肤程度，不重新设计造型。

只把原环境替换为干净连续的无缝纯白摄影棚背景：无地平线、无灰角、无渐变、无环境残片；清除原图中不属于人物造型的海报文字、品牌排版和背景图形。保持主体位置和画幅不变，用受控轮廓光与干净边缘让人物和白色背景自然分离。采用[相机与镜头]的高端商业人像质感，使用[主光位置与光质]配合[补光/反光板]，让眼神光清晰、阴影柔和、服装纹理可读。皮肤呈半哑光自然肤质，保留面部体积和目标图支持的细微纹理，不改变原肤色与妆容。

约束：不要换脸，不要改变年龄感、五官、发型、身材、姿态、手势、视线、笑容和服装结构；不要新增或删除人物造型元素；不要网红脸、过度美颜、蜡像皮、油亮皮、多手指、肢体变形、文字、logo、灰色背景或额外道具。
```

### 参考结构转为人物设定的检查

- 先删掉与目标图冲突的年龄、长相、发型、服装、姿态和表情描述。
- 把镜头、灯光、背景、皮肤质感留下，但改成不影响身份锁的摄影层语言。
- 把“服装/身材/神态不变”展开成图中真实可见的版型、比例、姿态、视线和表情证据。
- 原图是海报或广告图、目标是纯白棚拍时，明确删除背景文字与品牌排版；人物服装上的真实 logo 是否保留按用户要求判断。
- 最后只保留高风险负面词，不重复前文已经写清的保护项。

### 产品与模特同框模板

```text
比例：[比例池比例]

image1：目标人物/场景图，锁定模特身份、姿态和构图。image2：产品参考，控制结构、材质、logo 和比例。

以 image1 为目标图做锁定改图：保持模特身份、脸型五官、发型、表情、身体姿态和场景构图不变，把 image2 产品自然放入人物动作关系中。写清产品是拿在手里、放在身前、贴近脸部还是做前景道具；匹配手指压力、接触阴影、边缘光、反射和相机透视。人物皮肤和服装保持真实商业质感，产品结构、logo、材质和比例必须清楚可识别。

约束：不要换脸，不要改模特姿态和服装结构；不要让产品变形、logo 乱码、比例失真或像贴图；不要多手指、悬浮产品、穿模、遮挡关键卖点或新增无关道具。
```

## 空间融合（插入元素不像贴的）

插入物体、文字、道具、证书、产品时：

- 匹配目标场景的相机高度、透视和灭点方向。
- 接触点对齐表面；加接触阴影和投影。
- 抛光表面加台面反射。
- 匹配边缘光、色温和虚化程度。
- 清掉重复残片、旧残留、硬抠边、蒙版痕、补丁边界。

看起来像贴的，解法通常不是“更自然一点”，而是透视、阴影、反射、边缘光、色温这五件事。

## 人手持产品场景

不要只写“拿着产品”。写清：左右手分工；手指压力、手腕角度、握持方式、手与产品接触；产品在前景/中景/近镜的位置；视觉焦点（logo 区、屏幕、纹理、边缘、按钮、使用动作）；相机高度和镜头感；光在皮肤和产品材质上的响应。风险收口短写：不多手指、不变形、不挡 logo、手与产品接触不断。

## 返修诊断

先判断哪一层坏了：画幅比例 / 场景母版 / 视觉主角 / 空间关系 / 产品结构 / 材质响应 / 光线 / 文字准确性 / 融合边界。把失败翻成可见的正向指令，不要只加“不要这样”：

- 产品太暗 -> “背景保持暗，但产品要有宽大可读的高光和清晰边缘光。”
- 不锈钢乱 -> “把碎反射线换成宽场景反射和顺滑光带。”
- 插入文字像贴的 -> “3D 文字要有真实厚度、接触阴影、台面反射、匹配透视。”
- AI 改了产品 -> “锁定盖子、把手、阀件、五金、品牌区、轮廓和 SKU 比例。”

## 通用紧凑模板（心智模型，不是死表格）

```text
Create/edit a [ratio] image for [purpose], using [target/scene master] as the scene, camera, lighting, and atmosphere basis.

The visual lead is [subject]. Show [core visible relationship] clearly: [specific contact, placement, scale, reflection, proof, or action].

Keep the product identity from [reference]: [SKU-defining details]. The material should respond to the light as [visible optical behavior].

Use [camera/composition] with [light position + light quality + light function]. Make inserted elements belong to the scene through [perspective, contact shadow, reflection, edge light].

Avoid only the high-risk failures: [1], [2], [3].
```
