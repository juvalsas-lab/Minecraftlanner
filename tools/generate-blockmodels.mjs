#!/usr/bin/env node
/**
 * Erzeugt `blockmodels.js` – echte Blockmodelle (Geometrie + UVs + Flächen-Texturen)
 * direkt aus den Minecraft-Daten.
 *
 * Quelle ist das Repository `misode/mcmeta`, Zweig `assets` – also derselbe Zweig,
 * von dem der Viewer die Texturen lädt. Gelesen werden `blockstates` und
 * `models/block`; daraus werden pro Blockzustand die Elemente, Flächen, UVs und
 * (aufgelösten) Texturdateien abgeleitet.
 *
 * Nur "nicht-triviale" Modelle werden exportiert (nicht der reine 1×1×1-Würfel mit
 * einer Textur) – die deckt der Viewer weiterhin über `blocktextures.js` ab. Das hält
 * die Datei klein.
 *
 * Verwendung:
 *   node tools/generate-blockmodels.mjs --mcmeta <pfad> --out blockmodels.js
 * Ohne vorhandenen Checkout wird automatisch ein sparse-checkout angelegt
 * (benötigt git + Netzwerk).
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';

const REPO = 'https://github.com/misode/mcmeta.git';
const BRANCH = 'assets';
const SPARSE = [
  'assets/minecraft/blockstates',
  'assets/minecraft/models/block',
  'assets/minecraft/textures/block',
];

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

function ensureCheckout(root) {
  const blockstates = path.join(root, 'assets/minecraft/blockstates');
  if (fs.existsSync(blockstates)) return;
  console.error(`[i] Lege mcmeta sparse-checkout an: ${root}`);
  fs.mkdirSync(path.dirname(path.resolve(root)), { recursive: true });
  execFileSync('git', ['clone', '--depth', '1', '--filter=blob:none', '--sparse', '--branch', BRANCH, REPO, root], { stdio: 'inherit' });
  execFileSync('git', ['-C', root, 'sparse-checkout', 'set', ...SPARSE], { stdio: 'inherit' });
}

class Resolver {
  constructor(root) {
    this.modelDir = path.join(root, 'assets/minecraft/models/block');
    this.stateDir = path.join(root, 'assets/minecraft/blockstates');
    this.textureDir = path.join(root, 'assets/minecraft/textures/block');
    this.textures = new Set(
      fs.readdirSync(this.textureDir).filter((f) => f.endsWith('.png')).map((f) => f.slice(0, -4))
    );
    this._cache = new Map();
  }

  loadModel(name) {
    name = (name || '').replace('minecraft:', '');
    if (name.startsWith('block/')) name = name.slice(6);
    if (name.startsWith('builtin/')) return null;
    if (this._cache.has(name)) return this._cache.get(name);
    const file = path.join(this.modelDir, name + '.json');
    let data = null;
    if (fs.existsSync(file)) {
      try { data = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { data = null; }
    }
    this._cache.set(name, data);
    return data;
  }

  // Führt die Parent-Kette zusammen: Texturen (Kind gewinnt) + Elemente des
  // nächsten Modells in der Kette, das welche definiert.
  resolveModel(name) {
    const textures = {};
    let elements = null;
    const chainList = [];
    let cur = name;
    let depth = 0;
    while (cur && depth++ < 40) {
      const data = this.loadModel(cur);
      if (!data) break;
      chainList.push(data);
      if (elements === null && Array.isArray(data.elements)) elements = data.elements;
      cur = data.parent || null;
    }
    for (let i = chainList.length - 1; i >= 0; i--) Object.assign(textures, chainList[i].textures || {});
    return { textures, elements };
  }

  deref(value, textures, depth = 0) {
    if (depth > 25) return null;
    if (value && typeof value === 'object') value = value.sprite || value.texture || value.all;
    if (typeof value !== 'string') return null;
    if (value.startsWith('#')) {
      const nxt = textures[value.slice(1)];
      return nxt == null ? null : this.deref(nxt, textures, depth + 1);
    }
    return value;
  }

  textureFile(ref) {
    if (!ref) return null;
    const clean = ref.replace('minecraft:', '');
    const parts = clean.split('/');
    const base = parts[parts.length - 1];
    return base || null;
  }
}

// --- UV-/Flächenberechnung (Minecraft-Konventionen) ---

// Normierte Flächenkoordinaten (fu, fv) eines Punktes für eine Flächenrichtung.
function faceUVCoords(dir, x1, y1, z1, x2, y2, z2, x, y, z) {
  const span = (a, b) => (b - a === 0 ? 1 : b - a);
  switch (dir) {
    case 'north': return [(x2 - x) / span(x1, x2), (y2 - y) / span(y1, y2)];
    case 'south': return [(x - x1) / span(x1, x2), (y2 - y) / span(y1, y2)];
    case 'west': return [(z - z1) / span(z1, z2), (y2 - y) / span(y1, y2)];
    case 'east': return [(z2 - z) / span(z1, z2), (y2 - y) / span(y1, y2)];
    case 'up': return [(x - x1) / span(x1, x2), (z2 - z) / span(z1, z2)];
    case 'down': return [(x - x1) / span(x1, x2), (z - z1) / span(z1, z2)];
    default: return [0, 0];
  }
}

const FACE_NORMAL = {
  north: [0, 0, -1], south: [0, 0, 1], west: [-1, 0, 0],
  east: [1, 0, 0], up: [0, 1, 0], down: [0, -1, 0],
};

// 4 Eckpunkte (in freier Reihenfolge) je Flächenrichtung.
function faceCorners(dir, x1, y1, z1, x2, y2, z2) {
  switch (dir) {
    case 'north': return [[x1, y1, z1], [x2, y1, z1], [x2, y2, z1], [x1, y2, z1]];
    case 'south': return [[x1, y1, z2], [x2, y1, z2], [x2, y2, z2], [x1, y2, z2]];
    case 'west': return [[x1, y1, z1], [x1, y1, z2], [x1, y2, z2], [x1, y2, z1]];
    case 'east': return [[x2, y1, z1], [x2, y1, z2], [x2, y2, z2], [x2, y2, z1]];
    case 'up': return [[x1, y2, z1], [x2, y2, z1], [x2, y2, z2], [x1, y2, z2]];
    case 'down': return [[x1, y1, z1], [x2, y1, z1], [x2, y1, z2], [x1, y1, z2]];
    default: return null;
  }
}

// Standard-UV (auto-uv), falls im Modell keine uv angegeben ist.
function autoUV(dir, x1, y1, z1, x2, y2, z2) {
  switch (dir) {
    case 'down': return [x1, z1, x2, z2];
    case 'up': return [x1, 16 - z2, x2, 16 - z1];
    case 'north': return [16 - x2, 16 - y2, 16 - x1, 16 - y1];
    case 'south': return [x1, 16 - y2, x2, 16 - y1];
    case 'west': return [z1, 16 - y2, z2, 16 - y1];
    case 'east': return [16 - z2, 16 - y2, 16 - z1, 16 - y1];
    default: return [0, 0, 16, 16];
  }
}

const FACE_DIRS = ['down', 'up', 'north', 'south', 'west', 'east'];

// Baut aus einem Element eine kompakte Darstellung mit Flächen + UVs.
function serializeElement(el, textures, resolver) {
  const from = el.from, to = el.to;
  const [x1, y1, z1] = from;
  const [x2, y2, z2] = to;
  const faces = {};
  let hasTint = false;
  for (const dir of FACE_DIRS) {
    const f = el.faces && el.faces[dir];
    if (!f) continue;
    const file = resolver.textureFile(resolver.deref(f.texture, textures));
    if (!file) continue;
    const auto = autoUV(dir, x1, y1, z1, x2, y2, z2);
    const uv = Array.isArray(f.uv) && f.uv.length === 4 ? f.uv.slice() : auto;
    const face = { tx: file };
    // uv nur speichern, wenn sie von der Auto-UV abweicht (Viewer berechnet sie sonst selbst)
    if (uv[0] !== auto[0] || uv[1] !== auto[1] || uv[2] !== auto[2] || uv[3] !== auto[3]) face.u = uv;
    if (f.rotation) face.fr = f.rotation;
    if (f.tintindex !== undefined) { face.ti = f.tintindex; hasTint = true; }
    faces[dir] = face;
  }
  if (Object.keys(faces).length === 0) return null;
  const out = { f: from, t: to, fa: faces };
  if (el.rotation) out.r = { o: el.rotation.origin, a: el.rotation.axis, g: el.rotation.angle, s: el.rotation.rescale ? 1 : 0 };
  if (hasTint) out.tint = 1;
  return out;
}

// Ist das Modell der triviale 1×1×1-Würfel mit einer Textur (ohne Tint/Rotation)?
function isTrivial(elements, resolver, textures) {
  if (!elements || elements.length !== 1) return false;
  const el = elements[0];
  if (el.rotation) return false;
  const [x1, y1, z1] = el.from, [x2, y2, z2] = el.to;
  if (x1 !== 0 || y1 !== 0 || z1 !== 0 || x2 !== 16 || y2 !== 16 || z2 !== 16) return false;
  const files = new Set();
  for (const dir of FACE_DIRS) {
    const f = el.faces && el.faces[dir];
    if (!f) continue;
    if (f.tintindex !== undefined) return false;
    files.add(resolver.textureFile(resolver.deref(f.texture, textures)));
  }
  return files.size === 1;
}

// Eigenschaften, die die Geometrie nicht ändern -> aus dem Zustands-Key entfernt
// (mehrere Zustände teilen sich dann ein Modell). `shape` wird auf `straight`
// beschränkt (Außen-/Innenecken fallen auf gerade Treppen zurück).
const DROP_PROPS = new Set(['waterlogged']);
const PREFER = { shape: 'straight' };

function normalizeKey(key) {
  const result = [];
  for (const alt of key.split('|')) {
    const props = {};
    for (const p of alt.split(',')) {
      const eq = p.indexOf('=');
      if (eq > 0) props[p.slice(0, eq).trim()] = p.slice(eq + 1).trim();
    }
    let skip = false;
    for (const [k, pref] of Object.entries(PREFER)) {
      if (props[k] !== undefined && props[k] !== pref) { skip = true; break; }
    }
    if (skip) continue;
    const pairs = Object.keys(props).filter((k) => !DROP_PROPS.has(k)).sort().map((k) => `${k}=${props[k]}`);
    result.push(pairs.join(','));
  }
  return result;
}

function main() {
  const mcmeta = arg('--mcmeta', path.join(os.tmpdir(), 'mcmeta'));
  const out = arg('--out', 'blockmodels.js');
  ensureCheckout(mcmeta);

  const resolver = new Resolver(mcmeta);
  const blockIds = fs.readdirSync(resolver.stateDir).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)).sort();

  const blocks = {};
  const modelPool = [];
  const modelIndex = new Map();
  const poolRef = (model) => {
    const key = JSON.stringify(model);
    let id = modelIndex.get(key);
    if (id === undefined) { id = modelPool.length; modelPool.push(model); modelIndex.set(key, id); }
    return id;
  };
  let exported = 0, variants = 0, multipart = 0;

  for (const id of blockIds) {
    if (id === 'air' || id === 'cave_air' || id === 'void_air') continue;
    let state;
    try { state = JSON.parse(fs.readFileSync(path.join(resolver.stateDir, id + '.json'), 'utf8')); } catch { continue; }

    if (state.multipart) { multipart++; continue; } // Zäune/Mauern/Scheiben -> prozeduraler Fallback
    const variantsSpec = state.variants || {};
    const blockEntry = {};

    for (const [key, value] of Object.entries(variantsSpec)) {
      const entry = Array.isArray(value) ? value[0] : value;
      if (!entry || !entry.model) continue;
      const { textures, elements } = resolver.resolveModel(entry.model);
      if (!elements) continue;
      if (isTrivial(elements, resolver, textures)) continue;

      const els = [];
      for (const el of elements) {
        const s = serializeElement(el, textures, resolver);
        if (s) els.push(s);
      }
      if (els.length === 0) continue;

      const model = { e: els };
      if (entry.x) model.rx = entry.x;
      if (entry.y) model.ry = entry.y;
      const id = poolRef(model);

      for (const nk of normalizeKey(key)) {
        blockEntry[nk] = id;
        variants++;
      }
    }

    if (Object.keys(blockEntry).length > 0) {
      blocks[id] = blockEntry;
      exported++;
    }
  }

  const lines = [
    '// Auto-generiert von tools/generate-blockmodels.mjs - nicht manuell bearbeiten.',
    '// Quelle: https://github.com/misode/mcmeta (Zweig \'assets\').',
    '// Map: Block-ID -> { Zustands-Key -> Modell }. Modell: e=Elemente,',
    '// f/t=from/to (in 1/16), fa=Flächen (u=uv, tx=Texturdatei, ti=tintindex, fr=Flächenrotation),',
    '// r=Elementrotation {o,a,g,s}, rx/ry=Zustandsrotation. Nur nicht-triviale Modelle.',
    `window.BLOCK_MODELS = ${JSON.stringify(blocks)};`,
    `window.BLOCK_MODEL_POOL = ${JSON.stringify(modelPool)};`,
    '',
  ].join('\n');

  fs.writeFileSync(out, lines, 'utf8');
  console.error(`[ok] ${exported} Blöcke, ${variants} Zustände, ${multipart} multipart übersprungen -> ${out} (${lines.length} Bytes)`);
}

main();
