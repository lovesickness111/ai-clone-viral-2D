# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

An agent-driven "reference video → new 2D animated video" studio. There is **no app/server**: the agent in chat is the AI Director and drives everything through files and CLI tools. `AGENTS.md` (Vietnamese) holds the user-facing 5-step pipeline and core rules. Read it, and follow it.

This repo was cut down from **ReelMimic**. `docs/ARCHITECTURE.md`, `docs/HARNESS.md` and `CONTRACT.md` still mention `app/server/*.ts`, `job.json`, `.claude/harness/` hooks and "the App". **None of those exist here.** Read those parts as a description of the workflow the agent now runs by hand: the stages, gates and file outputs are the same, and nothing enforces them automatically.

## Where the skills live

`.agents/skills/` is the only real, git-tracked copy of every skill. Codex CLI and Gemini CLI both read that folder directly. Claude Code only reads `.claude/skills/`, so `npm run link-skills` (which also runs on `npm install`) creates `.claude/skills` as a junction pointing to `.agents/skills`. That junction is gitignored.

Always edit and add skills under `.agents/skills/`, and refer to paths as `.agents/skills/...`. `.gemini/settings.json` makes Gemini load `AGENTS.md` as its context file, and Codex reads `AGENTS.md` natively.

## Commands

```bash
npm run doctor                       # environment check (node, python, ffmpeg/ffprobe, Chrome, disk)
pip install -r requirements.txt      # numpy, opencv, scenedetect, librosa, yt-dlp, faster-whisper, pytest

# Core tools (all in .agents/skills/video-clone/scripts/, each has a usage docstring at the top)
python .agents/skills/video-clone/scripts/analyze.py <file-or-url> --out projects/<id>/analysis
python .agents/skills/video-clone/scripts/clip_strip.py <video> --range a:b [--vs analysis/proxy.mp4 --vs-range c:d] --out x.jpg
python .agents/skills/video-clone/scripts/motion_score.py from-ref|validate|compile|predict|optimize projects/<id>[/build/score]
python .agents/skills/video-clone/scripts/hf_frames.py projects/<id>/build --times 0.5,1.0,2.5
python .agents/skills/video-clone/scripts/motion_check.py out/video.mp4 --out out/check/motion
python .agents/skills/video-clone/scripts/compare.py projects/<id> [--video out/video.mp4]
python .agents/skills/video-clone/scripts/fingerprint.py project projects/<id>
python .agents/skills/video-clone/scripts/fetch_assets.py search --kind image|audio --q "..."   # then `get` (writes assets/ASSETS.md)
python .agents/skills/video-clone/scripts/align_lyrics.py <audio> inputs/lyrics.txt --out analysis/lyrics/subs.lrc
python .agents/skills/video-clone/scripts/yating_tts.py "text" --out l1.wav   # Taiwan Mandarin TTS, needs YATING_KEY

# Tests (pytest; conftest puts scripts/ and tests/ on sys.path, synth.py builds synthetic videos)
python -m pytest .agents/skills/video-clone/scripts/tests
python -m pytest .agents/skills/video-clone/scripts/tests/test_fingerprint.py -k <name>
```

Set `HF_CACHE_DIR=projects/.cache/hf_frame_cache` when you render HyperFrames frames. Every cache and temp output must stay under `projects/.cache/` on drive E, never in `C:\` temp. Optional keys and paths (`YATING_KEY`, `PIXABAY_KEY`, `FREESOUND_KEY`, `FFMPEG_DIR`, `CHROME_PATH`, `PYTHON`) go in `~/.ai-clone-viral-reel/secrets.json` or `~/.reelmimic/secrets.json` (see `secrets.example.json`). Never write to a secrets.json file.

## Architecture

**Layers talk only through files.** `.agents/skills/video-clone/CONTRACT.md` is the spec for every file in `projects/<id>/`: `analysis/report.json`, `fingerprint.json`, `STYLE.md`, `peaks.json`, `route.json`, `plan.json`, `STORYBOARD.md`, `build/production.json`, `build/score/`, the review/fixes/critique JSONs under `out/check/`, and `out/video.mp4`. Write files with exactly those paths and fields. `projects/` is gitignored and must never be committed.

**`video-clone` is the orchestrator skill, and it draws nothing itself.** Its `SKILL.md` defines the stages:
1. Analyze the reference: run `analyze.py`, then actually look at `sheet_1fps.jpg` and `sheet_scenes.jpg`.
2. Write `STYLE.md` with the medium on its first line, then confirm the climaxes from `clip_strip.py` strips and write `peaks.json`.
3. Route to a style. The router reads `styles/*.md` (but not `_TEMPLATE.md` or `_disabled/`), filters by `medium`, scores against the recognition cues and breaks ties on `priority`. It skips any style whose `engine` folder under `.agents/skills/` doesn't exist.
4. Load that engine skill with the Skill tool. From then on, its instructions plus the style file's defaults and "known pitfalls" take precedence.
5. Write the plan. Every shot maps to a reference shot (`ref_shot`, `ref_what`, and an engine-ready `camera`), and the peak shots are marked `hero`.
6. Production runs as gated passes: cast sheet review → chunked shot builds with fresh-reviewer loops (max 3 rounds) → assemble plus `motion_check.py` → final critique, which includes a peak face-off against the reference.

Do not start production until the user approves the plan.

**Engines** are ordinary skills under `.agents/skills/<engine>/`:
- Canvas/p5 frame-by-frame engines: `painted-animation`, `anime-cel`, `crayon-storybook`, `paper-cutout`, `pixel-art`, `whiteboard`.
- The HyperFrames family: `hyperframes*`, `general-video`, `motion-graphics`, `faceless-explainer`, and others.
- `blender-product-film`, whose 3D styles are disabled.

The canvas engines share `video-clone/assets/engine-kit/`:
- `kit.js`: timeline/easing/camera helpers and the `window.ENGINE` plug-in point.
- `render.mjs`: headless-Chrome renderer with `--sheet/--strip/--crop/--stills/--frames/--encode`.
- `studio.html`.

`ENGINE_BRIEF.md` explains how to build a new engine.

**Motion Score (the "style compiler", `docs/COMPILER.md`).** `scripts/perception/` measures a film into a Style Fingerprint: per-frame camera, fitted eases, tension curve, cut/beat phase, cadence and color. `scripts/score/` turns the reference's camera into Motion Score IR (`build/score/film.json` plus `shots/<id>.json`, with beat-anchored times like `"B12-2f"` and `"P1_hit+1b"`). It predicts style distance before rendering and compiles to `build/src/score.js`. Scenes read the camera from it with `Score.cam(id, t)` → `camBegin(...)` and never hand-write it. `scripts/optimize/` is a CMA-ES search that tunes score parameters against the style distance. `compare.py` and `fingerprint.py` close the loop on the rendered film.

**2D vector characters** must be built with `video-clone/assets/vector_rig/` (a skeleton plus a single-piece outline; see its README), never from loose circles and rectangles. Each character gets its own `build/assets/cast/<name>.js`.

## Rules that are easy to miss

- **2D only.** A 3D or live-action reference gets recreated in the nearest 2D style, and you must say so explicitly in `route.json` and to the user.
- **Assets.** Use only CC0/CC-BY/Pixabay/Freesound assets through `fetch_assets.py`, and record every one in `assets/ASSETS.md`. Never fetch commercial music: the music comes from the user or from those libraries.
- **Lyrics and subtitles.** Use only the lyrics the user provides; never transcribe or invent them.
- **Reference video.** Learn its techniques only, never copy its frames, characters or logos. Characters are original unless the user supplies or names one.
- **Judging motion.** Judge motion from 12fps consecutive strips, not stills. Never hide a missing action behind a white flash or a transition.
- **Pass bar.** Every shot must reach a style-similarity score of ≥ 4.0/5 against the reference. Every "fixed" claim needs before/after full-resolution crops in the relevant `fixes.json`.
- **Default format.** AGENTS.md defaults to 9:16 1080×1920. SKILL.md's 30 s / 16:9 default is older, so prefer AGENTS.md unless the reference or the user says otherwise.
- **New styles.** To add one, copy `styles/_TEMPLATE.md`. Each time production hits a new pitfall, add it to that style file's "known pitfalls" section.
