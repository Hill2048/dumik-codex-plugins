---
name: super-image-prompt
version: 0.1.2
description: "用于创建、改写或优化高级中文图像提示词，覆盖产品视觉、电商场景、图片改图、商业摄影、多参考图、材质光影优化、产品结构保真和视觉总监 brief。默认只写提示词或 brief，不调用生图、改图接口或图片工具。"
---

# 高级图像提示词

Use this skill to turn visual prompt and image-editing requests into clear art-director briefs. Treat image work as visual direction, not a pile of adjectives or restrictions.
Match the user's language by default; for Chinese ecommerce and image-edit tasks, write the final prompt in Chinese unless the user asks otherwise.

## 执行边界

默认只输出文字：提示词、视觉 brief、改图指令或美术指导语言。不直接生成图片，不调用 `image-batch-agent`、图片 API、批量生成脚本或其他图片工具。

只有用户明确说“生图 / 出图 / 生成图片 / 调用接口 / 直接生成”等实际生成意图时，才进入图片生成；如果用户只是要“提示词 / prompt / brief / 改图指令 / 优化一下”，必须停在文字交付。

## Core Rule

First let the model see the picture, then ask it to obey rules.

Write in this order:

1. Scene and purpose.
2. Core visible relationship.
3. Product or subject identity.
4. Composition, camera, lighting, and material response.
5. Only the highest-risk failure points.

Avoid starting with a wall of negatives. If the request is a product edit, preserve product truth before adding atmosphere.

## Before Writing

Answer these internally before drafting:

- What is the image for: proof, product display, ecommerce scene, brand mood, comparison, white-background refinement, local repair, or style transfer?
- Who is the visual lead: product, person, material, text, scene, relationship, or proof element?
- What is the scene master: the image or instruction that controls the whole background, lighting, camera, and canvas?
- What visible relationship proves the request: a hand holding the product, a 3D word touching the table, a pot reflecting the room, a certificate array, a product on a real surface?
- Which reference controls each job: canvas, scene, product structure, material, local detail, text, style, or mood?
- Which product identity points must not drift?
- What are the 1 to 3 most likely failure points?

## Output Shape

When writing a final prompt, use this structure unless the user asks for a different format:

1. Ratio and ratio basis.
2. Image-role judgment.
3. Short edit or generation summary.
4. Final prompt as a natural visual brief.

For Image-edit tasks, put the final prompt inside a fenced code block for easy copying.

## Ratio And Reference Control

Separate whole-canvas control from local-reference control.

Priority for canvas ratio:

1. Direct user ratio.
2. Target image or current image.
3. Explicit scene master, background, or layout reference.
4. Real target-image dimensions.
5. Platform/use-case ratio only when there is no image-based controller.

Product white-background images, detail shots, logo shots, handle shots, material references, and structure references usually do not control canvas ratio unless the user explicitly says so.

Assign every reference one main job:

- Target image: the actual image to modify.
- Scene master: controls background, lighting, camera, composition, and often canvas ratio.
- Product structure reference: controls silhouette, proportion, SKU, hardware, parts, and angle.
- Material reference: controls finish, reflection, texture, color, and surface response.
- Local replacement source: controls one inserted object, text, badge, mark, or detail.
- Style reference: controls mood, palette, lighting character, or photographic language.

Do not say "refer to images 2-3" vaguely. Say what each image controls.

## Translate Abstract Words

Convert vague goals into visible image language:

- "premium" -> controlled light direction, clean subject separation, restrained highlights, uncluttered background hierarchy.
- "natural integration" -> matching perspective, matching color temperature, contact shadow, tabletop reflection, consistent edge light.
- "stronger texture" -> describe how light behaves on the material, not just the material name.
- "product clearer" -> bright readable body, clear silhouette, edge light, background darker or quieter than the subject.
- "not pasted" -> object touches the surface, has weight, casts shadow, reflects on the table, and follows the same camera angle.
- "cinematic atmosphere" -> dark background can stay dark, but the product must still have readable edges and intentional highlights.
- "clean composition" -> visual lead is obvious, props support rather than compete, empty areas serve breathing room or text placement.

## Photography Brief Order

Use photographer language when quality matters:

1. Scene master: material, color, background depth, tabletop or environment.
2. Subject hierarchy: first visual center, secondary support elements, negative space.
3. Spatial relationship: foreground, middle ground, background, contact point, support, overlap, and scale.
4. Camera: eye-level, low angle, top view, close-up, long lens, wide perspective, vanishing point, or aperture only when useful.
5. Lighting: light position, light quality, light function.
6. Material response: what the surface does under that light.
7. Risk closure: concise, specific, and limited.

Light should be described in three parts:

- Light position: where it comes from.
- Light quality: soft, hard, feathered, narrow, diffused, directional.
- Light function: reveal the subject, separate edges, shape volume, create reflection, or quiet the background.

## Material Language

Write materials as optical behavior:

- Mirror stainless steel: broad highlight blocks, clean reflection zones, curved metal depth, controlled edge shadows.
- Brushed metal: fine directional grain, soft linear highlight, not scratched or dirty.
- Titanium: restrained silver-gray metal, clean low-saturation reflection, light but strong industrial feel.
- Matte plastic: fine micro-texture, soft diffuse reflection, clean warm white or ivory-white when premium.
- Glass: transparent edge, realistic refraction, controlled specular highlight, no cloudy plastic look.
- Stone or countertop: subtle pores, surface weight, contact shadow, gentle reflection where polished.
- 3D metal text: real thickness, bevel, contact shadow, tabletop reflection, shared perspective and light direction.

Do not stop at "high quality" or "premium texture"; describe the visible effect.

## Fixed Templates

Use these as reusable blocks when the user asks for a specific type of image. Keep the structure stable and only swap the subject, scene, or product details.

### Portrait And Skin Refinement

Use this for realistic fashion portraits, model images, beauty portraits, lifestyle people scenes, and existing-image portrait skin edits.

First law for portrait skin: remove oily shine and cheap smoothing before anything else. Do not start by adding pores, fuzz, redness, or "more texture." First eliminate broad connected highlights, wet/glass reflections, blur-filter smoothing, waxy skin, plastic skin, and cheap beauty-retouch surfaces. Only after the skin is semi-matte and clean should you decide whether subtle texture is needed.

First decide the visual hierarchy: face, eyes, product, accessory, hand gesture, clothing, skin, or overall mood. Skin should support that hierarchy. Do not let skin texture, redness, pores, or shine become the subject unless the user explicitly asks for a skin close-up.

For new portrait prompts, write in this order:

1. emotion or state
2. light relationship
3. scene structure
4. person identity
5. body movement
6. expression control
7. single visual focus
8. finish and risk closure

For existing-image edits, keep locked mode. Freeze identity, face structure, expression direction, pose, clothing, hair, background, product, camera crop, and ratio. Prefer local skin-material reconstruction over full-scene regeneration. The edit area is face, neck, collarbone, arms, and hands.

Before mentioning pores, judge whether pores are actually visible in the target image. Consider distance, resolution, focus, and visible skin area. If pores are not readable, do not add obvious pores; use low-contrast natural skin texture and subtle tonal variation. If pores are visible, preserve them softly. If pores are too strong, reduce pore contrast before changing broader skin tone.

Diagnose failed portrait skin before adding more adjectives:

- too global: scene changes but skin does not -> switch to local skin-material reconstruction and explicitly freeze scene, pose, clothing, and crop
- oily skin: broad connected highlights, lifted shadows, glassy nose or cheek reflections -> narrow and soften highlights before adding texture
- cheap or filter-like skin: dirty shine, hard highlight, orange-peel grain, AI noise, or blur-filter smoothing -> restore clean high-end commercial retouching
- over-red skin: red nose, red cheeks, allergy-like redness, rosacea-like surface color -> lower red saturation around nose tip, nose wings, cheeks, under-eyes, mouth area, and neck
- over-textured skin: pores, fuzz, grain, or redness become the subject -> reduce pore contrast, redness, and sharp texture
- tired face: eyelids too heavy, gaze has no landing point, mouth or jaw is too slack -> keep expression light but give the eyes a clear landing point without forced wide eyes

Default target for high-end commercial skin:

- semi-matte, not glossy
- clean but not plastic
- smooth base tone with subtle tonal variation
- small controlled highlights only on bone turns
- clean shadows that preserve face volume
- low-saturation natural complexion, no obvious red nose or red cheeks
- texture only where the target supports it; never let pores, fuzz, grain, or redness become the subject

If the result is already close, stop rewriting the whole image. Do only small finishing: reduce remaining blur-shine, recover natural edge clarity around eyes, brows, lips, hairline, collar, and fabric folds, and slightly improve gaze focus.

When using a reference portrait, use it only for skin-quality direction such as matte level, highlight control, redness level, and texture subtlety. Do not copy the reference person's identity, face, race, pose, accessory, clothing, or background.

Reusable locked edit intent:

```text
Keep the target image structure locked. Locally rebuild only the person's skin material and portrait-light response into high-end commercial retouching: semi-matte, clean, low-saturation, controlled small highlights, clean face volume, subtle natural skin texture only where visible, no oily film, no cheap filter smoothing, no red nose or red cheeks. Keep expression light but not empty by giving the eyes a clear landing point without changing the gaze direction or forcing wide eyes.
```

### Cookware Material Templates

Use these as drop-in blocks for cookware and kitchen-product edits.

#### Mirror Stainless Steel

```text
The cookware body should read as mirror stainless steel with broad silver-white highlight blocks, clean reflection zones, and curved metal depth. Keep the bright areas large and readable, but not blown out. Inside the highlights, preserve subtle window-light gradients, countertop reflections, and soft dark-to-light transitions. Do not let the white areas become flat white slabs; keep fine gray shading, soft arc transitions, and tiny reflected environment clues inside the highlight. Do not let the black areas become dead black blocks; keep low-key dark reflections, edge separation, and faint surface structure inside the shadow zones. Reduce fragmented thin lines, scratch-like stripes, and noisy reflection clutter.
```

#### Titanium

```text
The cookware should read as pure titanium or titanium-inspired metal with restrained silver-gray color, lower saturation than ordinary steel, and a calm industrial sheen. Keep the reflection controlled and refined, with a cooler metal tone, clean edges, and a strong but quiet premium feel. Avoid yellow cast, fake chrome shine, and noisy mirror reflections.
```

#### Brushed Aluminum or Aluminum Alloy

```text
The cookware should read as brushed aluminum or aluminum alloy with a softer metallic sheen, fine directional grain, and smoother, less mirror-like reflection. Keep the surface clean and light, with visible brushing direction and soft highlight bands. Avoid dark muddy metal, rough scratches, and chrome-like overreflection.
```

#### Matte Plastic Lid or Handle

```text
The plastic parts should read as premium matte plastic with fine micro-texture, soft diffuse reflection, and a clean warm-white or ivory-white tone when needed. Keep the surface refined but not glossy, not yellowed, not gray, and not cheap-looking. Let the light reveal the shape gently rather than producing hard plastic glare.
```

#### Glass Lid or Transparent Part

```text
The transparent part should read as real glass, with a clean edge, realistic refraction, controlled specular highlight, and believable thickness. Keep the transparency clear but not overly sterile. Avoid cloudy plastic, milky haze, and fake transparency.
```

## Mirror Stainless-Steel Cookware

For mirror stainless-steel cookware, avoid messy thin reflection lines. Use broad, continuous, clean highlight areas as the main language.

The pot body should have wide silver-white reflection zones and a readable curved volume. Highlights can be bright, but they must not become blown-out pure white. Keep subtle window-light gradients, countertop reflections, soft dark-to-light transitions, and curved metal depth inside the bright areas.

Do not let the white zones collapse into featureless white blocks; preserve gray tonal variation, softened arc transitions, and small reflected environment details. Do not let the black zones collapse into featureless black blocks; preserve low-contrast reflections, edge separation, and dark surface volume. Reduce small broken reflection lines, scratch-like stripes, water-ripple noise, and dense fragmented highlights. If the source image has messy reflections, ask to convert them into scene-aware reflections: broad window-light bands, restrained tabletop silhouettes, soft environmental shapes, and controlled edge shadows.

In dark scenes, separate atmosphere from readability. The background may stay dark and cinematic, but most of the stainless-steel cookware must remain bright and reflective, with small dark areas only on edges or curved turning points.

For light-colored plastic parts on cookware, prefer clean warm white or ivory-white with refined matte micro-reflection. Reduce yellow cast unless the user explicitly wants warm beige. Do not make the plastic dead white, gray, cheap-looking, or detached from the scene lighting.

## Product Identity Lock

For product edits, identify the SKU details that define the product and protect them explicitly:

- outline and proportions
- lid, cover, or top structure
- handles and grip shape
- valves, knobs, buttons, vents, locks, and hardware
- brand or logo area
- material finish
- camera angle and product pose when required
- colorway and SKU-specific details

Atmosphere, lighting, and style must support the product, not overwrite it.

## Spatial Integration

For inserted objects, text, props, certificates, or products, make them belong to the scene:

- Match the target scene's camera height, perspective, and vanishing direction.
- Align contact points with the surface.
- Add contact shadows and cast shadows.
- Add tabletop reflection when the surface is polished.
- Match edge light, color temperature, and blur level.
- Remove duplicate fragments, old leftovers, hard cutout edges, masks, and obvious patch borders.

If the result looks pasted, the fix is usually not "make it natural"; it is perspective, shadow, reflection, edge light, and color-temperature matching.

## People And Handheld Product Scenes

For hand/product scenes, do not simply write "holding the product". Specify:

- left hand and right hand roles
- finger pressure, wrist angle, grip type, and hand-product contact
- product position in foreground, middle ground, or near camera
- visual focus point: logo area, screen, texture, edge, cap, button, or use action
- camera height and lens feeling
- light response on skin and product material

Protect anatomy and product truth with short risk closure: no extra fingers, no distorted product, no hidden logo, no broken hand-product contact.

## Iteration And Debugging

When improving a bad output, diagnose which layer failed:

- Canvas or ratio
- Scene master
- Visual lead
- Spatial relationship
- Product structure
- Material response
- Lighting
- Text accuracy
- Integration boundary

Turn the failure into a visible positive instruction. Do not only add "do not do that".

Examples:

- If the product is too dark: "keep the background dark, but give the product a broad readable highlight and clear edge light."
- If stainless steel is messy: "replace fragmented lines with broad scene reflections and smooth light bands."
- If inserted text looks pasted: "give the 3D text real thickness, contact shadow, tabletop reflection, and matching perspective."
- If the AI changes the product: "lock the lid, handle, valve, hardware, logo area, outline, and SKU proportions."

## Risk Closure

End with a short risk closure that names only the most likely failures.

Good closure:

- Do not change the product structure.
- Do not leave pasted edges, duplicate fragments, or broken text.
- Do not make the material dirty, scratched, overexposed, or unreadable.

Bad closure:

- A long list of every possible negative word.
- More protection text than visual direction.
- Generic warnings that do not match the current image.

## Compact Prompt Template

Use this template as a mental model, not a rigid form:

```text
Create/edit a [ratio] image for [purpose], using [target/scene master] as the scene, camera, lighting, and atmosphere basis.

The visual lead is [subject]. Show [core visible relationship] clearly: [specific contact, placement, scale, reflection, proof, or action].

Keep the product identity from [reference]: [SKU-defining details]. The material should respond to the light as [visible optical behavior].

Use [camera/composition] with [light position + light quality + light function]. Make inserted elements belong to the scene through [perspective, contact shadow, reflection, edge light].

Avoid only the high-risk failures: [1], [2], [3].
```

