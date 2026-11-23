"""Speak the captions of a reel25d director with edge-tts (Microsoft Edge online voices).

Every beat that has both `caption` and `voice` (a key of director.voices) gets one wav in
<out>/voice/line_NN.wav; <out>/voice/voice.json records the file and its length per beat index
so shoot.mjs can stretch the schedule. Clips are cached by content, so re-running is free.

    .venv/Scripts/python.exe reel25d/voice.py director/skydive_meme.json --out output/skydive_meme
"""
import argparse
import asyncio
import hashlib
import json
import re
import shutil
import subprocess
import wave
from pathlib import Path


def speakable(text):
    """Strip emoticons and meme punctuation the voice should not read."""
    text = re.sub(r'[:=]\)+|:\(+|=\)+|\)\)+', '', text)
    text = re.sub(r'\s+', ' ', text).strip(' ,')
    return text


async def synth(text, cfg, mp3, tries=12):
    """The Edge service answers with no audio for a perfectly fine request about half the time some days
    (same text, same voice, next try works): retry with backoff."""
    import edge_tts
    kw = {k: cfg[k] for k in ('rate', 'pitch', 'volume') if k in cfg}
    for i in range(tries):
        try:
            await edge_tts.Communicate(text, cfg['voice'], **kw).save(str(mp3))
            return
        except edge_tts.exceptions.NoAudioReceived:
            if i == tries - 1:
                raise
            print(f'   retry {i + 1}: {text}')
            await asyncio.sleep(2.0 + i)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('director')
    ap.add_argument('--out', required=True)
    args = ap.parse_args()
    ffmpeg = shutil.which('ffmpeg') or exit('ffmpeg not in PATH')
    d = json.loads(Path(args.director).read_text(encoding='utf-8'))
    vdir = Path(args.out) / 'voice'
    vdir.mkdir(parents=True, exist_ok=True)
    lines = {}
    for i, b in enumerate(d['beats']):
        if not (b.get('caption') and b.get('voice')):
            continue
        cfg = d['voices'][b['voice']]
        text = b.get('say') or speakable(b['caption'])
        key = hashlib.sha1(json.dumps([text, cfg], sort_keys=True).encode()).hexdigest()[:10]
        wav = vdir / f'line_{i:02d}_{key}.wav'
        if not wav.exists():
            mp3 = vdir / f'_{key}.mp3'
            asyncio.run(synth(text, cfg, mp3))
            subprocess.run([ffmpeg, '-y', '-loglevel', 'error', '-i', str(mp3),
                            '-af', 'silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse',
                            '-ar', '44100', '-ac', '1', str(wav)], check=True)
            mp3.unlink()
        with wave.open(str(wav)) as w:
            seconds = w.getnframes() / w.getframerate()
        lines[str(i)] = {'file': wav.name, 'seconds': round(seconds, 3), 'text': text, 'voice': b['voice']}
        print(f'{i:2d} {b["voice"]:9s} {seconds:5.2f}s  {text}')
    for old in vdir.glob('line_*.wav'):  # drop clips no beat uses any more
        if old.name not in {l['file'] for l in lines.values()}:
            old.unlink()
    (vdir / 'voice.json').write_text(json.dumps({'lines': lines}, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f'{len(lines)} lines -> {vdir / "voice.json"}')


if __name__ == '__main__':
    main()
