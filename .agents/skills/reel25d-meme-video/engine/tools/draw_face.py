"""Draw Roblox-classic-style face textures (transparent PNG) for blocky actors.

    .venv/Scripts/python.exe reel25d/tools/draw_face.py smirk input/<run>/sprites/face_smirk.png [light]
    .venv/Scripts/python.exe reel25d/tools/draw_face.py kid   input/<run>/sprites/face_kid.png

Presets: smirk (confident adult — lens eyes, raised brow, lopsided smile), kid (big round eyes, open smile).
Third arg `light` draws with near-white ink for DARK heads (dark ink on a dark head is invisible).
Canvas 380x240; in the director use size ≈ [0.95, 0.6] head units.
"""
import sys

from PIL import Image, ImageDraw

W, H = 380, 240
INK = (235, 233, 230, 255) if 'light' in sys.argv[3:] else (24, 22, 22, 255)


def smirk(d):
    for cx in (105, 275):  # tall lens eyes
        d.ellipse([cx - 26, 52, cx + 26, 128], fill=INK)
    d.line([62, 38, 128, 26], fill=INK, width=13)    # raised brow left
    d.line([252, 26, 318, 38], fill=INK, width=13)   # raised brow right
    d.arc([96, 96, 300, 208], start=15, end=130, fill=INK, width=15)  # lopsided closed smile


def kid(d):
    for cx in (105, 275):  # big round eyes with pupils + highlight
        d.ellipse([cx - 44, 46, cx + 44, 134], fill=(250, 250, 250, 255), outline=INK, width=7)
        d.ellipse([cx - 17, 72, cx + 17, 106], fill=INK)
        d.ellipse([cx - 2, 78, cx + 12, 92], fill=(250, 250, 250, 255))
    d.chord([128, 128, 252, 214], start=0, end=180, fill=(96, 42, 38, 255), outline=INK, width=8)  # open smile
    d.chord([152, 146, 228, 196], start=0, end=180, fill=(252, 250, 246, 255))  # teeth inside the upper mouth


def deadpan(d):
    for cx in (110, 270):  # flat half-closed eyes
        d.rounded_rectangle([cx - 30, 84, cx + 30, 104], radius=10, fill=INK)
    d.line([150, 176, 230, 176], fill=INK, width=12)   # straight mouth


def emoji(d):
    # yellow 'flushed / wide-eyed' sticker covering the whole face
    d.ellipse([20, 0, 360, 240], fill=(255, 205, 40, 255), outline=(110, 70, 0, 255), width=8)
    for cx in (125, 255):
        d.ellipse([cx - 52, 40, cx + 52, 150], fill=(255, 255, 255, 255), outline=(40, 26, 0, 255), width=7)
        d.ellipse([cx - 14, 82, cx + 14, 110], fill=(20, 14, 0, 255))
    d.ellipse([170, 178, 210, 206], fill=(110, 40, 16, 255), outline=(40, 26, 0, 255), width=5)


PRESETS = {'smirk': smirk, 'kid': kid, 'deadpan': deadpan, 'emoji': emoji}

preset, out = sys.argv[1], sys.argv[2]
img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
PRESETS[preset](ImageDraw.Draw(img))
img.save(out)
print(f'wrote {out} ({preset})')
