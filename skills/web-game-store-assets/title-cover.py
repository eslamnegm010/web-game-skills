#!/usr/bin/env python3
"""Store covers from finished art: resizes each picture to its cover size and adds the game's name.

  title-cover.sh --title "EXAMPLE|GAME" --art <dir> --out <dir> [--font file.ttf]     (or: python3 title-cover.py ...)
                 [--colors "#f0ffff/#00d6ff,#fff0f6/#ff1e6e"] [--only landscape,portrait,square]

<art dir> holds landscape.png (16:9), portrait.png (2:3) and square.png, with NO text in the art.
"|" in the title starts a new line; each line takes the next fill/edge colour pair.
Writes cover-landscape-1920x1080.png, cover-portrait-800x1200.png, cover-square-800x800.png.
The title is large on purpose: a cover is mostly seen as a small card."""
import argparse
import os
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont

# name, size, title height / cover width, centre x / width, top y / height
COVERS = [
    ("landscape", (1920, 1080), 0.086, 0.5, 0.70),
    ("portrait", (800, 1200), 0.158, 0.5, 0.715),
    ("square", (800, 800), 0.128, 0.5, 0.715),
]
_WINDIR = os.environ.get("WINDIR", "C:\\Windows")
FONTS = [
    "/System/Library/Fonts/Supplemental/Impact.ttf",
    "/System/Library/Fonts/Supplemental/Arial Black.ttf",
    os.path.join(_WINDIR, "Fonts", "impact.ttf"),  # Windows: Impact
    os.path.join(_WINDIR, "Fonts", "ariblk.ttf"),  # Windows: Arial Black
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    os.path.join(_WINDIR, "Fonts", "arialbd.ttf"),  # Windows: Arial Bold
]


def rgba(text):
    """#rgb, #rgba, #rrggbb or #rrggbbaa -> (r, g, b, a)."""
    h = text.strip().lstrip("#")
    if len(h) in (3, 4):
        h = "".join(c * 2 for c in h)
    if len(h) == 6:
        h += "ff"
    try:
        if len(h) != 8:
            raise ValueError
        return tuple(int(h[i : i + 2], 16) for i in (0, 2, 4, 6))
    except ValueError:
        sys.exit(f"bad colour {text!r}: use #rgb, #rrggbb or #rrggbbaa")


def cover_fit(image, width, height):
    """Scale to cover the target, then crop around the centre."""
    ratio = max(width / image.width, height / image.height)
    image = image.resize((round(image.width * ratio), round(image.height * ratio)), Image.LANCZOS)
    x, y = (image.width - width) // 2, (image.height - height) // 2
    return image.crop((x, y, x + width, y + height))


def word(canvas, text, font, cx, y, fill, edge):
    layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    box = draw.textbbox((0, 0), text, font=font)
    x, y0 = cx - (box[2] - box[0]) / 2 - box[0], y - box[1]
    size = font.size
    draw.text((x, y0), text, font=font, fill=edge, stroke_width=max(3, int(size * 0.05)), stroke_fill=edge)
    draw.text((x, y0), text, font=font, fill=fill)
    glow = layer.filter(ImageFilter.GaussianBlur(size * 0.12))
    glow.putalpha(glow.getchannel("A").point(lambda v: min(255, int(v * 0.8))))
    return Image.alpha_composite(Image.alpha_composite(canvas, glow), layer), box[3] - box[1]


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--title", required=True)
    ap.add_argument("--art", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--font")
    ap.add_argument("--colors", default="#f0ffff/#00d6ff,#fff0f6/#ff1e6e")
    ap.add_argument("--only", default="landscape,portrait,square")
    a = ap.parse_args()

    font_file = a.font or next((f for f in FONTS if os.path.exists(f)), None)
    if not font_file:
        sys.exit("no font found: pass --font <file.ttf>")
    colors = [tuple(rgba(c) for c in pair.split("/")) for pair in a.colors.split(",")]
    lines = a.title.split("|")
    os.makedirs(a.out, exist_ok=True)
    for name, (width, height), title_size, cx, top in COVERS:
        if name not in a.only.split(","):
            continue
        source = next((os.path.join(a.art, name + ext) for ext in (".png", ".jpg", ".jpeg", ".webp") if os.path.exists(os.path.join(a.art, name + ext))), None)
        if not source:
            sys.exit(f"missing art: {a.art}/{name}.png")
        cover = cover_fit(Image.open(source).convert("RGB"), width, height)
        cover = cover.filter(ImageFilter.UnsharpMask(radius=1.4, percent=60, threshold=2)).convert("RGBA")
        size = int(width * title_size)
        font = ImageFont.truetype(font_file, size)
        # Shrink until the longest line fits with a margin.
        longest = max(lines, key=len)
        while size > 20 and ImageDraw.Draw(cover).textlength(longest, font=font) > width * 0.92:
            size = int(size * 0.94)
            font = ImageFont.truetype(font_file, size)
        y = height * top - (len(lines) - 1) * size * 0.6
        for i, line in enumerate(lines):
            fill, edge = colors[i % len(colors)]
            cover, line_height = word(cover, line, font, width * cx, y, fill, edge)
            y += line_height * 1.18
        out = os.path.join(a.out, f"cover-{name}-{width}x{height}.png")
        cover.convert("RGB").save(out)
        print(out)


if __name__ == "__main__":
    main()
