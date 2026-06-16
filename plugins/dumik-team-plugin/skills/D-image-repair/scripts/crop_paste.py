#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
D-image-repair 自动切图 / 贴回助手。

让 Agent 模式无人值守修复：Agent 看图给出偏差区域的像素框，
crop 按基础框外扩切出局部并记录位置 -> banana2 重绘 -> paste 按记录无缝贴回。

依赖：Pillow（pip install pillow）。

本文件既是 CLI，也对外暴露纯函数 crop_region / paste_region，
供批量驱动 repair_batch.py import 复用。

用法（单区域）
--------------
切图：
    python crop_paste.py crop \
        --image 原图.png --box 1200 800 1700 1300 --pad 0.20 \
        --out-crop 临时/repair-把手-1-crop.png \
        --out-meta 临时/repair-把手-1-meta.json

贴回：
    python crop_paste.py paste \
        --image 原图.png --repaired 修好的局部.png \
        --meta 临时/repair-把手-1-meta.json --feather 24 \
        --out 输出/成品/repair-把手-1-final.png

批量见 repair_batch.py。
"""

import argparse
import json
import os
import sys

try:
    from PIL import Image, ImageFilter, ImageDraw
except ImportError:
    sys.exit("缺少 Pillow，请先 pip install pillow")


def _clamp(v, lo, hi):
    return max(lo, min(hi, v))


def crop_region(img, box, pad=0.20):
    """从 img 按基础框外扩切出局部。返回 (crop_img, meta_dict)。
    img: PIL.Image（任意模式，内部转 RGBA）
    box: [x1, y1, x2, y2] 像素，要修的结构本身
    """
    img = img.convert("RGBA")
    W, H = img.size
    x1, y1, x2, y2 = box
    if x2 <= x1 or y2 <= y1:
        raise ValueError("box 非法：需要 x1<x2 且 y1<y2")

    bw, bh = x2 - x1, y2 - y1
    px, py = int(bw * pad), int(bh * pad)
    cx1, cy1 = _clamp(x1 - px, 0, W), _clamp(y1 - py, 0, H)
    cx2, cy2 = _clamp(x2 + px, 0, W), _clamp(y2 + py, 0, H)

    crop = img.crop((cx1, cy1, cx2, cy2))
    meta = {
        "source_size": [W, H],
        "repair_box": [x1, y1, x2, y2],
        "crop_box": [cx1, cy1, cx2, cy2],
        "pad_ratio": pad,
    }
    return crop, meta


def paste_region(base_img, repaired_img, crop_box, feather=24):
    """把 repaired_img 按 crop_box 羽化无缝贴回 base_img。返回贴好的 base_img（RGBA）。
    可链式调用：上一次的返回值当下一次的 base_img，实现一图多区域。
    """
    base = base_img.convert("RGBA")
    repaired = repaired_img.convert("RGBA")
    cx1, cy1, cx2, cy2 = crop_box
    tw, th = cx2 - cx1, cy2 - cy1

    if repaired.size != (tw, th):
        repaired = repaired.resize((tw, th), Image.LANCZOS)

    f = max(0, int(feather))
    mask = Image.new("L", (tw, th), 0)
    ImageDraw.Draw(mask).rectangle([f, f, tw - f, th - f], fill=255)
    if f > 0:
        mask = mask.filter(ImageFilter.GaussianBlur(f / 2))

    base.paste(repaired, (cx1, cy1), mask)
    return base


# ---- CLI ----------------------------------------------------------------
def _ensure_dir(path):
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)


def do_crop(args):
    img = Image.open(args.image)
    crop, meta = crop_region(img, args.box, args.pad)
    meta["source_image"] = os.path.abspath(args.image)
    _ensure_dir(args.out_crop)
    crop.save(args.out_crop)
    _ensure_dir(args.out_meta)
    with open(args.out_meta, "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)
    print(f"[crop] {args.out_crop}  crop_box={meta['crop_box']}")
    print(f"[crop] meta {args.out_meta}")


def do_paste(args):
    with open(args.meta, "r", encoding="utf-8") as f:
        meta = json.load(f)
    base = Image.open(args.image)
    repaired = Image.open(args.repaired)
    out = paste_region(base, repaired, meta["crop_box"], args.feather)
    _ensure_dir(args.out)
    out.convert("RGB").save(args.out)
    print(f"[paste] {args.out}  at={meta['crop_box']}  feather={args.feather}")


def main():
    p = argparse.ArgumentParser(description="D-image-repair 自动切图/贴回")
    sub = p.add_subparsers(dest="cmd", required=True)

    pc = sub.add_parser("crop", help="按像素框切出局部并记录位置")
    pc.add_argument("--image", required=True)
    pc.add_argument("--box", required=True, type=int, nargs=4, metavar=("X1", "Y1", "X2", "Y2"))
    pc.add_argument("--pad", type=float, default=0.20)
    pc.add_argument("--out-crop", required=True)
    pc.add_argument("--out-meta", required=True)
    pc.set_defaults(func=do_crop)

    pp = sub.add_parser("paste", help="把修好的局部按 meta 无缝贴回")
    pp.add_argument("--image", required=True)
    pp.add_argument("--repaired", required=True)
    pp.add_argument("--meta", required=True)
    pp.add_argument("--feather", type=int, default=24)
    pp.add_argument("--out", required=True)
    pp.set_defaults(func=do_paste)

    args = p.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
