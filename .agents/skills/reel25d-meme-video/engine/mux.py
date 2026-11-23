"""Frames + bed + voice lines + sound effects -> MP4, from the timeline shoot.mjs wrote.

    .venv/Scripts/python.exe reel25d/mux.py output/skydive_meme --director director/skydive_meme.json

Audio layout: director.audio.bed loops under everything (gain), each beat's voice line starts at the
beat's resolved time, each beat's `sfx` {file, gain?, offset?} too. Everything is trimmed to the video.
"""
import argparse
import json
import shutil
import subprocess
from pathlib import Path


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('run')
    ap.add_argument('--director', required=True)
    ap.add_argument('--out', help='default <run>/video.mp4')
    ap.add_argument('--crf', default='18')
    args = ap.parse_args()
    ffmpeg = shutil.which('ffmpeg') or exit('ffmpeg not in PATH')
    run = Path(args.run)
    d = json.loads(Path(args.director).read_text(encoding='utf-8'))
    tl = json.loads((run / 'timeline.json').read_text(encoding='utf-8'))
    inp = Path(d['input'])
    fps, dur = tl['fps'], tl['duration']
    out = Path(args.out) if args.out else run / 'video.mp4'

    inputs = ['-framerate', str(fps), '-i', str(run / 'frames' / 'frame_%04d.png')]
    chains, mix = [], []
    n = 1
    bed = (d.get('audio') or {}).get('bed')
    if bed:
        inputs += ['-stream_loop', '-1', '-i', str(inp / bed['file'])]
        chains.append(f"[{n}:a]atrim=0:{dur},volume={bed.get('gain', 1)}[bed]"); mix.append('[bed]'); n += 1
    for b in tl['beats']:
        events = []
        if b.get('voiceFile'):
            events.append((run / b['voiceFile'], d.get('voiceGain', 1), 0))
        if b.get('sfx'):
            s = b['sfx'] if isinstance(b['sfx'], dict) else {'file': b['sfx']}
            events.append((inp / s['file'], s.get('gain', 1), s.get('offset', 0)))
        for file, gain, offset in events:
            ms = max(0, int(round((b['t'] + offset) * 1000)))
            inputs += ['-i', str(file)]
            chains.append(f"[{n}:a]adelay={ms}:all=1,volume={gain}[a{n}]"); mix.append(f'[a{n}]'); n += 1
    cmd = [ffmpeg, '-y', '-loglevel', 'error', *inputs]
    if mix:
        chains.append(''.join(mix) + f"amix=inputs={len(mix)}:normalize=0:duration=longest,alimiter=limit=0.95:level=disabled,atrim=0:{dur},apad=whole_dur={dur}[a]")
        cmd += ['-filter_complex', ';'.join(chains), '-map', '0:v', '-map', '[a]', '-c:a', 'aac', '-b:a', '160k']
    cmd += ['-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', args.crf, '-movflags', '+faststart', '-shortest', str(out)]
    subprocess.run(cmd, check=True)
    probe = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'stream=codec_type,duration', '-of', 'compact', str(out)],
                           capture_output=True, text=True).stdout.strip()
    print(f'wrote {out}\n{probe}')


if __name__ == '__main__':
    main()
