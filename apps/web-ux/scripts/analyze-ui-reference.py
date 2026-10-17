#!/usr/bin/env python3
"""SRIP UI-reference analyzer — extracts a design spec from a screenshot/PNG
so the UI can be rebuilt faithfully WITHOUT vision:
  * dimensions / aspect ratio
  * dominant color palette (quantized, with CSS-ish hex)
  * light/dark detection + accent color
  * horizontal band segmentation (rough layout blocks)
  * OCR: every visible text with bounding boxes (via RapidOCR)
Run:  <venv>/bin/python apps/web/scripts/analyze-ui-reference.py <image>
"""
import sys, os, io
from collections import Counter

import numpy as np
from PIL import Image

def hexc(c):
    return "#{:02x}{:02x}{:02x}".format(int(c[0]), int(c[1]), int(c[2]))

def quantize(img, n=48):
    small = img.convert("RGB").resize((160, int(160 * img.height / img.width)))
    arr = np.asarray(small).reshape(-1, 3).astype(int)
    # coarse grid quantization
    q = (arr // 32) * 32 + 16
    counts = Counter(map(tuple, q))
    return counts.most_common(n)

def analyze(path):
    img = Image.open(path).convert("RGB")
    w, h = img.size
    print(f"== IMAGE == {os.path.basename(path)}  {w}x{h}  ratio {w/h:.2f}")

    # overall brightness → theme
    arr = np.asarray(img.resize((120, int(120*h/w)))) / 255.0
    lum = (arr * np.array([0.299, 0.587, 0.114])).sum(axis=-1)
    print(f"== THEME == mean luminance {lum.mean():.2f}  → {'DARK' if lum.mean() < 0.45 else 'LIGHT'}")

    # horizontal band segmentation: average color per row, find big uniform blocks
    rows = lum.mean(axis=1)
    bands = []
    cur = [0, rows[0]]
    for i in range(1, len(rows)):
        if abs(rows[i] - cur[1]) > 0.06:
            bands.append((cur[0], i, cur[1]))
            cur = [i, rows[i]]
    bands.append((cur[0], len(rows), cur[1]))
    bands = [b for b in bands if (b[1]-b[0]) > len(rows)*0.02]
    print(f"== LAYOUT BANDS (top→bottom) ==")
    for b in bands:
        band = img.crop((0, int(b[0]*h/120), w, int(b[1]*h/120)))
        c = quantize(band, 6)
        top = ", ".join(f"{hexc(col)} ({n})" for col, n in c[:3])
        print(f"  y {b[0]*h/120:5.0f}-{b[1]*h/120:5.0f}  lum {b[2]:.2f}  colors: {top}")

    # palette
    print("== PALETTE (top 20) ==")
    for col, n in quantize(img, 20):
        print(f"  {hexc(col)}  count={n}")

    # left column (sidebar?) vs rest
    lw = max(40, w // 6)
    left = img.crop((0, 0, lw, h))
    right = img.crop((lw, 0, w, h))
    for name, part in (("SIDEBAR", left), ("CONTENT", right)):
        pal = quantize(part, 4)
        print(f"== {name} palette: " + ", ".join(f"{hexc(c)}" for c, n in pal[:4]))

    # OCR
    print("== OCR TEXT (with positions) ==")
    try:
        from rapidocr_onnxruntime import RapidOCR
        ocr = RapidOCR()
        res, _ = ocr(np.asarray(img))
        if res:
            for box, text, conf in res:
                xs = [p[0] for p in box]; ys = [p[1] for p in box]
                x0, y0, x1, y1 = min(xs), min(ys), max(xs), max(ys)
                print(f"  [{x0:4.0f},{y0:4.0f} → {x1:4.0f},{y1:4.0f}] {text}  ({conf:.2f})")
        else:
            print("  (no text detected)")
    except Exception as e:
        print(f"  OCR failed: {e}")

if __name__ == "__main__":
    analyze(sys.argv[1])
