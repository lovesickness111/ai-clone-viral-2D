// Make Claude Code see the shared skills.
// Canonical location: .agents/skills/ (read natively by Codex CLI and Gemini CLI).
// Claude Code only reads .claude/skills/, so this creates .claude/skills → .agents/skills
// (a directory junction on Windows — no admin needed; a symlink elsewhere).
// Run: npm run link-skills        (use --copy to make a plain copy instead, e.g. if a tool ignores links)
import { cpSync, existsSync, lstatSync, mkdirSync, readlinkSync, rmSync, symlinkSync } from 'node:fs';
import { platform } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, '.agents', 'skills');
const DST = join(ROOT, '.claude', 'skills');
const copy = process.argv.includes('--copy');

if (!existsSync(SRC)) { console.error(`missing ${SRC}`); process.exit(1); }
mkdirSync(dirname(DST), { recursive: true });

if (existsSync(DST) || (() => { try { lstatSync(DST); return true; } catch { return false; } })()) {
  const st = lstatSync(DST);
  if (st.isSymbolicLink()) {
    if (!copy && resolve(dirname(DST), readlinkSync(DST)) === SRC) { console.log('✓ .claude/skills already links to .agents/skills'); process.exit(0); }
    rmSync(DST);
  } else if (copy) {
    rmSync(DST, { recursive: true, force: true });
  } else {
    console.error('✗ .claude/skills is a real folder. Move anything new in it into .agents/skills, delete it, then run again (or use --copy).');
    process.exit(1);
  }
}

if (copy) {
  cpSync(SRC, DST, { recursive: true });
  console.log('✓ copied .agents/skills → .claude/skills (re-run after editing skills)');
} else {
  symlinkSync(SRC, DST, platform() === 'win32' ? 'junction' : 'dir');
  console.log('✓ linked .claude/skills → .agents/skills');
}
