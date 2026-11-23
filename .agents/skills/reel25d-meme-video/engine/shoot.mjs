// Capture a reel25d director as PNG frames with Chrome headless.
//
//   node shoot.mjs --director ../director/skydive_meme.json --out ../output/skydive_meme --frames 1,120,300
//   node shoot.mjs --director ../director/skydive_meme.json --out ../output/skydive_meme --times 0.5,4.6,10.2
//   node shoot.mjs --director ../director/skydive_meme.json --out ../output/skydive_meme          (full, then mux.py)
//
// Beat times in the director are the scripted minimum; when a beat has a voice line (voice.py →
// <out>/voice/voice.json) every later beat is pushed back so the line finishes (+ pad) before the next
// caption starts. The resolved schedule is written to <out>/timeline.json for mux.py.
import { chromium } from 'playwright-core';
import { mkdirSync, readFileSync, writeFileSync, readdirSync, unlinkSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const args = Object.fromEntries(process.argv.slice(2).map((a, i, all) => a.startsWith('--') ? [a.slice(2), all[i + 1] ?? true] : null).filter(Boolean));
if (!args.director) { console.error('usage: node shoot.mjs --director <json> --out <dir> [--frames a,b | --times s,s]'); process.exit(2); }

const directorPath = path.resolve(args.director);   // relative to the shell's cwd
const D = JSON.parse(readFileSync(directorPath, 'utf8'));
const out = path.resolve(args.out ?? path.join(root, 'output', path.basename(directorPath, '.json')));
// director.input is relative to the repo root (reel25d/..); cwd and the director's folder are tried too
const inputDir = [root, process.cwd(), path.dirname(directorPath)].map(b => path.resolve(b, D.input)).find(existsSync);
if (!inputDir) { console.error(`input folder ${D.input} not found`); process.exit(1); }
const fps = D.fps ?? 30;
mkdirSync(out, { recursive: true });

// ---- resolve beat times against the voice lines ----
const voicePath = path.join(out, 'voice', 'voice.json');
const voice = existsSync(voicePath) ? JSON.parse(readFileSync(voicePath, 'utf8')) : { lines: {} };
const pad = D.voicePad ?? .35;
let shift = 0;
const beats = D.beats.map((b, i) => ({ ...b, i, t0: b.t }));
for (let i = 0; i < beats.length; i++) {
  const b = beats[i];
  b.t = +(b.t0 + shift).toFixed(3);
  if (b.caption && b.voice) {
    const line = voice.lines[String(i)];
    if (!line) { console.error(`beat ${i} ("${b.caption}") has voice but no line in ${voicePath}: run voice.py first`); process.exit(1); }
    b.voiceFile = path.join('voice', line.file); b.voiceSeconds = line.seconds;
    // the next beat that changes the caption must not start before this line ends
    const next = beats.slice(i + 1).find(n => 'caption' in n);
    if (next) {
      const need = b.t + line.seconds + pad, have = next.t0 + shift;
      if (have < need) shift += need - have;
    }
  }
}
const lastBeat = beats[beats.length - 1];
const duration = lastBeat.t + (D.tail ?? .5);
const frames = Math.ceil(duration * fps);
const timeline = {
  fps, size: D.size, frames, duration,
  beats: beats.map(({ i, t, t0, shot, caption, voice, voiceFile, voiceSeconds, sfx }) => ({ i, t, t0, shot, caption, voice, voiceFile, voiceSeconds, sfx })),
};
writeFileSync(path.join(out, 'timeline.json'), JSON.stringify(timeline, null, 2));
console.log(`${beats.length} beats, ${frames} frames = ${duration.toFixed(2)} s (voice shift +${shift.toFixed(2)} s)`);

// ---- browser ----
const [W, H] = D.size;
const browser = await chromium.launch({ channel: 'chrome', headless: true,
  args: ['--allow-file-access-from-files',
         ...(args.gpu ? ['--ignore-gpu-blocklist', '--enable-gpu'] : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])] });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
page.on('pageerror', e => console.log('[pageerror]', e.message));
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log('[page]', m.text()); });
await page.goto('file://' + path.join(here, 'index.html').replace(/\\/g, '/'));
await page.waitForFunction(() => window.ready === true, null, { timeout: 60000 });
const base = 'file://' + inputDir.replace(/\\/g, '/') + '/';
const info = await page.evaluate(([d, b, bt]) => window.init(d, b, bt), [D, base, beats]);
console.log('WebGL:', await page.evaluate(() => window.gpu()));
console.log('actors:', JSON.stringify(info.actors));

const shoot = async (f, file) => {
  const r = await page.evaluate(f => window.renderFrame(f), f);
  await page.screenshot({ path: file });
  return r;
};

if (args.times) {  // --times 0.5,4.6 : one still per *scripted* second (mapped through the voice shift) → still_<t>.png
  for (const t0 of String(args.times).split(',').map(Number)) {
    const b = [...beats].reverse().find(b => b.t0 <= t0);
    const t = b ? b.t + (t0 - b.t0) : t0;
    const f = Math.max(1, Math.round(t * fps) + 1);
    const r = await shoot(f, path.join(out, `still_${t0}.png`));
    console.log(`still t0=${t0} → t=${t.toFixed(2)} (frame ${f}) shot=${r.shot} caption=${JSON.stringify(r.caption)}`);
  }
  await browser.close(); process.exit(0);
}

const framesDir = path.join(out, 'frames');
mkdirSync(framesDir, { recursive: true });
const only = args.frames ? String(args.frames).split(',').map(Number) : null;
if (!only) for (const f of readdirSync(framesDir)) if (/^frame_\d{4}\.png$/.test(f) && +f.slice(6, 10) > frames) unlinkSync(path.join(framesDir, f));
// --resume: keep the frames already on disk (a stopped run picks up where it left off; delete frames/ after editing the scene)
let todo = only ?? Array.from({ length: frames }, (_, i) => i + 1);
if (args.resume && !only) {
  const have = new Set(readdirSync(framesDir).filter(f => /^frame_\d{4}\.png$/.test(f)).map(f => +f.slice(6, 10)));
  todo = todo.filter(f => !have.has(f));
  console.log(`resume: ${frames - todo.length} frames already there, ${todo.length} to go`);
}
const started = Date.now();
let n = 0, renderMs = 0;
for (const f of todo) {
  const r = await shoot(f, path.join(framesDir, `frame_${String(f).padStart(4, '0')}.png`));
  n++; renderMs += r.ms;
  if (only || n % 60 === 0 || n === todo.length) {
    const el = (Date.now() - started) / 1000;
    console.log(`frame ${f}/${frames}  ${el.toFixed(0)}s elapsed, ${(el / n).toFixed(2)} s/frame (render ${(renderMs / n).toFixed(1)} ms)${only ? ` shot=${r.shot} caption=${JSON.stringify(r.caption)}` : ''}`);
  }
}
await browser.close();
console.log('wrote', framesDir);
