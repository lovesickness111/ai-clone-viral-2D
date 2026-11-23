---
name: reel25d-meme-video
description: >-
  Make 2.5D cut-out meme reels (3:4 Facebook/TikTok, the "Roblox body + pasted photo face" look) with the reel25d engine:
  one photo background riding on the camera, PNG cut-out billboards, blocky R6-style characters built from rounded
  boxes with a photo/drawn face texture, meme caption on top, pop-on reaction stickers, a photo explosion and a hard cut
  to black. The script is ONE director JSON (actors, shots, beats) — no per-video JS. Use when a reference or brief is a
  meme skit made of photo cut-outs and blocky "người giả 2.5D" characters, or when the video-clone router picks the
  meme-25d-collage style. Read before editing a director or rendering, even for a single still.
---

# 2.5D meme reels with reel25d

Engine: `engine/` in this skill (three.js + Chrome headless via playwright-core, SwiftShader). Every frame is a pure
function of the frame number. Director schema and engine commands: `engine/README.md`. Worked example:
`projects/20261123-meme-vn/styletest/reel25d/director.json` (eatery skit, 13.3 s). The original skydive example is
`engine/example_director.json`. Ported from `E:/Source code/ai-3d-scene-video/reel25d` (same author's repo).

## Licensing rule (this repo): nothing is cut from the reference

The upstream workflow cut sprites (meme faces, a real person's reaction face) straight out of the reference reel and
marked them "internal only". Here that is not allowed (video-clone rule: learn the technique, never copy the frames,
characters or assets; no real people's faces). Instead:
- **Background**: a CC0 / CC BY photo (Openverse via `video-clone/scripts/fetch_assets.py search --kind image`), or a
  photo the user took. Avoid CC BY-SA (share-alike would bind the whole video). Paint over real brand signage with an
  original sign (PIL) before cropping to 3:4.
- **Faces**: CC BY animal photos cropped to a soft oval (`PIL` ellipse mask + feather) — the pasted-photo-face look — or
  drawn faces (`engine/tools/draw_face.py`: `smirk`, `kid`, `deadpan`, `emoji`). No photos of real people's faces.
- **Explosion / props**: CC BY photos; fire on black → luma key (alpha from max(R,G,B)).
- Record every file with `fetch_assets.py get --project projects/<id>` (writes `assets/ASSETS.md`).

## Workflow

```bash
cd .agents/skills/reel25d-meme-video/engine && npm install && npm run build     # once, and after every scene.js edit
# assets → projects/<id>/<run>/input/{bg.jpg, sprites/*.png}
node shoot.mjs --director <abs>/director.json --out <abs>/out --times 0.5,9.5,11.9      # stills first, LOOK at them
node shoot.mjs --director <abs>/director.json --out <abs>/out                            # full frames (~0.3–1.5 s/frame)
python mux.py <abs>/out --director <abs>/director.json                                   # video.mp4 (voice + sfx from timeline.json)
```
`input` in the director is resolved against the engine's parent, the cwd, then the director's own folder — keep the
director next to its `input/`. Global `npx` is broken on this machine; call `node` directly. Keep TMP/TEMP on drive E.

Voice: `voice.py` uses edge-tts (`pip install edge-tts`; flaky ~50 %, run under `timeout 90` with retries,
`PYTHONUTF8=1`). Alternative already proven here: pre-made gTTS lines placed as `sfx` at measured times (no voice
stretching).

## Engine additions made in this repo (scene.js)

- blocky `headColor` (head ≠ shirt colour), `bulk` (broader torso + thicker arms: buff character), `headScale`
  (meme big-head; the face texture scales with it — 1.45 matches "photo face as wide as the torso").
- `prop` actor: `shape: box {size:[w,h,d]}` or `cylinder {radius, radiusBottom, height}`, `color/metalness/roughness`,
  optional `legs`. A solid box counter (`size [3.4, 0.72, 0.7]`) in front of the characters hides their legs, like a
  table in the reference.
- blocky `outfit` — clothes instead of plain blocks (a bare block reads as a box, not a body):
  `{style: tank|tee|shirt, sleeves: none|short|long, skin, pants, shoes, apron?, patch?, print?}`. Arms become sleeve +
  bare forearm (skin/fur) + a hand with a thumb nub; legs become trousers + shoes; the torso front gets a drawn decal
  (tank: scoop neck + arm holes showing fur, pec line; tee: collar; shirt: buttons; apron bib; sewn patch), plus hem and
  side shading. `color` is the shirt colour. Example: Bự `{style: tank, sleeves: none, skin: '#e5963a'}`.
- `set.armsZ: [l, r]` sideways arm raise (+r right, +l left; 160 = hand up calling the waiter).
- anims `talk {dur, freq 6, amp 5, bob}` — the speaker's head bobs/tilts while the line plays (the reference's tell
  for who is speaking); `wave {dur, base 70, amp 18, freq 4}` — flustered "no-no" hands.

## Staging rules (learned the hard way)

1. Camera always looks level: `look.y == pos.y` (the photo rides on the camera; tilting detaches characters).
2. Static meme wide shot: size it by width, not height. R6 blocks are ~4 units wide, so a frame must be ≈3.5 m wide at
   the characters' plane: with fov 50 on 3:4 the width is `0.7·d` → `d ≈ 5 m`. Put the counter's top edge at ~83 % of
   frame height: `camera.y = tableTop + 0.33 · 0.932 · d_table` (fov 50). Example: characters z≈1, table z≈1.95,
   camera `[0, 2.05, 6.0]`.
3. A sideways pointing arm reads as a floating plank — skip it; let the speaker's `talk` bob carry the beat.
4. Reaction beat = swap the victim's face to `emoji` (+ `facepop` 1.25→1 in 0.08 s), pop a reaction character in
   behind (`pop` 1.2→1, 0.08 s, linear: the meme-editor overshoot), then the explosion `pop {from .5, to 1.35, ease out}`
   over the victim, then `overlay: 1` hard cut to black.
5. Check stills at every key beat and the frame edges (a head half out of frame reads as a stray block).

## Known weaknesses

- The table is a plain steel slab; a photo table texture would sell it more.
- Waiter's `bandana` hair box hides the top of a drawn face — keep its face `z ≈ 0.12`, `y ≈ -0.14`.
- SwiftShader only; 1080×1440 is ~1.5 s/frame. Render a 810×1080 review cut first (edit `size`).
