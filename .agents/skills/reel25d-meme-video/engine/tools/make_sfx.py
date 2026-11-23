"""Synthesise the stock sounds a meme reel needs (no downloads, no licences):
wind bed and explosion with ffmpeg; boom and whoosh with numpy, ported from
E:/Sourcecode/fitness-workflow-kit tools/fitness_sfx.py (pitch-swept boom, lowpass-swept whoosh).

    .venv/Scripts/python.exe reel25d/tools/make_sfx.py input/skydive_meme/audio
"""
import shutil
import subprocess
import sys
import wave
from pathlib import Path

import numpy as np

SR = 44100
rng = np.random.default_rng(7)

out = Path(sys.argv[1] if len(sys.argv) > 1 else 'input/skydive_meme/audio')
out.mkdir(parents=True, exist_ok=True)
ffmpeg = shutil.which('ffmpeg') or exit('ffmpeg not in PATH')
run = lambda *a: subprocess.run([ffmpeg, '-y', '-loglevel', 'error', *a], check=True)


def env(n, attack, release):
    t = np.arange(n) / SR
    a = np.clip(t / attack, 0, 1) if attack else np.ones(n)
    return a * np.exp(-np.maximum(t - attack, 0) / release)


def lowpass_sweep(x, f0, f1):
    """One-pole low-pass whose cutoff glides from f0 to f1."""
    fc = np.geomspace(f0, f1, len(x))
    alpha = 1 - np.exp(-2 * np.pi * fc / SR)
    y, outp = 0.0, np.empty_like(x)
    for i, v in enumerate(x):
        y += alpha[i] * (v - y)
        outp[i] = y
    return outp


def boom(d=1.2, f0=95, f1=42):
    """Cinematic surprise hit: a tone sweeping down an octave plus a swept-noise click."""
    n = int(SR * d)
    f = np.geomspace(f0, f1, n)
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, 0.003, 0.30)
    click = lowpass_sweep(rng.standard_normal(n), 3000, 400) * env(n, 0.0005, 0.02)
    return 0.95 * (tone + 0.6 * click)


def whoosh(d=0.5):
    n = int(SR * d)
    x = lowpass_sweep(rng.standard_normal(n), 250, 4000)
    x -= lowpass_sweep(x, 120, 600)  # thin out the rumble
    shape = np.sin(np.pi * np.linspace(0, 1, n)) ** 2
    return 0.9 * x * shape / (np.abs(x).max() + 1e-9)


def write(name, x):
    pcm = (np.clip(x, -1, 1) * 32767).astype('<i2')
    with wave.open(str(out / name), 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())


# wind: brown noise, low-passed, with two slow tremolos beating against each other for gusts
run('-f', 'lavfi', '-i', 'anoisesrc=color=brown:seed=7:duration=60:amplitude=0.7',
    '-af', 'lowpass=f=900,highpass=f=60,tremolo=f=0.23:d=0.45,tremolo=f=0.11:d=0.35,volume=1.6,alimiter=limit=0.8',
    '-ar', '44100', '-ac', '1', str(out / 'wind.wav'))
# explosion: a sharp noise burst decaying over ~2.5 s plus a 50 Hz thump
run('-f', 'lavfi', '-i', 'anoisesrc=color=pink:seed=3:duration=2.6:amplitude=1',
    '-f', 'lavfi', '-i', 'sine=f=50:duration=1.4',
    '-filter_complex',
    '[0:a]afade=t=in:d=0.01,afade=t=out:st=0.05:d=2.5:curve=exp,lowpass=f=1800,volume=2.2[n];'
    '[1:a]afade=t=out:st=0.0:d=1.4:curve=exp,volume=1.6[t];'
    '[n][t]amix=inputs=2:normalize=0,alimiter=limit=0.95[a]',
    '-map', '[a]', '-ar', '44100', '-ac', '1', str(out / 'explosion.wav'))
write('boom.wav', boom())
write('whoosh.wav', whoosh())
print('wrote', *(p.name for p in sorted(out.glob('*.wav'))))
