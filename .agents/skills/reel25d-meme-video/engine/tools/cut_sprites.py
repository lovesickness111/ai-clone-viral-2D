"""Cut sprites out of video frames (or images) from a spec, so the input folder is reproducible.

    .venv/Scripts/python.exe reel25d/tools/cut_sprites.py input/skydive_meme/sprites.json

Spec: {"video": "...mp4" | "image": "...png", "out": "<dir>",
       "cuts": [{"name", "t" (seconds, video only), "box": [x0,y0,x1,y1], "method": "rembg"|"luma"|"none",
                 "pad"?: px kept around the alpha bbox}],
       "samples": {"label": {"t", "box"}}}      # prints the mean colour of a region (to match 3D materials)
Methods: rembg = AI matting (u2net, CPU); luma = black background to alpha (fire, glows);
ellipse = soft oval mask inscribed in the box (sticker look, `feather` px); none = opaque crop
(textures pasted onto a 3D face).
"""
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image

spec_path = Path(sys.argv[1])
spec = json.loads(spec_path.read_text(encoding='utf-8'))
root = Path.cwd()
out = root / spec['out']
out.mkdir(parents=True, exist_ok=True)
ffmpeg = shutil.which('ffmpeg') or sys.exit('ffmpeg not in PATH')
tmp = Path(tempfile.mkdtemp())
_frames = {}


def frame(t):
    if 'image' in spec:
        return Image.open(root / spec['image']).convert('RGB')
    if t not in _frames:
        f = tmp / f'f_{t}.png'
        subprocess.run([ffmpeg, '-y', '-loglevel', 'error', '-ss', str(t), '-i', str(root / spec['video']), '-frames:v', '1', str(f)], check=True)
        _frames[t] = Image.open(f).convert('RGB')
    return _frames[t]


_session = None
def cut_rembg(img):
    global _session
    from rembg import remove, new_session
    _session = _session or new_session('u2net')
    return remove(img, session=_session, post_process_mask=True).convert('RGBA')


def cut_luma(img):
    a = np.asarray(img.convert('RGB')).astype(np.float32) / 255
    alpha = np.clip(a.max(axis=2) * 1.15, 0, 1)
    alpha = np.where(alpha < .06, 0, alpha)  # kill the dark fringe
    rgb = np.clip(a / np.maximum(alpha, 1e-3)[..., None], 0, 1)  # un-premultiply so edges stay bright
    return Image.fromarray((np.dstack([rgb, alpha]) * 255).astype(np.uint8), 'RGBA')


def cut_ellipse(img, feather=14):
    """Sticker-style: keep the ellipse inscribed in the box, soft edge (for round faces on busy backgrounds)."""
    w, h = img.size
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    r = np.sqrt(((xx - (w - 1) / 2) / (w / 2)) ** 2 + ((yy - (h - 1) / 2) / (h / 2)) ** 2)
    alpha = np.clip((1 - r) * (w / 2) / feather, 0, 1)
    return Image.fromarray(np.dstack([np.asarray(img.convert('RGB')), (alpha * 255).astype(np.uint8)]), 'RGBA')


def trim(img, pad):
    a = np.asarray(img)[..., 3]
    ys, xs = np.where(a > 8)
    if len(xs) == 0:
        return img
    x0, x1, y0, y1 = max(0, xs.min() - pad), min(img.width, xs.max() + 1 + pad), max(0, ys.min() - pad), min(img.height, ys.max() + 1 + pad)
    return img.crop((x0, y0, x1, y1))


for c in spec.get('cuts', []):
    img = frame(c.get('t')).crop(tuple(c['box']))
    m = c.get('method', 'rembg')
    if m == 'rembg':
        img = trim(cut_rembg(img), c.get('pad', 2))
    elif m == 'luma':
        img = trim(cut_luma(img), c.get('pad', 2))
    elif m == 'ellipse':
        img = cut_ellipse(img, c.get('feather', 14))
    else:
        img = img.convert('RGBA')
    dest = out / f"{c['name']}.png"
    img.save(dest)
    print(f"{c['name']:12s} {img.width}x{img.height}  {m}  -> {dest}")

for label, s in spec.get('samples', {}).items():
    a = np.asarray(frame(s.get('t')).crop(tuple(s['box']))).reshape(-1, 3).mean(axis=0)
    print(f"sample {label}: #{int(a[0]):02x}{int(a[1]):02x}{int(a[2]):02x}")
