#!/usr/bin/env python3
"""frame_A.png の面色 #FFFAF2 を透過にする（金の飾りは残す）。ラボ用。"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "public/template/frames/frame_A.png"
DST = ROOT / "public/template/frames/frame_A_keyout.png"
FILL = (255, 250, 242)


def main() -> None:
    im = Image.open(SRC).convert("RGBA")
    w, h = im.size
    px = im.load()
    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    opx = out.load()
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 8:
                continue
            d = abs(r - FILL[0]) + abs(g - FILL[1]) + abs(b - FILL[2])
            if d <= 18:
                continue
            if d <= 48:
                t = (d - 18) / 30.0
                opx[x, y] = (r, g, b, int(a * t))
                continue
            opx[x, y] = (r, g, b, a)
    out.save(DST)
    print(f"wrote {DST}")


if __name__ == "__main__":
    main()
