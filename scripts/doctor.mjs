// Environment check for AI Clone Viral Reel
// Run: npm run doctor OR node scripts/doctor.mjs
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statfsSync } from 'node:fs';
import { homedir, platform } from 'node:os';
import { join } from 'node:path';

const IS_WIN = platform() === 'win32';
const ok = (m) => console.log(`  \x1b[32m✓\x1b[0m ${m}`);
const bad = (m, fix) => { console.log(`  \x1b[31m✗\x1b[0m ${m}${fix ? `\n      → ${fix}` : ''}`); failed++; };
const opt = (m, fix) => console.log(`  \x1b[33m○\x1b[0m ${m}${fix ? `  (${fix})` : ''}`);
let failed = 0;

const run = (cmd, args, shell = IS_WIN && !/python|ffmpeg|ffprobe|blender/i.test(cmd)) => {
  try { return execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], shell, timeout: 20000 }).trim(); }
  catch { return null; }
};

const PY = process.env.PYTHON || 'python';

console.log('\nAI Clone Viral Reel — Environment Check\n');
console.log('Core');
ok(`Node ${process.versions.node}`);

const pyv = run(PY, ['-c', 'import sys; assert sys.version_info >= (3, 10); print("Python", sys.version.split()[0])']);
pyv ? ok(pyv) : bad('Python 3.10+ not found', 'install Python 3.10 or newer, or set PYTHON=/path/to/python');

const ff = run('ffmpeg', ['-version']);
const ffDir = process.env.FFMPEG_DIR && existsSync(join(process.env.FFMPEG_DIR, IS_WIN ? 'ffmpeg.exe' : 'ffmpeg'));
ff || ffDir ? ok(`FFmpeg ${(ff || '').split('\n')[0].split(' ')[2] || `(FFMPEG_DIR)`}`) : bad('FFmpeg not found', 'install FFmpeg and put it on PATH, or set FFMPEG_DIR');

const fp = run('ffprobe', ['-version']);
const fpDir = process.env.FFMPEG_DIR && existsSync(join(process.env.FFMPEG_DIR, IS_WIN ? 'ffprobe.exe' : 'ffprobe'));
fp || fpDir ? ok(`ffprobe ${(fp || '').split('\n')[0].split(' ')[2] || `(FFMPEG_DIR)`}`) : bad('ffprobe not found', 'it ships with FFmpeg: put it on PATH, or set FFMPEG_DIR');

const chromes = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].filter(Boolean);
const chrome = chromes.find((p) => existsSync(p));
chrome ? ok(`Chrome ${chrome}`) : bad('Chrome/Chromium not found (needed for headless rendering)', 'install Chrome, or set CHROME_PATH');

console.log('\nPython packages');
const mods = [['numpy', 'numpy'], ['cv2', 'opencv-python'], ['scenedetect', 'scenedetect'], ['librosa', 'librosa'], ['PIL', 'Pillow'], ['yt_dlp', 'yt-dlp']];
const optMods = [['faster_whisper', 'faster-whisper', 'lyrics auto-timing'], ['opencc', 'opencc-python-reimplemented', 'lyrics conversion']];
if (pyv) {
  const probe = (m) => run(PY, ['-c', `import ${m}`]) !== null;
  for (const [m, pkg] of mods) probe(m) ? ok(pkg) : bad(pkg, `${PY} -m pip install -r requirements.txt`);
  for (const [m, pkg, why] of optMods) probe(m) ? ok(pkg) : opt(`${pkg} not installed`, why);
}

try {
  const f = statfsSync(join(import.meta.dirname, '..')), gb = (f.bavail * f.bsize) / 2 ** 30;
  gb >= 5 ? ok(`Disk: ${gb.toFixed(0)} GB free`) : bad(`Disk: only ${gb.toFixed(1)} GB free`, 'free at least 5 GB for video rendering');
} catch {}

console.log(failed ? `\n${failed} required item(s) missing.\n` : '\nAll required items present. You are ready to clone videos!\n');
process.exit(failed ? 1 : 0);
