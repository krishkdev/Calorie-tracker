#!/usr/bin/env python3
"""Generate PWA icons into public/icons/ (requires Pillow).

Run: npm run icons
The icon is a green rounded square with a partial white ring (the calorie ring).
"""
from pathlib import Path

from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / "public" / "icons"
BRAND = (22, 163, 74, 255)  # #16a34a
WHITE = (255, 255, 255, 255)


def draw_icon(size: int, maskable: bool) -> Image.Image:
    scale = 4  # supersample for smooth edges
    s = size * scale
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if maskable:
        # Maskable icons must fill the whole canvas; keep art inside the safe zone (80%).
        d.rectangle([0, 0, s, s], fill=BRAND)
        inset = s * 0.10
    else:
        d.rounded_rectangle([0, 0, s - 1, s - 1], radius=int(s * 0.22), fill=BRAND)
        inset = 0
    cx = cy = s / 2
    r = (s - 2 * inset) * 0.27
    w = (s - 2 * inset) * 0.095
    box = [cx - r, cy - r, cx + r, cy + r]
    # Partial ring from 12 o'clock going clockwise ~270 degrees.
    d.arc(box, start=-90, end=180, fill=WHITE, width=int(w))
    dot = (s - 2 * inset) * 0.08
    d.ellipse([cx - dot, cy - dot, cx + dot, cy + dot], fill=WHITE)
    return img.resize((size, size), Image.LANCZOS)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    draw_icon(192, False).save(OUT / "icon-192.png")
    draw_icon(512, False).save(OUT / "icon-512.png")
    draw_icon(512, True).save(OUT / "icon-maskable-512.png")
    apple = draw_icon(180, True).convert("RGB")  # iOS ignores transparency; use solid bg
    apple.save(OUT / "apple-touch-icon.png")
    print(f"wrote icons to {OUT}")


if __name__ == "__main__":
    main()
