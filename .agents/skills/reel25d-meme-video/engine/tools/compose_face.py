"""Paste an overlay (e.g. a smiling mouth) onto a base face sprite, keeping the rest of the face.
The overlay gets rounded corners and a feathered edge so it sits like a meme cut-out, not a hard rectangle.

    .venv/Scripts/python.exe reel25d/tools/compose_face.py base.png overlay.png out.png \
        --center 0.56 0.78 --width 0.5 [--radius 0.25] [--feather 5]

--center x y   overlay centre as fractions of the base size
--width w      overlay width as a fraction of the base width (aspect kept)
"""
import argparse

from PIL import Image, ImageChops, ImageDraw, ImageFilter

ap = argparse.ArgumentParser()
ap.add_argument('base'); ap.add_argument('overlay'); ap.add_argument('out')
ap.add_argument('--center', nargs=2, type=float, required=True)
ap.add_argument('--width', type=float, required=True)
ap.add_argument('--radius', type=float, default=0.25, help='corner radius as a fraction of overlay height')
ap.add_argument('--feather', type=float, default=5, help='edge blur in px')
a = ap.parse_args()

base = Image.open(a.base).convert('RGBA')
over = Image.open(a.overlay).convert('RGBA')
w = round(base.width * a.width)
h = round(over.height * w / over.width)
over = over.resize((w, h), Image.LANCZOS)

mask = Image.new('L', (w, h), 0)
ImageDraw.Draw(mask).rounded_rectangle([0, 0, w - 1, h - 1], radius=round(h * a.radius), fill=255)
if a.feather:
    mask = mask.filter(ImageFilter.GaussianBlur(a.feather))

pos = (round(base.width * a.center[0] - w / 2), round(base.height * a.center[1] - h / 2))
out = base.copy()
out.paste(over, pos, ImageChops.multiply(over.split()[3], mask))
out.save(a.out)
print(f'wrote {a.out} overlay {w}x{h} at {pos}')
