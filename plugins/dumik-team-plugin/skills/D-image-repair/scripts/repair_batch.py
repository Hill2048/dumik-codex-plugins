#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
D-image-repair 批量修复驱动。

把「一堆选中图 × 每图多个偏差区域」的修复跑成三步，无人值守：

  1) crop-batch  读修复清单 -> 切出所有区域 + 产出修复任务 JSON（给 D-image-run）
  2) D-image-run 用 banana2 + 产品白底图重绘所有切片（不在本脚本，见 SKILL）
  3) paste-batch 一图多区域链式贴回 -> 每图一张最终修复图

依赖 Pillow，复用同目录 crop_paste.py 的 crop_region / paste_region。

修复清单（修复清单.json）形状
-----------------------------
{
  "schemaVersion": 1,
  "project": "纯钛+乌檀木菜板",
  "items": [
    {
      "image_id": "卖点A-方向2-cand-1",
      "image_path": "输出/确认图/卖点A-方向2-1.png",
      "white_ref": "原图/产品白底图.png",
      "verdict": "blocked",
      "regions": [
        {
          "region_id": "把手",
          "box": [1200, 800, 1700, 1300],
          "pad": 0.12,
          "drift_type": "handle",
          "repair_instruction": "正面描述把手正确结构与材质 + 锁定周边一致 + 1-2 点风险收口"
        }
      ]
    }
  ]
}

用法
----
切 + 出任务：
    python repair_batch.py crop-batch \
        --manifest 输出/运行记录/修复清单.json \
        --workdir 输出/临时/repair \
        --jobs 输出/提示词/修复任务.json \
        --project-root .

贴回（D-image-run 跑完后）：
    python repair_batch.py paste-batch \
        --manifest 输出/运行记录/修复清单.json \
        --workdir 输出/临时/repair \
        --repaired-dir 输出/确认图/repair \
        --out-dir 输出/成品 \
        --project-root . \
        --feather 24
"""

import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
try:
    from PIL import Image
    from crop_paste import crop_region, paste_region
except ImportError as e:
    sys.exit(f"依赖缺失：{e}（需 Pillow，且 crop_paste.py 在同目录）")


def _p(root, rel):
    """相对项目根解析为绝对路径；已是绝对路径则原样。"""
    if not rel:
        return rel
    return rel if os.path.isabs(rel) else os.path.normpath(os.path.join(root, rel))


def _slug(s):
    return str(s).replace("/", "_").replace("\\", "_").replace(" ", "")


def _crop_name(image_id, region_id):
    return f"repair-{_slug(image_id)}-{_slug(region_id)}"


def load_manifest(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def do_crop_batch(args):
    root = os.path.abspath(args.project_root)
    man = load_manifest(args.manifest)
    os.makedirs(_p(root, args.workdir), exist_ok=True)
    jobs = []
    n_img = n_reg = 0

    for item in man.get("items", []):
        if item.get("verdict") == "passed":
            continue  # 只修 blocked / 标了 regions 的
        img_path = _p(root, item["image_path"])
        if not item.get("regions"):
            continue
        img = Image.open(img_path)
        n_img += 1
        for reg in item["regions"]:
            name = _crop_name(item["image_id"], reg["region_id"])
            crop, meta = crop_region(img, reg["box"], reg.get("pad", 0.12))
            meta.update({
                "source_image": img_path,
                "image_id": item["image_id"],
                "region_id": reg["region_id"],
            })
            crop_path = _p(root, os.path.join(args.workdir, name + "-crop.png"))
            meta_path = _p(root, os.path.join(args.workdir, name + "-meta.json"))
            crop.save(crop_path)
            with open(meta_path, "w", encoding="utf-8") as f:
                json.dump(meta, f, ensure_ascii=False, indent=2)

            ref = item.get("white_ref")
            jobs.append({
                "id": name,
                "file": crop_path,
                "reference_files": [_p(root, ref)] if ref else [],
                "task": f"局部修复 {item['image_id']} 的 {reg['region_id']}，按产品白底图结构重绘，周边保持一致",
                "count": 1,
                "output_name": name + ".png",
                "final_instruction": reg.get("repair_instruction", ""),
            })
            n_reg += 1

    jobs_path = _p(root, args.jobs)
    os.makedirs(os.path.dirname(jobs_path), exist_ok=True)
    with open(jobs_path, "w", encoding="utf-8") as f:
        json.dump({"items": jobs}, f, ensure_ascii=False, indent=2)

    print(f"[crop-batch] 切了 {n_img} 张图、{n_reg} 个区域")
    print(f"[crop-batch] 切片+meta 在 {args.workdir}")
    print(f"[crop-batch] 修复任务 JSON -> {args.jobs}（交 D-image-run，banana2，输出到 repaired-dir）")


def do_paste_batch(args):
    root = os.path.abspath(args.project_root)
    man = load_manifest(args.manifest)
    out_dir = _p(root, args.out_dir)
    os.makedirs(out_dir, exist_ok=True)
    repaired_dir = _p(root, args.repaired_dir)
    done = []
    missing = []

    for item in man.get("items", []):
        if item.get("verdict") == "passed" or not item.get("regions"):
            continue
        base = Image.open(_p(root, item["image_path"]))
        applied = 0
        for reg in item["regions"]:
            name = _crop_name(item["image_id"], reg["region_id"])
            meta_path = _p(root, os.path.join(args.workdir, name + "-meta.json"))
            repaired_path = os.path.join(repaired_dir, name + ".png")
            if not (os.path.exists(meta_path) and os.path.exists(repaired_path)):
                missing.append(name)
                continue
            with open(meta_path, "r", encoding="utf-8") as f:
                meta = json.load(f)
            base = paste_region(base, Image.open(repaired_path), meta["crop_box"], args.feather)
            applied += 1

        out_path = os.path.join(out_dir, f"{_slug(item['image_id'])}-fixed.png")
        base.convert("RGB").save(out_path)
        done.append((item["image_id"], applied, out_path))

    for image_id, applied, out_path in done:
        print(f"[paste-batch] {image_id}: 贴回 {applied} 个区域 -> {out_path}")
    if missing:
        print(f"[paste-batch] 警告：缺少切片/修复图 {len(missing)} 个：{', '.join(missing[:8])}{'...' if len(missing) > 8 else ''}")
    print(f"[paste-batch] 完成 {len(done)} 张，输出在 {args.out_dir}")


def main():
    p = argparse.ArgumentParser(description="D-image-repair 批量修复驱动")
    sub = p.add_subparsers(dest="cmd", required=True)

    pc = sub.add_parser("crop-batch", help="按清单切所有区域并产出修复任务 JSON")
    pc.add_argument("--manifest", required=True)
    pc.add_argument("--workdir", required=True, help="切片和 meta 落地目录（相对项目根）")
    pc.add_argument("--jobs", required=True, help="产出的修复任务 JSON 路径")
    pc.add_argument("--project-root", default=".")
    pc.set_defaults(func=do_crop_batch)

    pp = sub.add_parser("paste-batch", help="一图多区域链式贴回，出最终修复图")
    pp.add_argument("--manifest", required=True)
    pp.add_argument("--workdir", required=True, help="crop-batch 用的同一个 workdir")
    pp.add_argument("--repaired-dir", required=True, help="D-image-run 修好的切片目录")
    pp.add_argument("--out-dir", required=True)
    pp.add_argument("--project-root", default=".")
    pp.add_argument("--feather", type=int, default=24)
    pp.set_defaults(func=do_paste_batch)

    args = p.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
