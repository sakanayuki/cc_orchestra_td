#!/usr/bin/env python3
"""source/ の楽器画像から背景を抜いた PNG を作り、仮のトランペット・ファゴットのドット絵を描く。
使い方: リポジトリのルートで  python3 street-td/tools/build_images.py
必要: Pillow, numpy
"""
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "source"
OUT = ROOT / "street-td" / "assets" / "img"
OUT.mkdir(parents=True, exist_ok=True)
MAX_H = 260  # 出力の高さの上限（表示は 120px 前後なので 2 倍密度でも足りる）

FILES = {
    "violin": "violin.jpg", "viola": "viola.jpg", "cello": "cello.jpg",
    "contrabass": "doublebass.jpg", "flute": "flute.jpg", "oboe": "oboe.jpg",
    "clarinet": "clarinet.jpg", "horn": "horn.jpg", "timpani": "timpani.jpg",
}


def remove_bg(img: Image.Image, tol: float = 34.0, pockets_below: float | None = None) -> Image.Image:
    """外周とつながった背景色の領域を透明にする。
    pockets_below を指定すると、画像のその割合より下にある、外周とつながらない背景色の溜まり
    （ティンパニの脚の間など）も透明にする。"""
    a = np.asarray(img.convert("RGB")).astype(np.int16)
    h, w, _ = a.shape
    border = np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]])
    bg = np.median(border, axis=0)
    near = np.sqrt(((a - bg) ** 2).sum(axis=2)) < tol
    seen = np.zeros((h, w), bool)
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if near[y, x] and not seen[y, x]:
                seen[y, x] = True; q.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if near[y, x] and not seen[y, x]:
                seen[y, x] = True; q.append((y, x))
    if pockets_below is not None:
        y0 = int(h * pockets_below)
        for y in range(y0, h):
            for x in range(w):
                if near[y, x] and not seen[y, x]:
                    seen[y, x] = True; q.append((y, x))
    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and near[ny, nx] and not seen[ny, nx]:
                seen[ny, nx] = True; q.append((ny, nx))
    alpha = Image.fromarray(np.where(seen, 0, 255).astype(np.uint8))
    alpha = alpha.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.7))
    out = img.convert("RGBA")
    out.putalpha(alpha)
    return out.crop(out.getbbox())


def fit(img: Image.Image, resample=Image.LANCZOS) -> Image.Image:
    if img.height > MAX_H:
        img = img.resize((round(img.width * MAX_H / img.height), MAX_H), resample)
    return img


# 仮のトランペット（ベルを上に向けて立つ姿。ベルに顔、横にピストン、白い手袋と足）
def outline(im: Image.Image, color=(74, 46, 14, 255)) -> Image.Image:
    a = np.asarray(im)
    solid = a[:, :, 3] > 0
    grow = solid.copy()
    grow[1:] |= solid[:-1]; grow[:-1] |= solid[1:]
    grow[:, 1:] |= solid[:, :-1]; grow[:, :-1] |= solid[:, 1:]
    out = a.copy()
    out[grow & ~solid] = color
    return Image.fromarray(out)


def draw_trumpet(scale=4) -> Image.Image:
    from PIL import ImageDraw
    W, H = 40, 66
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    Y, D, L, S, SD = (226, 178, 58, 255), (180, 130, 40, 255), (255, 234, 150, 255), (205, 205, 214, 255), (150, 150, 162, 255)
    # ベル（上が広いラッパ）
    d.polygon([(4, 3), (35, 3), (31, 8), (25, 13), (22, 17), (18, 17), (15, 13), (9, 8)], fill=Y)
    d.ellipse([3, 0, 36, 6], fill=L)
    d.ellipse([7, 1, 32, 5], fill=D)
    # 本管とループ
    d.rectangle([18, 17, 22, 57], fill=Y)
    d.rectangle([11, 25, 14, 47], fill=Y)
    d.rectangle([11, 22, 22, 25], fill=Y)
    d.rectangle([11, 47, 22, 50], fill=Y)
    d.line([(19, 18), (19, 56)], fill=L)
    d.line([(12, 26), (12, 46)], fill=L)
    # ピストン（3本）
    d.rectangle([17, 30, 25, 42], fill=D)
    for y in (31, 35, 39):
        d.rectangle([25, y, 29, y + 2], fill=S)
        d.rectangle([30, y, 31, y + 2], fill=SD)
    # マウスピース
    d.rectangle([18, 58, 22, 60], fill=S)
    # 顔（ベルの下の広い所）
    d.rectangle([14, 8, 15, 10], fill=(40, 30, 30, 255))
    d.rectangle([24, 8, 25, 10], fill=(40, 30, 30, 255))
    d.point([(14, 8), (24, 8)], fill=(255, 255, 255, 255))
    d.line([(18, 12), (21, 12)], fill=(150, 70, 40, 255))
    # 手袋
    d.line([(14, 36), (8, 36)], fill=(120, 110, 100, 255))
    d.line([(29, 44), (34, 44)], fill=(120, 110, 100, 255))
    d.ellipse([3, 33, 8, 39], fill=(250, 250, 250, 255))
    d.ellipse([33, 41, 38, 47], fill=(250, 250, 250, 255))
    # 足
    d.rectangle([16, 61, 17, 63], fill=(110, 80, 50, 255))
    d.rectangle([23, 61, 24, 63], fill=(110, 80, 50, 255))
    d.rectangle([14, 64, 18, 65], fill=(70, 50, 40, 255))
    d.rectangle([22, 64, 26, 65], fill=(70, 50, 40, 255))
    im = outline(im)
    return im.resize((W * scale, H * scale), Image.NEAREST)


# ファゴット（クリア時だけ登場する隠れキャラ）
def draw_bassoon(scale=4) -> Image.Image:
    from PIL import ImageDraw
    W, H = 34, 72
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    R, D, L, S = (156, 74, 42, 255), (112, 50, 30, 255), (196, 110, 70, 255), (205, 205, 214, 255)
    d.rectangle([15, 2, 21, 60], fill=R)        # 長い管（ベル側）
    d.rectangle([10, 14, 15, 60], fill=D)       # 短い管（ウイング側）
    d.line([(16, 3), (16, 59)], fill=L)
    d.rectangle([14, 0, 22, 2], fill=(230, 220, 200, 255))  # 上端の飾り
    d.line([(10, 14), (8, 11), (6, 9), (5, 6)], fill=S, width=1)  # ボーカル（細い金属管）
    d.line([(11, 14), (9, 11), (7, 9), (6, 6)], fill=S, width=1)
    d.rectangle([9, 58, 22, 64], fill=D)        # ブーツ（下の U 字部分）
    for y in (24, 30, 36, 44, 50):               # キー
        d.rectangle([21, y, 23, y + 1], fill=S)
    d.rectangle([16, 20, 17, 22], fill=(40, 30, 30, 255))   # 目
    d.rectangle([19, 20, 20, 22], fill=(40, 30, 30, 255))
    d.point([(16, 20), (19, 20)], fill=(255, 255, 255, 255))
    d.line([(17, 25), (19, 25)], fill=(90, 30, 20, 255))
    d.line([(10, 36), (5, 36)], fill=(120, 110, 100, 255))   # 腕と手袋
    d.line([(22, 40), (27, 40)], fill=(120, 110, 100, 255))
    d.ellipse([1, 33, 6, 39], fill=(250, 250, 250, 255))
    d.ellipse([27, 37, 32, 43], fill=(250, 250, 250, 255))
    d.rectangle([12, 65, 13, 68], fill=(110, 80, 50, 255))   # 足
    d.rectangle([18, 65, 19, 68], fill=(110, 80, 50, 255))
    d.rectangle([10, 69, 14, 70], fill=(70, 50, 40, 255))
    d.rectangle([17, 69, 21, 70], fill=(70, 50, 40, 255))
    im = outline(im, (60, 28, 16, 255))
    return im.resize((W * scale, H * scale), Image.NEAREST)


if __name__ == "__main__":
    for name, f in FILES.items():
        im = fit(remove_bg(Image.open(SRC / f), pockets_below=0.55 if name == "timpani" else None))
        im.save(OUT / f"{name}.png", optimize=True)
        print(name, im.size)
    im = draw_trumpet()
    im.save(OUT / "trumpet.png", optimize=True)
    print("trumpet", im.size)
    im = draw_bassoon()
    im.save(OUT / "bassoon.png", optimize=True)
    print("bassoon", im.size)
