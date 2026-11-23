// reel25d: a 2.5D cut-out meme reel in three.js. One photo as a far background plane, PNG cut-outs as
// upright billboards and blocky "Roblox-style" characters built from rounded boxes, all placed in metres on
// a floor at y = 0. The camera cuts between named shots (optionally drifting for parallax); every frame is a
// pure function of the frame number: window.init(director) then window.renderFrame(f).
//
// Director format: see ../director/*.json and README.md next to this file.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

const $ = id => document.getElementById(id);
const deg = d => d * Math.PI / 180;
const lerp = (a, b, u) => a + (b - a) * u;
const lerp3 = (a, b, u) => [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)];
const clamp01 = x => Math.min(1, Math.max(0, x));
const EASE = {
  linear: u => u,
  inout: u => u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2,
  out: u => 1 - Math.pow(1 - u, 3),
  in: u => u * u * u,
  back: u => { const c = 1.7, d = c + 1; return 1 + d * Math.pow(u - 1, 3) + c * Math.pow(u - 1, 2); },  // overshoot
};

let renderer, scene, camera, D, W, H, FPS, BASE, bgPlane;
const actors = {};        // name -> { spec, kind, obj, parts, w, h }
const textures = {};      // url -> Texture
let beats = [];           // resolved by shoot.mjs: [{t, shot, caption, set, anim, overlay, ...}]
let shadowTex;

// ---------- loading ----------
const loader = new THREE.TextureLoader();
async function tex(file) {
  const url = BASE + file;
  if (!textures[url]) {
    const t = await loader.loadAsync(url);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    textures[url] = t;
  }
  return textures[url];
}

function shadowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'), r = g.createRadialGradient(64, 64, 10, 64, 64, 64);
  r.addColorStop(0, 'rgba(0,0,0,.55)'); r.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}
function contactShadow(width) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(width, width * .45),
    new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.y = .01; m.renderOrder = -1;
  return m;
}

// ---------- actors ----------
// sprite: a PNG cut-out standing on the floor (bottom-centre pivot), always turned to face the camera
async function makeSprite(spec) {
  const t = await tex(spec.file);
  const h = spec.height ?? 1, w = h * t.image.width / t.image.height;
  const mat = new THREE.MeshBasicMaterial({ map: t, transparent: true, alphaTest: .06, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  mesh.position.y = h / 2;
  const pivot = new THREE.Group(); pivot.add(mesh);  // roll/scale happen here, about the sprite centre
  pivot.position.y = 0;
  const obj = new THREE.Group(); obj.add(pivot);
  if (spec.shadow !== false && !spec.attachOnly) obj.add(contactShadow(w * .9));
  return { kind: 'sprite', obj, parts: { pivot, mesh, mat }, w, h };
}

// the front of a blocky torso, drawn on a canvas (transparent where the shirt colour of the block shows through)
function torsoFront(O, spec, bk) {
  const W = Math.round(256 * bk), H = 256, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'), skin = O.skin ?? spec.headColor ?? '#f0d2b4', shirt = spec.color ?? '#f2f2f2';
  const shade = (hex, k) => { const n = parseInt(hex.slice(1), 16), f = v => Math.max(0, Math.min(255, Math.round(v * k))); return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`; };
  g.lineCap = g.lineJoin = 'round';
  const style = O.style ?? 'tee';
  if (style === 'tank') {   // scoop neck + deep arm holes show the fur/skin; two straps; pec line
    g.fillStyle = skin;
    g.beginPath(); g.moveTo(W * .3, 0); g.quadraticCurveTo(W * .5, H * .34, W * .7, 0); g.closePath(); g.fill();
    for (const sd of [0, 1]) { const x0 = sd ? W : 0, x1 = sd ? W * .8 : W * .2; g.beginPath(); g.moveTo(x0, 0); g.lineTo(x1 + (sd ? -W * .02 : W * .02), 0); g.quadraticCurveTo(x1 + (sd ? W * .06 : -W * .06), H * .3, x0, H * .46); g.closePath(); g.fill(); }
    g.strokeStyle = shade(shirt, .78); g.lineWidth = 5;
    g.beginPath(); g.moveTo(W * .3, H * .44); g.quadraticCurveTo(W * .4, H * .52, W * .5, H * .44); g.quadraticCurveTo(W * .6, H * .52, W * .7, H * .44); g.stroke();
    g.beginPath(); g.moveTo(W * .5, H * .58); g.lineTo(W * .5, H * .8); g.stroke();
  } else {                  // tee / shirt: round collar, sleeve seams, hem
    g.fillStyle = skin; g.beginPath(); g.ellipse(W * .5, 0, W * .17, H * .13, 0, 0, Math.PI); g.fill();
    g.strokeStyle = shade(shirt, .72); g.lineWidth = 7; g.beginPath(); g.ellipse(W * .5, 0, W * .19, H * .15, 0, 0, Math.PI); g.stroke();
    if (style === 'shirt') { g.fillStyle = shade(shirt, .8); for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(W * .5, H * (.3 + i * .17), 6, 0, 7); g.fill(); } g.lineWidth = 3; g.beginPath(); g.moveTo(W * .5, H * .16); g.lineTo(W * .5, H); g.stroke(); }
  }
  if (O.apron) {            // bib apron with neck straps and a pocket
    g.fillStyle = O.apron; g.fillRect(W * .2, H * .3, W * .6, H * .7);
    g.strokeStyle = O.apron; g.lineWidth = 12; g.beginPath(); g.moveTo(W * .24, H * .32); g.lineTo(W * .36, 0); g.moveTo(W * .76, H * .32); g.lineTo(W * .64, 0); g.stroke();
    g.strokeStyle = shade(O.apron, 1.8); g.lineWidth = 4; g.strokeRect(W * .36, H * .62, W * .28, H * .2);
  }
  if (O.patch) {            // a sewn-on patch (dashed stitches)
    g.save(); g.translate(W * .28, H * .32); g.rotate(-.12); g.fillStyle = O.patch; g.fillRect(-W * .09, -H * .08, W * .18, H * .16);
    g.setLineDash([7, 6]); g.strokeStyle = '#3a2a1a'; g.lineWidth = 3; g.strokeRect(-W * .08, -H * .07, W * .16, H * .14); g.restore();
  }
  if (O.print) { g.fillStyle = O.printColor ?? shade(shirt, .5); g.font = `bold ${Math.round(H * .13)}px Arial`; g.textAlign = 'center'; g.fillText(O.print, W * .5, H * .62); }
  // hem: a darker band at the bottom (shirt over the trousers) + soft side shading for volume
  g.fillStyle = 'rgba(0,0,0,.10)'; g.fillRect(0, H * .9, W, H * .1);
  const gr = g.createLinearGradient(0, 0, W, 0); gr.addColorStop(0, 'rgba(0,0,0,.10)'); gr.addColorStop(.18, 'rgba(0,0,0,0)'); gr.addColorStop(.82, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.10)');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

// blocky: R6-style figure, 5 units tall (legs 2, torso 2, head 1); unit = height / 5. Faces +z at yaw 0.
async function makeBlocky(spec) {
  const u = (spec.height ?? 1.75) / 5;
  const col = c => new THREE.Color(c);
  const mat = (c, r = .5) => new THREE.MeshStandardMaterial({ color: col(c), roughness: r, metalness: .05 });
  const body = mat(spec.color ?? '#f2c21b', .45), limb = mat(spec.limbColor ?? spec.color ?? '#f2c21b', .5);
  const headMat = spec.headColor ? mat(spec.headColor, .5) : body;
  const bk = spec.bulk ?? 1;   // >1 = broader torso and thicker arms (a buff character)
  const box = (w, h, d, m, r = .09) => new THREE.Mesh(new RoundedBoxGeometry(w * u, h * u, d * u, 3, r * u), m);
  const obj = new THREE.Group();
  const parts = {};
  // legs hang from hip pivots at y = 2u
  // outfit (optional): clothes instead of one plain colour per block — sleeves + skin/fur forearms + hands, trousers +
  // shoes, and a drawn front on the torso (tank top / tee / shirt + apron). See README "outfit".
  const O = spec.outfit;
  const skinM = O ? mat(O.skin ?? spec.headColor ?? '#f0d2b4', .6) : limb;
  const pantsM = O ? mat(O.pants ?? '#3a4660', .8) : limb, shoeM = O ? mat(O.shoes ?? '#2a2a2e', .5) : limb;
  for (const [name, x] of [['legL', -.5], ['legR', .5]]) {
    const p = new THREE.Group(); p.position.set(x * u, 2 * u, 0);
    if (O) {
      const sh = .42, pl = 2 - sh;                                          // trouser leg, then a shoe slightly longer to the front
      const m = box(.96, pl, .96, pantsM, .06); m.position.y = -pl / 2 * u; p.add(m);
      const sm = box(1.0, sh, 1.18, shoeM, .12); sm.position.set(0, -(2 - sh / 2) * u, .1 * u); p.add(sm);
    } else { const m = box(.96, 2, .96, limb); m.position.y = -1 * u; p.add(m); }
    obj.add(p); parts[name] = p;
  }
  const upper = new THREE.Group(); upper.position.y = 2 * u; obj.add(upper); parts.upper = upper;
  const torso = box(2 * bk, 2, 1 * Math.sqrt(bk), body); torso.position.y = 1 * u; upper.add(torso); parts.torso = torso;
  for (const [name, x] of [['armL', -1], ['armR', 1]]) {
    const p = new THREE.Group(); p.position.set(x * (bk + .48 * bk) * u, 2 * u, 0);
    if (O) {
      const sl = { none: 0, short: .7, long: 1.55 }[O.sleeves ?? 'short'] ?? .7, hand = .5, aw = .92 * bk;
      if (sl > 0) { const sm = box(aw * 1.06, sl, aw * 1.06, body, .07); sm.position.y = -sl / 2 * u; p.add(sm); }
      const fl = 2 - sl - hand + .02;                                        // bare forearm (fur / skin), then the hand
      if (fl > .02) { const fm = box(aw * .94, fl, aw * .94, skinM, .07); fm.position.y = -(sl + fl / 2) * u; p.add(fm); }
      const hm = box(aw * 1.0, hand, aw * 1.0, skinM, .22); hm.position.y = -(2 - hand / 2) * u; p.add(hm);
      // a thumb nub on the inner-front edge so the end reads as a hand, not a block
      const th = box(.28 * bk, .3, .3 * bk, skinM, .1); th.position.set(-x * aw * .42 * u, -(2 - hand * .62) * u, aw * .42 * u); p.add(th);
    } else { const m = box(.96 * bk, 2, .96 * bk, limb); m.position.y = -1 * u; p.add(m); }
    upper.add(p); parts[name] = p;
  }
  if (O) {   // drawn shirt front: a decal just in front of the torso
    const tw = 2 * bk, td = Math.sqrt(bk);
    const dec = new THREE.Mesh(new THREE.PlaneGeometry(tw * u * .985, 2 * u * .985), new THREE.MeshStandardMaterial({ map: torsoFront(O, spec, bk), transparent: true, roughness: .7, metalness: 0 }));
    dec.position.set(0, 1 * u, td * .5 * u + .004); upper.add(dec);
  }
  const hs = spec.headScale ?? 1;   // >1 = meme big-head (a photo face as wide as the torso)
  const headG = new THREE.Group(); headG.position.y = 2 * u + .525 * hs * u + .05 * u; headG.scale.setScalar(hs); headG.userData.y0 = headG.position.y; upper.add(headG); parts.head = headG;
  const head = box(1.2, 1.05, 1.1, headMat, .22); headG.add(head);
  // face: a texture on the front of the head, switchable. spec.faces = {key: file | {file, size:[w,h], y}}
  // (size in head units; default fills the part of the head below a hat brim)
  if (spec.faces) {
    const fm = new THREE.MeshBasicMaterial({ transparent: true, alphaTest: .05 });
    const face = new THREE.Mesh(new THREE.PlaneGeometry(u, u), fm);
    face.position.set(0, 0, .56 * u); headG.add(face);
    parts.face = face; parts.faceMaps = {}; parts.faceGeo = {};
    for (const [k, f] of Object.entries(spec.faces)) {
      const o = typeof f === 'string' ? { file: f } : f;
      parts.faceMaps[k] = await tex(o.file);
      parts.faceGeo[k] = { size: o.size ?? spec.faceSize ?? [1.1, .62], y: o.y ?? spec.faceY ?? -.18, z: o.z ?? 0 };
    }
    fm.map = parts.faceMaps[spec.face ?? Object.keys(spec.faces)[0]]; fm.needsUpdate = true;
  }
  if (spec.hat === 'bucket') {  // crown + sloping brim, charcoal
    const hm = mat('#2a2a2e', .7);
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(.62 * u, .68 * u, .55 * u, 28), hm); crown.position.y = .72 * u;
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(.70 * u, 1.05 * u, .22 * u, 28), hm); brim.position.y = .40 * u;
    headG.add(crown, brim);
  } else if (spec.hat === 'beanie') {
    const hm = mat(spec.hatColor ?? '#1b1b1f', .8);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(.72 * u, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2), hm); dome.position.y = .35 * u;
    const band = new THREE.Mesh(new THREE.CylinderGeometry(.74 * u, .74 * u, .28 * u, 28), hm); band.position.y = .32 * u;
    headG.add(dome, band);
  } else if (spec.hat === 'bandana') {  // red cap over a block of black hair
    const hair = box(1.3, .9, 1.25, mat('#111114', .9), .12); hair.position.y = .22 * u; headG.add(hair);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(.74 * u, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2.2), mat(spec.hatColor ?? '#d62828', .6));
    cap.position.y = .32 * u; headG.add(cap);
    const knot = box(.5, .25, .35, mat(spec.hatColor ?? '#d62828', .6), .08); knot.position.set(.55 * u, .55 * u, -.55 * u); headG.add(knot);
  }
  obj.add(contactShadow(2.6 * u));
  return { kind: 'blocky', obj, parts, w: 4 * u, h: 5 * u, u };
}

// pack: a soft rounded block with straps — parachute bag or school backpack. Pivot at the bottom.
async function makePack(spec) {
  const w = spec.width ?? .55, h = spec.height ?? .7, d = spec.depth ?? .4;
  const g = new THREE.Group();
  const main = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 4, Math.min(w, h, d) * .28),
    new THREE.MeshStandardMaterial({ color: new THREE.Color(spec.color ?? '#5b6b3a'), roughness: .85 }));
  main.position.y = h / 2; g.add(main);
  const pocket = new THREE.Mesh(new RoundedBoxGeometry(w * .62, h * .42, d * .35, 3, d * .1),
    new THREE.MeshStandardMaterial({ color: new THREE.Color(spec.color ?? '#5b6b3a').multiplyScalar(.8), roughness: .85 }));
  pocket.position.set(0, h * .38, d / 2 + d * .1); g.add(pocket);
  const sm = new THREE.MeshStandardMaterial({ color: new THREE.Color(spec.strapColor ?? '#e3c23a'), roughness: .7 });
  for (const x of [-w * .28, w * .28]) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(w * .12, h * .92, d * 1.08), sm); s.position.set(x, h / 2, 0); g.add(s);
  }
  const obj = new THREE.Group(); obj.add(g);
  if (spec.shadow !== false) obj.add(contactShadow(w * 1.6));
  return { kind: 'pack', obj, parts: { g }, w, h };
}

// prop: a plain solid — a steel table top, a cup. shape box {size:[w,h,d]} | cylinder {radius, radiusBottom?, height}. Pivot at the bottom.
async function makeProp(spec) {
  const m = new THREE.MeshStandardMaterial({ color: new THREE.Color(spec.color ?? '#c9ced3'), roughness: spec.roughness ?? .35, metalness: spec.metalness ?? .6 });
  let mesh, w, h;
  if (spec.shape === 'cylinder') {
    const r = spec.radius ?? .05; h = spec.height ?? .12; w = 2 * r;
    mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, spec.radiusBottom ?? r * .85, h, 32), m);
  } else {
    const [sw, sh, sd] = spec.size ?? [1, .05, .6]; w = sw; h = sh;
    mesh = new THREE.Mesh(new RoundedBoxGeometry(sw, sh, sd, 3, Math.min(sw, sh, sd) * .2), m);
  }
  mesh.position.y = h / 2;
  const obj = new THREE.Group(); obj.add(mesh);
  if (spec.legs) for (const [x, z] of spec.legs) { const l = new THREE.Mesh(new THREE.CylinderGeometry(.025, .025, spec.legHeight ?? .75, 12), m); l.position.set(x, -(spec.legHeight ?? .75) / 2, z); obj.add(l); }
  return { kind: 'prop', obj, parts: { mesh }, w, h };
}

const BUILD = { sprite: makeSprite, blocky: makeBlocky, pack: makePack, prop: makeProp };

// ---------- scene ----------
async function buildScene() {
  scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xcfe3ff, 0x8a8678, D.light?.hemi ?? 1.1));
  const sun = new THREE.DirectionalLight(0xffffff, D.light?.sun ?? 1.7);
  sun.position.set(...(D.light?.sunPos ?? [4, 9, 7])); scene.add(sun);
  const fill = new THREE.DirectionalLight(0xffffff, D.light?.fill ?? .5); fill.position.set(-5, 3, 6); scene.add(fill);

  // background: a 2D layer riding on the camera, always covering the frame; each shot crops it with
  // bg.zoom / bg.pan, and a drifting camera slides it a little (parallax) — the cut-out collage look
  const bt = await tex(D.background.file);
  bgPlane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: bt, depthWrite: false }));
  bgPlane.renderOrder = -10;
  bgPlane.userData.aspect = bt.image.width / bt.image.height;
  camera.add(bgPlane);
  scene.add(camera);

  shadowTex = shadowTexture();
  for (const [name, spec] of Object.entries(D.actors)) {
    const a = await BUILD[spec.type](spec);
    a.spec = spec; a.name = name; a.obj.visible = false;
    scene.add(a.obj); actors[name] = a;
  }
}

// ---------- state per frame ----------
function defaultState(name) {
  const s = actors[name].spec;
  return { at: s.at ? [...s.at] : [0, 0, 0], yaw: s.yaw ?? 0, roll: 0, pitch: 0, scale: 1, visible: !!s.at,
           attach: null, face: s.face ?? null, faceScale: 1, lean: 0, arms: [0, 0], armsZ: [0, 0], legs: [0, 0], opacity: 1, flip: false, headRoll: 0, headBob: 0 };
}

function stateAt(time) {
  const st = {}; for (const n in actors) st[n] = defaultState(n);
  let shot = null, shotStart = 0, caption = null, overlay = 0, watermark = D.watermark ?? null;
  for (const b of beats) {
    if (b.t > time) break;
    if (b.shot) { shot = b.shot; shotStart = b.t; }
    if ('caption' in b) caption = b.caption;
    if ('overlay' in b) overlay = b.overlay;
    if ('watermark' in b) watermark = b.watermark;
    for (const [n, props] of Object.entries(b.set ?? {})) {
      const s = st[n]; if (!s) throw new Error(`set: unknown actor ${n}`);
      if ('at' in props) { s.at = [...props.at]; s.visible = true; }
      if ('visible' in props) s.visible = props.visible;
      for (const k of ['yaw', 'roll', 'pitch', 'scale', 'face', 'faceScale', 'lean', 'opacity', 'flip']) if (k in props) s[k] = props[k];
      if ('arms' in props) s.arms = Array.isArray(props.arms) ? props.arms : [props.arms, props.arms];
      if ('armsZ' in props) s.armsZ = Array.isArray(props.armsZ) ? props.armsZ : [props.armsZ, props.armsZ];   // sideways: +R points right, +L points left
      if ('attach' in props) s.attach = props.attach;   // {to, offset:[x,y,z], yaw?} or null
    }
    for (const an of b.anim ?? []) applyAnim(st, an, time - (b.t + (an.delay ?? 0)));
  }
  return { st, shot, shotStart, caption, overlay, watermark };
}

function applyAnim(st, an, local) {
  if (local < 0) return;
  const dur = an.dur ?? 1, u = clamp01(local / dur), e = EASE[an.ease ?? 'inout'](u);
  const s = st[an.actor]; if (!s) throw new Error(`anim: unknown actor ${an.actor}`);
  switch (an.type) {
    case 'move': {
      s.visible = true;
      s.at = lerp3(s.at, an.to, e);
      if (an.walk && u < 1) { const w = Math.sin(local * 2 * Math.PI * (an.stride ?? 2.2)); s.legs = [w * 28, -w * 28]; s.arms = [-w * 22, w * 22]; }
      break;
    }
    case 'turn': s.yaw = lerp(s.yaw, an.to, e); break;
    case 'jump': {  // ballistic flight from the current spot; v in m/s, spins while flying, hidden at the end
      const t = Math.min(local, dur), v = an.v ?? [0, 3, -5], g = an.g ?? 9.8;
      s.at = [s.at[0] + v[0] * t, s.at[1] + v[1] * t - .5 * g * t * t, s.at[2] + v[2] * t];
      if (an.spin) s[an.axis === 'x' ? 'pitch' : 'roll'] += an.spin * t;
      if (an.lean) s.lean = an.lean * Math.min(1, t / .25);
      if (u >= 1 && an.hide !== false) s.visible = false;
      break;
    }
    case 'pop': { s.visible = true; s.scale = lerp(an.from ?? 2.5, an.to ?? 1, EASE[an.ease ?? 'back'](u)); break; }
    case 'facepop': s.faceScale = lerp(an.from ?? 2.5, an.to ?? 1, EASE[an.ease ?? 'back'](u)); break;
    case 'scale': s.scale = lerp(s.scale, an.to ?? 1, e); break;
    case 'bend': s.lean = an.back ? an.to * Math.sin(Math.PI * u) : lerp(s.lean, an.to, e); break;
    case 'arms': { const v = an.back ? an.to * Math.sin(Math.PI * u) : lerp(s.arms[0], an.to, e); s.arms = [an.left === false ? s.arms[0] : v, an.right === false ? s.arms[1] : v]; break; }
    case 'shake': { const k = an.amp ?? .04, f = an.freq ?? 9; s.at = [s.at[0] + k * Math.sin(local * 2 * Math.PI * f) * (1 - u), s.at[1], s.at[2]]; break; }
    case 'nod': s.pitch = (an.amp ?? 12) * Math.sin(Math.PI * u); break;
    case 'talk': if (u < 1) { const ph = Math.sin(local * 2 * Math.PI * (an.freq ?? 6)); s.headRoll = (an.amp ?? 5) * ph; s.headBob = Math.abs(ph) * (an.bob ?? .03); } break;   // speaker's head bobs while the line plays
    case 'wave': if (u < 1) { const w = (an.amp ?? 18) * Math.sin(local * 2 * Math.PI * (an.freq ?? 4)), b = an.base ?? 70; s.arms = [b + w, b - w]; } break;   // flustered 'no no' hands
    case 'fade': s.opacity = lerp(an.from ?? 1, an.to ?? 0, e); if (u >= 1 && an.to === 0) s.visible = false; break;
    case 'hide': if (u >= 1) s.visible = false; break;
    case 'show': s.visible = true; break;
    default: throw new Error(`anim: unknown type ${an.type}`);
  }
}

// ---------- apply state to the scene graph ----------
const _v = new THREE.Vector3();
function placeActor(name, s, st, cam) {
  const a = actors[name], o = a.obj;
  o.visible = s.visible;
  if (!s.visible) return;
  let yaw = s.yaw;
  if (s.attach) {  // ride on another actor: world position of an offset in the parent's frame
    const p = actors[s.attach.to], ps = st[s.attach.to];
    o.visible = ps.visible; if (!o.visible) return;
    _v.set(...(s.attach.offset ?? [0, 0, 0]));
    p.obj.updateMatrixWorld(true);
    (s.attach.part && p.parts[s.attach.part] ? p.parts[s.attach.part] : p.obj).localToWorld(_v);
    o.position.copy(_v);
    yaw = ps.yaw + (s.attach.yaw ?? 0);
    o.rotation.set(deg(ps.pitch), deg(yaw), deg(ps.roll), 'YXZ');
  } else {
    o.position.set(...s.at);
    if (a.kind === 'sprite') yaw = Math.atan2(cam.position.x - s.at[0], cam.position.z - s.at[2]) * 180 / Math.PI;  // billboard
    o.rotation.set(deg(s.pitch), deg(yaw), deg(s.roll), 'YXZ');
  }
  o.scale.setScalar(s.scale * (s.flip ? 1 : 1));
  if (a.kind === 'sprite') {
    a.parts.mesh.scale.x = s.flip ? -1 : 1;
    a.parts.mat.opacity = s.opacity; a.parts.mat.transparent = true;
  }
  if (a.kind === 'blocky') {
    const P = a.parts;
    P.upper.rotation.x = deg(s.lean);
    P.armL.rotation.set(deg(-s.arms[0]), 0, deg(-s.armsZ[0]), 'ZXY'); P.armR.rotation.set(deg(-s.arms[1]), 0, deg(s.armsZ[1]), 'ZXY');
    P.head.rotation.z = deg(s.headRoll); P.head.position.y = P.head.userData.y0 + s.headBob;
    P.legL.rotation.x = deg(s.legs[0]); P.legR.rotation.x = deg(s.legs[1]);
    if (P.face && s.face && P.faceMaps[s.face]) {
      if (P.face.material.map !== P.faceMaps[s.face]) { P.face.material.map = P.faceMaps[s.face]; P.face.material.needsUpdate = true; }
      const g = P.faceGeo[s.face], k = s.faceScale;
      P.face.scale.set(g.size[0] * k, g.size[1] * k, 1);
      P.face.position.set(0, g.y * a.u * k, (.56 + g.z) * a.u + (k - 1) * .3 * a.u);  // a popped face floats in front of the head
    }
  }
  // the ground shadow only when standing on the floor
  const sh = o.children.find(c => c.material && c.material.map === shadowTex);
  if (sh) sh.visible = Math.abs(s.at[1]) < .05 && !s.attach;
}

function placeCamera(shotName, elapsed) {
  const sh = D.shots[shotName]; if (!sh) throw new Error(`unknown shot ${shotName}`);
  const drift = sh.drift ?? [0, 0, 0];
  const pos = [sh.pos[0] + drift[0] * elapsed, sh.pos[1] + drift[1] * elapsed, sh.pos[2] + drift[2] * elapsed];
  const look = sh.look ?? [0, 1, 0];
  camera.position.set(...pos);
  camera.lookAt(look[0] + (sh.lookDrift ? sh.lookDrift[0] * elapsed : 0), look[1] + (sh.lookDrift ? sh.lookDrift[1] * elapsed : 0), look[2] + (sh.lookDrift ? sh.lookDrift[2] * elapsed : 0));
  if (sh.roll) camera.rotateZ(deg(sh.roll));
  camera.fov = (sh.fov ?? D.camera?.fov ?? 45) + (sh.zoom ?? 0) * elapsed;
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
  fitBackground(sh, drift, elapsed);
}

// cover-fit the photo to the frame at a fixed distance in front of the camera, then crop per shot.
// bg.zoom > 1 enlarges, bg.pan = [right, up] in fractions of the frame. Camera drift pans/zooms it a
// little (D.background.parallax per metre) so near things move more than the photo.
function fitBackground(sh, drift, elapsed) {
  const dist = 60, bg = sh.bg ?? {}, px = D.background.parallax ?? .12;
  const fh = 2 * dist * Math.tan(deg(camera.fov) / 2), fw = fh * camera.aspect;
  const ia = bgPlane.userData.aspect;
  let w = fw, h = fw / ia; if (h < fh) { h = fh; w = fh * ia; }
  const zoom = (bg.zoom ?? 1) * (1 - drift[2] * elapsed * px);   // dolly in (drift z < 0) zooms the photo a bit
  bgPlane.scale.set(w * zoom, h * zoom, 1);
  const pan = bg.pan ?? [0, 0];
  bgPlane.position.set((pan[0] - drift[0] * elapsed * px) * fw, (pan[1] - drift[1] * elapsed * px) * fh, -dist);
}

function renderAt(time) {
  const { st, shot, shotStart, caption, overlay, watermark } = stateAt(time);
  placeCamera(shot ?? Object.keys(D.shots)[0], time - shotStart);
  // parents first so attached actors read an up-to-date world matrix
  for (const n in actors) if (!st[n].attach) placeActor(n, st[n], st, camera);
  for (const n in actors) if (st[n].attach) placeActor(n, st[n], st, camera);
  const cap = $('caption');
  if (caption) { cap.textContent = caption; cap.style.display = 'block'; } else cap.style.display = 'none';
  const wm = $('watermark');
  if (watermark) { wm.textContent = watermark; wm.style.display = 'block'; } else wm.style.display = 'none';
  $('overlay').style.opacity = typeof overlay === 'number' ? overlay : (overlay?.opacity ?? 0);
  if (overlay && overlay.color) $('overlay').style.background = overlay.color;
  const t0 = performance.now();
  renderer.render(scene, camera);
  return { ms: performance.now() - t0, shot, caption };
}

// ---------- public API ----------
window.init = async function (director, base, resolvedBeats) {
  D = director; BASE = base; beats = resolvedBeats;
  [W, H] = D.size; FPS = D.fps;
  const stage = $('stage'); stage.style.width = W + 'px'; stage.style.height = H + 'px';
  $('caption').style.fontSize = Math.round((D.caption?.size ?? .059) * W) + 'px';
  if (D.caption?.top) $('caption').style.top = D.caption.top;
  if (D.caption?.font) $('caption').style.fontFamily = D.caption.font;
  renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(W, H); renderer.setPixelRatio(1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;  // photos and cut-outs keep their exact colours
  stage.insertBefore(renderer.domElement, stage.firstChild);
  camera = new THREE.PerspectiveCamera(D.camera?.fov ?? 45, W / H, .05, 300);
  await buildScene();
  return { actors: Object.fromEntries(Object.entries(actors).map(([n, a]) => [n, { kind: a.kind, w: +a.w.toFixed(2), h: +a.h.toFixed(2) }])) };
};
window.renderFrame = f => renderAt((f - 1) / FPS);
window.renderTime = t => renderAt(t);
window.gpu = () => { const gl = renderer.getContext(), i = gl.getExtension('WEBGL_debug_renderer_info'); return i ? gl.getParameter(i.UNMASKED_RENDERER_WEBGL) : 'n/a'; };
window.ready = true;
