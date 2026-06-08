#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
按归一化框批量拆件 / 抠区域。

Agent 看图时先按生图比例池给出接近目标比例的基础框（0-1，相对整图宽高）。脚本读图换算像素，
只做轻微外扩 pad（默认 20%）和轻微比例纠正，最后切出 PNG。

切的是矩形框，不是沿轮廓抠图。为了忽略遮挡并尽量拆出完整零件，视觉框要按目标零件的完整占位给。
跑完后必须生成联系表复核；日志只说明切出了文件，不代表切对。
"""

import argparse
import json
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
try:
    from PIL import Image
    from crop_paste import crop_region
except ImportError as e:
    sys.exit(f"依赖缺失：{e}（需 Pillow，且 crop_paste.py 在同目录）")


ALLOWED_RATIOS = {
    "1:1": 1 / 1,
    "3:2": 3 / 2,
    "2:3": 2 / 3,
    "4:3": 4 / 3,
    "3:4": 3 / 4,
    "16:9": 16 / 9,
    "9:16": 9 / 16,
    "2:1": 2 / 1,
    "1:2": 1 / 2,
    "21:9": 21 / 9,
    "9:21": 9 / 21,
}
AUTO_RATIO = {"自动", "auto", "AUTO"}


def norm_to_px(box_norm, W, H):
    x1, y1, x2, y2 = box_norm
    return [round(x1 * W), round(y1 * H), round(x2 * W), round(y2 * H)]


def expand_box(box, pad, W, H):
    x1, y1, x2, y2 = box
    bw, bh = x2 - x1, y2 - y1
    px, py = int(bw * pad), int(bh * pad)
    return [
        max(0, x1 - px),
        max(0, y1 - py),
        min(W, x2 + px),
        min(H, y2 + py),
    ]


def pick_auto_ratio(box):
    x1, y1, x2, y2 = box
    w, h = max(1, x2 - x1), max(1, y2 - y1)
    r = w / h
    return min(ALLOWED_RATIOS, key=lambda k: abs(math.log(ALLOWED_RATIOS[k]) - math.log(r)))


def fit_box_to_ratio(box, ratio, W, H):
    x1, y1, x2, y2 = box
    w, h = x2 - x1, y2 - y1
    cx, cy = (x1 + x2) / 2, (y1 + y2) / 2

    fw = max(w, h * ratio)
    fh = fw / ratio
    if fw > W:
        fw, fh = W, W / ratio
    if fh > H:
        fh, fw = H, H * ratio
        if fw > W:
            fw, fh = W, W / ratio

    nx1 = max(0, min(cx - fw / 2, W - fw))
    ny1 = max(0, min(cy - fh / 2, H - fh))
    return [round(nx1), round(ny1), round(nx1 + fw), round(ny1 + fh)]


def parse_ratio(name):
    if name in AUTO_RATIO:
        return None
    if name not in ALLOWED_RATIOS:
        raise ValueError(f"不允许的比例 {name!r}；只能用：自动 / " + " / ".join(ALLOWED_RATIOS))
    return ALLOWED_RATIOS[name]


def main():
    ap = argparse.ArgumentParser(description="按归一化框批量拆件（外扩 + 比例池）")
    ap.add_argument("--parts", required=True, help="零件清单 JSON")
    ap.add_argument("--image", help="图片路径（覆盖清单里的 image）")
    ap.add_argument("--out-dir", required=True)
    ap.add_argument("--pad", type=float, default=None, help="全局外扩比例，默认读取 JSON，最终默认 0.20")
    ap.add_argument("--ratio", default=None, help="全局比例：自动 / " + " / ".join(ALLOWED_RATIOS))
    args = ap.parse_args()

    with open(args.parts, "r", encoding="utf-8") as f:
        spec = json.load(f)

    image_path = args.image or spec.get("image")
    if not image_path:
        sys.exit("没有图片路径：--image 或 parts.json 的 image 字段二选一")

    default_pad = args.pad if args.pad is not None else spec.get("pad", 0.20)
    default_ratio = args.ratio or spec.get("ratio") or "自动"

    img = Image.open(image_path)
    W, H = img.size
    os.makedirs(args.out_dir, exist_ok=True)

    n = 0
    for part in spec.get("parts", []):
        base_box = norm_to_px(part["box_norm"], W, H)
        pad = part.get("pad", default_pad)
        box = expand_box(base_box, pad, W, H)

        ratio_name = part.get("ratio") or default_ratio
        try:
            ratio_val = parse_ratio(ratio_name)
        except ValueError as e:
            sys.exit(f"零件 {part['id']}: {e}")
        if ratio_val is None:
            ratio_name = pick_auto_ratio(box)
            ratio_val = ALLOWED_RATIOS[ratio_name]
        box = fit_box_to_ratio(box, ratio_val, W, H)

        crop, _ = crop_region(img, box, pad=0)
        out = os.path.join(args.out_dir, f"{part['id']}@{ratio_name.replace(':','-')}.png")
        crop.save(out)
        print(f"[extract] {part['id']:<18} ratio={ratio_name:<5} base={base_box} px={box} -> {out}")
        n += 1

    print(f"[extract] 共拆出 {n} 个零件，输出在 {args.out_dir}（整图 {W}x{H}）")


if __name__ == "__main__":
    main()
