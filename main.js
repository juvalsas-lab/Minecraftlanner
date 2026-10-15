import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';

// Lädt die generierten Original-Texturnamen (Block-ID -> Texturdatei), falls sie
// nicht bereits über ein <script src="blocktextures.js"> im Dokument geladen sind.
function loadScript(src) {
  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = resolve; // Ohne Map greift weiterhin die Heuristik.
    document.head.appendChild(script);
  });
}

if (typeof document !== 'undefined' && !globalThis.BLOCK_TEXTURES) {
  await loadScript('blocktextures.js');
}

// Lädt die Zuordnung alter numerischer Block-IDs (Legacy-.schematic-Format).
if (typeof document !== 'undefined' && !globalThis.LEGACY_BLOCKS) {
  await loadScript('legacyblocks.js');
}

// --- 1. SZENE, KAMERA & RENDERER ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 4000);
camera.position.set(18, 16, 26);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

const ambient = new THREE.AmbientLight(0xffffff, 0.55);
scene.add(ambient);
const dirLight = new THREE.DirectionalLight(0xffffff, 2.2);
dirLight.position.set(100, 200, 100);
dirLight.castShadow = true;
dirLight.shadow.mapSize.set(2048, 2048);
dirLight.shadow.bias = -0.0006;
dirLight.shadow.normalBias = 0.02;
scene.add(dirLight);
scene.add(dirLight.target);

// Himmel & Atmosphäre (Sonnenstand wird über die Tageszeit gesteuert)
const sky = new Sky();
sky.scale.setScalar(1500);
scene.add(sky);
const skyUniforms = sky.material.uniforms;
skyUniforms['turbidity'].value = 8;
skyUniforms['rayleigh'].value = 2;
skyUniforms['mieCoefficient'].value = 0.005;
skyUniforms['mieDirectionalG'].value = 0.8;

const gridHelper = new THREE.GridHelper(200, 200, 0x444444, 0x222222);
gridHelper.position.y = -0.5;
scene.add(gridHelper);

// --- 2. HOVER-BLOCK-UMRANDUNG & ISOLIER-RAHMEN ---
const hoverHighlightGroup = new THREE.Group();
const outerHighlightGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.014, 1.014, 1.014));
const innerHighlightGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.005, 1.005, 1.005));
hoverHighlightGroup.add(new THREE.LineSegments(outerHighlightGeo, new THREE.LineBasicMaterial({ color: 0x000000 })));
hoverHighlightGroup.add(new THREE.LineSegments(innerHighlightGeo, new THREE.LineBasicMaterial({ color: 0xffffff })));
hoverHighlightGroup.visible = false;
scene.add(hoverHighlightGroup);

// Gruppe für Röntgen-Blick-Umrandungen
const xrayEdgesGroup = new THREE.Group();
scene.add(xrayEdgesGroup);

// Grüner Rahmen um den isolierten Turm / Bereich
let cropBoxHelper = null;
function updateCropBoxVisual(minX, maxX, minZ, maxZ, maxY) {
  if (cropBoxHelper) {
    scene.remove(cropBoxHelper);
    cropBoxHelper.geometry.dispose();
    cropBoxHelper = null;
  }
  const isCropped = minX > bounds.minX || maxX < bounds.maxX || minZ > bounds.minZ || maxZ < bounds.maxZ;
  document.getElementById('isolationBanner').style.display = isCropped ? 'block' : 'none';
  document.getElementById('matPanelTitle').textContent = isCropped ? '📦 Isolierter Turm' : '📦 Materialien';

  if (isCropped) {
    const w = (maxX - minX) + 1;
    const h = maxY + 1;
    const d = (maxZ - minZ) + 1;
    const geo = new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, d));
    cropBoxHelper = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0x55ff55 }));
    cropBoxHelper.position.set(minX + w / 2 - 0.5, h / 2 - 0.5, minZ + d / 2 - 0.5);
    scene.add(cropBoxHelper);
  }
}

// --- 3. FLUG-STEUERUNG & TASTEN ---
const controls = new PointerLockControls(camera, renderer.domElement);
document.getElementById('flyBtn').addEventListener('click', () => controls.lock());
renderer.domElement.addEventListener('click', () => controls.lock());

const keys = { KeyW: false, KeyA: false, KeyS: false, KeyD: false, Space: false, ShiftLeft: false };
let flySpeed = 20;
let hoveredBlock = null;
let activeXrayBlock = null; // Speichert den aktuell im Röntgen-Blick ausgewählten Blocktyp

document.addEventListener('keydown', (e) => {
  // Entfernt Fokus von Reglern, damit Tasten immer sofort funktionieren
  if (document.activeElement && document.activeElement.tagName === 'INPUT') {
    document.activeElement.blur();
  }

  if (keys.hasOwnProperty(e.code)) keys[e.code] = true;
  if (e.code === 'ArrowUp') changeLayerBy(1);
  if (e.code === 'ArrowDown') changeLayerBy(-1);
  if (e.code === 'KeyF' && hoveredBlock) isolateTowerOrSection(hoveredBlock);
  if (e.code === 'KeyR') resetCropBounds();
  if (e.code === 'KeyX') setXrayBlock(null);
  if (e.key === '+' || e.code === 'NumpadAdd') expandIsolatedArea(1);
  if (e.key === '-' || e.code === 'NumpadSubtract') expandIsolatedArea(-1);
});

document.addEventListener('keyup', (e) => {
  if (keys.hasOwnProperty(e.code)) keys[e.code] = false;
});

const mouseNDC = new THREE.Vector2(0, 0);
window.addEventListener('mousemove', (e) => {
  if (!controls.isLocked) {
    mouseNDC.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouseNDC.y = -(e.clientY / window.innerHeight) * 2 + 1;
  } else {
    mouseNDC.set(0, 0);
  }
});

// --- 4. ORIGINAL MINECRAFT TEXTUREN & RÖNTGEN-MATERIALIEN ---
const materialCache = new Map();
const ghostMaterialCache = new Map();
const iconUrlCache = new Map();
const REMOTE_TEXTURE_BASE = 'https://raw.githubusercontent.com/misode/mcmeta/assets/assets/minecraft/textures/block/';

// Original-Texturname je Block, generiert aus den echten Minecraft-Daten
// (siehe tools/generate-blocktextures.py, geladen über blocktextures.js).
const BLOCK_TEXTURES = (typeof globalThis !== 'undefined' && globalThis.BLOCK_TEXTURES) || {};

function resolveTextureFileName(cleanName) {
  if (BLOCK_TEXTURES[cleanName]) return BLOCK_TEXTURES[cleanName];
  return guessTextureFileName(cleanName);
}

function guessTextureFileName(cleanName) {
  const exactMap = {
    grass_block: 'grass_block_side', dirt_path: 'dirt_path_side', podzol: 'podzol_side',
    mycelium: 'mycelium_side', snow_block: 'snow', quartz_block: 'quartz_block_side',
    smooth_quartz: 'quartz_block_bottom', smooth_sandstone: 'sandstone_top',
    smooth_red_sandstone: 'red_sandstone_top', water: 'water_still', lava: 'lava_still',
    hay_block: 'hay_block_side', barrel: 'barrel_side', crafting_table: 'crafting_table_front',
    furnace: 'furnace_front', blast_furnace: 'blast_furnace_front', smoker: 'smoker_front',
    tnt: 'tnt_side', melon: 'melon_side', pumpkin: 'pumpkin_side', carved_pumpkin: 'carved_pumpkin',
    jack_o_lantern: 'jack_o_lantern', magma_block: 'magma', wall_torch: 'torch',
    soul_wall_torch: 'soul_torch', redstone_wall_torch: 'redstone_torch'
  };
  if (exactMap[cleanName]) return exactMap[cleanName];

  const woods = ['oak', 'spruce', 'birch', 'jungle', 'acacia', 'dark_oak', 'mangrove', 'cherry', 'bamboo', 'crimson', 'warped'];
  for (const w of woods) {
    if (
      cleanName === `${w}_stairs` || cleanName === `${w}_slab` ||
      cleanName === `${w}_fence` || cleanName === `${w}_fence_gate` ||
      cleanName === `${w}_button` || cleanName === `${w}_pressure_plate`
    ) return `${w}_planks`;
    if (cleanName === `${w}_wood`) return `${w}_log`;
    if (cleanName === `stripped_${w}_wood`) return `stripped_${w}_log`;
  }

  if (cleanName === 'glass_pane') return 'glass';
  if (cleanName.endsWith('_stained_glass_pane')) return cleanName.replace('_pane', '');
  if (cleanName.endsWith('_carpet') && !cleanName.includes('moss')) return cleanName.replace('_carpet', '_wool');

  let base = cleanName
    .replace('_stairs', '').replace('_slab', '').replace('_wall', '')
    .replace('_fence', '').replace('_button', '').replace('_pressure_plate', '');

  const pluralFixes = {
    brick: 'bricks', stone_brick: 'stone_bricks', mossy_stone_brick: 'mossy_stone_bricks',
    deepslate_brick: 'deepslate_bricks', deepslate_tile: 'deepslate_tiles', mud_brick: 'mud_bricks',
    nether_brick: 'nether_bricks', red_nether_brick: 'red_nether_bricks', prismarine_brick: 'prismarine_bricks',
    end_stone_brick: 'end_stone_bricks', polished_blackstone_brick: 'polished_blackstone_bricks', quartz_brick: 'quartz_bricks'
  };
  return pluralFixes[base] || base;
}

function createFallbackCanvas() {
  const canvas = document.createElement('canvas');
  canvas.width = 16; canvas.height = 16;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#888888';
  ctx.fillRect(0, 0, 16, 16);
  ctx.strokeStyle = 'rgba(0,0,0,0.2)';
  ctx.strokeRect(0, 0, 16, 16);
  return canvas;
}

function loadOriginalTextureImage(texFile, onSuccess) {
  const img = new Image();
  img.crossOrigin = 'Anonymous';
  img.onload = () => onSuccess(img);
  img.onerror = () => {
    const remoteImg = new Image();
    remoteImg.crossOrigin = 'Anonymous';
    remoteImg.onload = () => onSuccess(remoteImg);
    remoteImg.src = `${REMOTE_TEXTURE_BASE}${texFile}.png`;
  };
  img.src = `./textures/block/${texFile}.png`;
}

// Gekreuzte Pflanzen (Blumen, Setzlinge, Gras, Feldfrüchte …) werden als
// zwei sich kreuzende Ebenen statt als Würfel dargestellt.
const CROSS_PLANT_RE = new RegExp(
  '(_sapling|_flower|tulip|dandelion|poppy|allium|blue_orchid|azure_bluet|' +
  'oxeye_daisy|cornflower|lily_of_the_valley|torchflower|sunflower|lilac|' +
  'rose_bush|peony|short_grass|tall_grass|fern|dead_bush|sweet_berry_bush|' +
  'wither_rose|pink_petals|mushroom|wheat|carrots|potatoes|beetroots|' +
  'nether_wart|sugar_cane|kelp|seagrass|roots|fungus|sprouts|vines)$'
);

function isCrossPlant(cleanName) {
  return CROSS_PLANT_RE.test(cleanName);
}

// Blöcke mit transparenten Texturen, die als "Cutout" gerendert werden müssen
// (transparenter Hintergrund wird per alphaTest weggeschnitten).
function isCutoutBlock(cleanName) {
  return cleanName === 'torch' || cleanName.endsWith('_torch') ||
    cleanName === 'lantern' || cleanName.endsWith('_lantern') ||
    cleanName === 'chain' || cleanName === 'rail' || cleanName.endsWith('_rail') ||
    cleanName === 'ladder' || cleanName === 'vine' ||
    cleanName === 'tripwire' || cleanName === 'redstone_wire';
}

// Leuchtende Blöcke (Emissive-Glow, Fackeln zusätzlich als Punktlicht).
function isEmissiveBlock(cleanName) {
  return cleanName === 'torch' || cleanName.endsWith('_torch') ||
    cleanName === 'lantern' || cleanName.endsWith('_lantern') ||
    cleanName === 'glowstone' || cleanName === 'sea_lantern' ||
    cleanName === 'shroomlight' || cleanName === 'magma_block' ||
    cleanName === 'lava' || cleanName === 'end_rod' ||
    cleanName === 'jack_o_lantern' || cleanName === 'redstone_lamp' ||
    cleanName === 'campfire' || cleanName === 'soul_campfire' ||
    cleanName === 'crying_obsidian' || cleanName === 'respawn_anchor' ||
    cleanName === 'beacon' || cleanName === 'conduit' || cleanName.endsWith('froglight');
}

// Farbe/Stärke eines Fackel-Lichts je Blocktyp (null = kein Punktlicht).
function emitterInfo(rawType) {
  const { name } = parseBlockState(rawType);
  if (!isEmissiveBlock(name)) return null;
  if (name.includes('soul')) return { color: 0x4fd6ff, intensity: 7, distance: 15 };
  if (name.includes('redstone') || name === 'crying_obsidian' || name === 'respawn_anchor') return { color: 0xff4040, intensity: 5, distance: 12 };
  if (name === 'torch' || name.endsWith('_torch') || name === 'lantern' || name === 'campfire' || name === 'jack_o_lantern') {
    return { color: 0xffb45a, intensity: 8, distance: 16 };
  }
  return { color: 0xffd08a, intensity: 7, distance: 15 };
}

// Gemeinsame Uhr für animierte Shader (Wasserwellen).
const shaderTime = { value: 0 };

function applyWaterShader(mat) {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = shaderTime;
    shader.vertexShader = 'uniform float uTime;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      #ifdef USE_INSTANCING
        vec2 wp = vec2(instanceMatrix[3][0], instanceMatrix[3][2]);
      #else
        vec2 wp = vec2(0.0);
      #endif
      float wave = sin((position.x + wp.x) * 2.0 + uTime * 1.8) * 0.05
                 + sin((position.z + wp.y) * 2.3 - uTime * 1.4) * 0.05;
      transformed.y += wave;`
    );
  };
  mat.customProgramCacheKey = () => 'waterShaded';
}

function getBlockMaterial(rawBlockName, isGhost = false) {
  const cleanName = rawBlockName.replace('minecraft:', '').split('[')[0];

  if (!materialCache.has(cleanName)) {
    const isGlass = cleanName.includes('glass') || cleanName.includes('ice') || cleanName.includes('bars');
    const isWater = cleanName.includes('water');
    const isCross = isCrossPlant(cleanName);
    const isCutout = isCutoutBlock(cleanName);
    const isEmissive = isEmissiveBlock(cleanName);
    const isTransparent = isGlass || isWater || cleanName.includes('leaves');

    const texFile = resolveTextureFileName(cleanName);
    const placeholderTex = new THREE.CanvasTexture(createFallbackCanvas());
    placeholderTex.magFilter = THREE.NearestFilter;
    placeholderTex.minFilter = THREE.NearestFilter;
    placeholderTex.colorSpace = THREE.SRGBColorSpace;

    const normalMat = new THREE.MeshLambertMaterial({
      map: placeholderTex,
      transparent: isTransparent,
      opacity: isGlass || isWater ? 0.65 : 1.0,
      alphaTest: (isCross || isCutout) ? 0.5 : (isTransparent ? 0.1 : 0),
      side: isCross ? THREE.DoubleSide : THREE.FrontSide,
      emissive: isEmissive ? 0xffffff : 0x000000,
      emissiveIntensity: isEmissive ? 0.7 : 0.0,
      emissiveMap: isEmissive ? placeholderTex : null
    });
    if (isWater) applyWaterShader(normalMat);

    const ghostMat = new THREE.MeshLambertMaterial({
      map: placeholderTex,
      transparent: true,
      opacity: 0.14,
      depthWrite: false,
      side: isCross ? THREE.DoubleSide : THREE.FrontSide
    });

    loadOriginalTextureImage(texFile, (img) => {
      const canvas = document.createElement('canvas');
      canvas.width = 16; canvas.height = 16;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, 16, 16, 0, 0, 16, 16);

      if (cleanName.includes('leaves') && !cleanName.includes('cherry')) {
        ctx.globalCompositeOperation = 'multiply';
        ctx.fillStyle = '#59ae30';
        ctx.fillRect(0, 0, 16, 16);
        ctx.globalCompositeOperation = 'destination-in';
        ctx.drawImage(img, 0, 0, 16, 16, 0, 0, 16, 16);
        ctx.globalCompositeOperation = 'source-over';
      }

      const finalTex = new THREE.CanvasTexture(canvas);
      finalTex.magFilter = THREE.NearestFilter;
      finalTex.minFilter = THREE.NearestFilter;
      finalTex.colorSpace = THREE.SRGBColorSpace;

      normalMat.map = finalTex;
      normalMat.needsUpdate = true;
      if (isEmissive) normalMat.emissiveMap = finalTex;
      ghostMat.map = finalTex;
      ghostMat.needsUpdate = true;

      const dataUrl = canvas.toDataURL();
      iconUrlCache.set(cleanName, dataUrl);
      document.querySelectorAll(`img[data-block="${cleanName}"]`).forEach((el) => {
        el.src = dataUrl;
      });
    });

    materialCache.set(cleanName, normalMat);
    ghostMaterialCache.set(cleanName, ghostMat);
  }

  return isGhost ? ghostMaterialCache.get(cleanName) : materialCache.get(cleanName);
}

function formatBlockName(cleanName) {
  return cleanName.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

// --- 5. SMARTE TURM-ISOLIERUNG (TASTE F) & BUILDING ENGINE ---
const buildingGroup = new THREE.Group();
scene.add(buildingGroup);

let allBlocks = [];
let columnMaxYMap = new Map(); // Speichert für jede (x,z)-Säule die maximale Höhe (für Turm-Erkennung)
let bounds = { minX: 0, maxX: 0, minY: 0, maxY: 0, minZ: 0, maxZ: 0 };

// Licht-Pool: feste Anzahl Punktlichter, die den nächstgelegenen Fackeln folgen.
// (Feste Anzahl verhindert Shader-Neukompilierung; inaktive Lichter haben Intensität 0.)
const LIGHT_POOL_SIZE = 12;
const lightPool = [];
for (let i = 0; i < LIGHT_POOL_SIZE; i++) {
  const pl = new THREE.PointLight(0xffb45a, 0, 15, 2);
  scene.add(pl);
  lightPool.push(pl);
}
let emitterPositions = []; // { x, y, z, color, intensity, distance }

const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const edgeGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.006, 1.006, 1.006));
const xrayEdgeMat = new THREE.LineBasicMaterial({ color: 0x55ff55 });

// --- 5a. BLOCKMODELLE (nicht-würfelige Blöcke) ---
let detailModels = true; // Schalter "Detaillierte Blockmodelle"
const geometryCache = new Map();

function makeBox(w, h, d, x = 0, y = 0, z = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  return g;
}

// Zwei sich kreuzende Ebenen (Pflanzen, Gras, Blumen …)
function makeCrossPlant() {
  const a = new THREE.PlaneGeometry(1, 1);
  const b = new THREE.PlaneGeometry(1, 1);
  b.rotateY(Math.PI / 2);
  return mergeGeometries([a, b]);
}

// "minecraft:oak_stairs[facing=east,half=bottom]" -> { name, props }
function parseBlockState(type) {
  const raw = type.replace('minecraft:', '');
  const i = raw.indexOf('[');
  if (i === -1) return { name: raw, props: {} };
  const name = raw.slice(0, i);
  const props = {};
  const inner = raw.endsWith(']') ? raw.slice(i + 1, -1) : raw.slice(i + 1);
  inner.split(',').forEach((pair) => {
    const eq = pair.indexOf('=');
    if (eq > 0) props[pair.slice(0, eq)] = pair.slice(eq + 1);
  });
  return { name, props };
}

// Drehung je Himmelsrichtung (Ausrichtung aus dem Block-State)
const FACING_Y = { east: Math.PI / 2, west: -Math.PI / 2, south: Math.PI, north: 0, up: 0, down: 0 };

function rotateForFacing(geo, facing, flipAxis = false) {
  let angle = FACING_Y[facing] ?? 0;
  if (flipAxis) angle += Math.PI / 2;
  if (angle) geo.rotateY(angle);
  return geo;
}

function buildStairsGeometry(half, facing) {
  const parts = [];
  if (half === 'top') {
    parts.push(makeBox(1, 0.5, 1, 0, 0.25, 0));
    parts.push(makeBox(1, 0.5, 0.5, 0, -0.25, -0.25));
  } else {
    parts.push(makeBox(1, 0.5, 1, 0, -0.25, 0));
    parts.push(makeBox(1, 0.5, 0.5, 0, 0.25, -0.25));
  }
  return rotateForFacing(mergeGeometries(parts), facing);
}

// Liefert eine Geometrie für einen Blocktyp oder null (= Standard-Würfel).
function buildGeometryForModel(name, props) {
  const facing = props.facing;

  if (isCrossPlant(name)) return makeCrossPlant();

  if (name === 'torch' || (name.endsWith('_torch') && !name.endsWith('_torchflower'))) {
    const parts = [makeBox(0.14, 0.62, 0.14, 0, -0.19, 0), makeBox(0.25, 0.25, 0.25, 0, 0.16, 0)];
    const geo = mergeGeometries(parts);
    return name.includes('wall') ? rotateForFacing(geo, facing, true) : geo;
  }
  if (name.endsWith('_door') || name === 'iron_door') {
    return rotateForFacing(makeBox(1, 1, 0.18, 0, 0, 0), facing);
  }
  if (name.endsWith('_trapdoor') || name === 'iron_trapdoor') {
    return props.open === 'true' ? makeBox(1, 0.18, 1, 0, 0.41, 0) : makeBox(1, 0.18, 1, 0, -0.41, 0);
  }
  if (name.endsWith('_slab')) {
    if (props.type === 'double') return makeBox(1, 1, 1, 0, 0, 0);
    return makeBox(1, 0.5, 1, 0, props.type === 'top' ? 0.25 : -0.25, 0);
  }
  if (name.endsWith('_stairs')) return buildStairsGeometry(props.half, facing);

  if (name.endsWith('_fence') || name.endsWith('_fence_gate')) {
    // Pfosten immer; Querlatten nur in Richtungen mit Verbindung (Bitmaske):
    // 1 = +X (Ost), 2 = -X (West), 4 = +Z (Süd), 8 = -Z (Nord)
    const conn = props.conn || 0;
    const parts = [makeBox(0.25, 1, 0.25, 0, 0, 0)];
    for (const y of [0.19, -0.12]) {
      if (conn & 1) parts.push(makeBox(0.5, 0.12, 0.1, 0.25, y, 0));
      if (conn & 2) parts.push(makeBox(0.5, 0.12, 0.1, -0.25, y, 0));
      if (conn & 4) parts.push(makeBox(0.1, 0.12, 0.5, 0, y, 0.25));
      if (conn & 8) parts.push(makeBox(0.1, 0.12, 0.5, 0, y, -0.25));
    }
    return mergeGeometries(parts);
  }
  if (name.endsWith('_wall')) {
    return mergeGeometries([
      makeBox(0.5, 1, 0.5, 0, 0, 0),
      makeBox(1, 0.3, 0.2, 0, 0.28, 0), makeBox(0.2, 0.3, 1, 0, 0.28, 0)
    ]);
  }
  if (name.endsWith('_pane') || name === 'iron_bars') {
    return mergeGeometries([makeBox(1, 1, 0.07, 0, 0, 0), makeBox(0.07, 1, 1, 0, 0, 0)]);
  }
  if (name.endsWith('_carpet')) return makeBox(1, 0.07, 1, 0, -0.465, 0);
  if (name === 'snow') return makeBox(1, 0.13, 1, 0, -0.435, 0);
  if (name.endsWith('_pressure_plate')) return makeBox(0.875, 0.07, 0.875, 0, -0.465, 0);
  if (name.endsWith('_button')) return makeBox(0.375, 0.2, 0.375, 0, 0, 0);
  if (name === 'lever') return makeBox(0.5, 0.2, 0.5, 0, 0, 0);
  if (name === 'ladder') return rotateForFacing(makeBox(1, 1, 0.08, 0, 0, 0), facing);
  if (name === 'chain') return makeBox(0.16, 1, 0.16, 0, 0, 0);
  if (name === 'end_rod') return makeBox(0.25, 1, 0.25, 0, 0, 0);
  if (name.endsWith('lantern')) return makeBox(0.4, 0.5, 0.4, 0, -0.2, 0);
  if (name === 'lily_pad') return makeBox(1, 0.05, 1, 0, -0.475, 0);
  if (name === 'redstone_wire' || name === 'tripwire') return makeBox(1, 0.05, 1, 0, -0.475, 0);
  if (name === 'rail' || name.endsWith('_rail')) return makeBox(1, 0.08, 1, 0, -0.46, 0);
  if (name === 'vine') return makeBox(1, 1, 0.06, 0, 0, 0);
  return null;
}

// Gruppenschlüssel: gleiche Geometrie nur bei gleichen formrelevanten Props.
function modelKeyOf(name, props) {
  return name + '|' + (props.facing || '') + '|' + (props.half || '') +
         '|' + (props.type || '') + '|' + (props.open || '') + '|' + (props.conn || 0);
}

function getBlockGeometry(name, props) {
  const key = modelKeyOf(name, props);
  if (geometryCache.has(key)) return geometryCache.get(key);
  const geo = (detailModels && buildGeometryForModel(name, props)) || boxGeo;
  geometryCache.set(key, geo);
  return geo;
}

const layerSlider = document.getElementById('layerSlider');
const layerVal = document.getElementById('layerVal');
const layerMode = document.getElementById('layerMode');
const xMinSlider = document.getElementById('xMinSlider');
const xMaxSlider = document.getElementById('xMaxSlider');
const zMinSlider = document.getElementById('zMinSlider');
const zMaxSlider = document.getElementById('zMaxSlider');
const xRangeVal = document.getElementById('xRangeVal');
const zRangeVal = document.getElementById('zRangeVal');
const onlyVisibleLayerCheck = document.getElementById('onlyVisibleLayerCheck');

function setBuildingData(blocksArray) {
  allBlocks = blocksArray;
  columnMaxYMap.clear();
  bounds = { minX: Infinity, maxX: -Infinity, minY: 0, maxY: 0, minZ: Infinity, maxZ: -Infinity };
  emitterPositions = [];

  for (const b of allBlocks) {
    if (b.x < bounds.minX) bounds.minX = b.x;
    if (b.x > bounds.maxX) bounds.maxX = b.x;
    if (b.y > bounds.maxY) bounds.maxY = b.y;
    if (b.z < bounds.minZ) bounds.minZ = b.z;
    if (b.z > bounds.maxZ) bounds.maxZ = b.z;

    const colKey = `${b.x},${b.z}`;
    const prevMax = columnMaxYMap.get(colKey) ?? -1;
    if (b.y > prevMax) columnMaxYMap.set(colKey, b.y);

    // Leuchtende Blöcke für den Licht-Pool einsammeln
    const info = emitterInfo(b.type);
    if (info) emitterPositions.push({ x: b.x, y: b.y + 0.2, z: b.z, ...info });
  }

  layerSlider.max = bounds.maxY;
  layerSlider.value = bounds.maxY;

  xMinSlider.min = bounds.minX; xMinSlider.max = bounds.maxX; xMinSlider.value = bounds.minX;
  xMaxSlider.min = bounds.minX; xMaxSlider.max = bounds.maxX; xMaxSlider.value = bounds.maxX;

  zMinSlider.min = bounds.minZ; zMinSlider.max = bounds.maxZ; zMinSlider.value = bounds.minZ;
  zMaxSlider.min = bounds.minZ; zMaxSlider.max = bounds.maxZ; zMaxSlider.value = bounds.maxZ;

  updateShadowCamera();
  updateBuildingView();
}

// Passt die Schatten-Kamera der Sonne an die Größe des Gebäudes an.
function updateShadowCamera() {
  const spanX = bounds.maxX - bounds.minX;
  const spanZ = bounds.maxZ - bounds.minZ;
  const spanY = bounds.maxY - bounds.minY;
  const radius = Math.max(spanX, spanZ, spanY) * 0.65 + 10;

  const cam = dirLight.shadow.camera;
  cam.left = -radius; cam.right = radius;
  cam.top = radius; cam.bottom = -radius;
  cam.near = 1;
  cam.far = 2000;
  cam.updateProjectionMatrix();
  updateSun();
}

// Erkennt beim Drücken von [F] automatisch die Grundfläche des angeschauten Turms!
function isolateTowerOrSection(targetBlock) {
  // 1. Suche die höchste Spitze in unmittelbarer Nähe (3x3 um den anvisierten Block)
  let localPeakY = columnMaxYMap.get(`${targetBlock.x},${targetBlock.z}`) || targetBlock.y;
  for (let dx = -2; dx <= 2; dx++) {
    for (let dz = -2; dz <= 2; dz++) {
      const h = columnMaxYMap.get(`${targetBlock.x + dx},${targetBlock.z + dz}`) || 0;
      if (h > localPeakY) localPeakY = h;
    }
  }

  // 2. Smarte Turm-Erkennung (Flood-Fill): Alle zusammenhängenden Säulen finden, die zu diesem hohen Bauteil gehören
  const heightThreshold = Math.max(2, localPeakY - 4);
  const visited = new Set();
  const queue = [[targetBlock.x, targetBlock.z]];
  visited.add(`${targetBlock.x},${targetBlock.z}`);

  let foundMinX = targetBlock.x, foundMaxX = targetBlock.x;
  let foundMinZ = targetBlock.z, foundMaxZ = targetBlock.z;

  while (queue.length > 0) {
    const [cx, cz] = queue.shift();
    if (cx < foundMinX) foundMinX = cx;
    if (cx > foundMaxX) foundMaxX = cx;
    if (cz < foundMinZ) foundMinZ = cz;
    if (cz > foundMaxZ) foundMaxZ = cz;

    // Maximal 14x14 Blöcke für automatische Turmerkennung
    if ((foundMaxX - foundMinX) > 14 || (foundMaxZ - foundMinZ) > 14) break;

    const neighbors = [[cx + 1, cz], [cx - 1, cz], [cx, cz + 1], [cx, cz - 1]];
    for (const [nx, nz] of neighbors) {
      const key = `${nx},${nz}`;
      if (visited.has(key)) continue;
      const colH = columnMaxYMap.get(key) ?? -1;
      if (colH >= heightThreshold) {
        visited.add(key);
        queue.push([nx, nz]);
      }
    }
  }

  // Falls kein abgegrenzter Turm erkannt wurde (z.B. flache Mauer), nutze kompakten 5x5 Ausschnitt (Radius 2)
  const spanX = foundMaxX - foundMinX;
  const spanZ = foundMaxZ - foundMinZ;
  if (spanX < 1 || spanX > 12 || spanZ < 1 || spanZ > 12) {
    const defaultRadius = 2;
    foundMinX = Math.max(bounds.minX, targetBlock.x - defaultRadius);
    foundMaxX = Math.min(bounds.maxX, targetBlock.x + defaultRadius);
    foundMinZ = Math.max(bounds.minZ, targetBlock.z - defaultRadius);
    foundMaxZ = Math.min(bounds.maxZ, targetBlock.z + defaultRadius);
  }

  xMinSlider.value = foundMinX;
  xMaxSlider.value = foundMaxX;
  zMinSlider.value = foundMinZ;
  zMaxSlider.value = foundMaxZ;

  // Zähler rechts automatisch auf den isolierten Turm stellen
  onlyVisibleLayerCheck.checked = true;
  updateBuildingView();
}

// Vergrößert oder verkleinert den isolierten Bereich mit [+] und [-]
function expandIsolatedArea(delta) {
  let minX = parseInt(xMinSlider.value, 10);
  let maxX = parseInt(xMaxSlider.value, 10);
  let minZ = parseInt(zMinSlider.value, 10);
  let maxZ = parseInt(zMaxSlider.value, 10);

  minX = Math.max(bounds.minX, minX - delta);
  maxX = Math.min(bounds.maxX, maxX + delta);
  minZ = Math.max(bounds.minZ, minZ - delta);
  maxZ = Math.min(bounds.maxZ, maxZ + delta);

  if (minX <= maxX && minZ <= maxZ) {
    xMinSlider.value = minX;
    xMaxSlider.value = maxX;
    zMinSlider.value = minZ;
    zMaxSlider.value = maxZ;
    updateBuildingView();
  }
}

function resetCropBounds() {
  xMinSlider.value = bounds.minX;
  xMaxSlider.value = bounds.maxX;
  zMinSlider.value = bounds.minZ;
  zMaxSlider.value = bounds.maxZ;
  layerMode.value = 'all';
  layerSlider.value = bounds.maxY;
  updateBuildingView();
}

document.getElementById('resetCropBtn').addEventListener('click', resetCropBounds);

// Schaltet den Röntgen-Blick für einen bestimmten Blocktyp an/aus
function setXrayBlock(cleanName) {
  activeXrayBlock = (activeXrayBlock === cleanName) ? null : cleanName;
  document.getElementById('xrayBanner').style.display = activeXrayBlock ? 'block' : 'none';
  updateBuildingView();
}

function updateBuildingView() {
  while (buildingGroup.children.length > 0) {
    const mesh = buildingGroup.children[0];
    mesh.dispose();
    buildingGroup.remove(mesh);
  }
  while (xrayEdgesGroup.children.length > 0) {
    xrayEdgesGroup.remove(xrayEdgesGroup.children[0]);
  }

  const mode = layerMode.value;
  let minX = parseInt(xMinSlider.value, 10);
  let maxX = parseInt(xMaxSlider.value, 10);
  if (minX > maxX) [minX, maxX] = [maxX, minX];

  let minZ = parseInt(zMinSlider.value, 10);
  let maxZ = parseInt(zMaxSlider.value, 10);
  if (minZ > maxZ) [minZ, maxZ] = [maxZ, minZ];

  // Maximale Höhe innerhalb des aktuell isolierten Bereichs bestimmen
  let areaMaxY = 0;
  for (const b of allBlocks) {
    if (b.x >= minX && b.x <= maxX && b.z >= minZ && b.z <= maxZ) {
      if (b.y > areaMaxY) areaMaxY = b.y;
    }
  }
  layerSlider.max = areaMaxY;
  if (parseInt(layerSlider.value, 10) > areaMaxY || mode === 'all') {
    layerSlider.value = areaMaxY;
  }
  const targetY = parseInt(layerSlider.value, 10);

  layerVal.textContent = mode === 'all' ? `Alle (0 bis ${areaMaxY})` : `${targetY} / ${areaMaxY}`;
  xRangeVal.textContent = (minX === bounds.minX && maxX === bounds.maxX) ? 'Alle' : `${minX} bis ${maxX}`;
  zRangeVal.textContent = (minZ === bounds.minZ && maxZ === bounds.maxZ) ? 'Alle' : `${minZ} bis ${maxZ}`;

  updateCropBoxVisual(minX, maxX, minZ, maxZ, areaMaxY);

  const groupedVisible = new Map();   // cleanName -> Positionen (für die Materialliste)
  const renderGroups = new Map();     // Model-Key  -> { cleanName, geometry, positions }

  // Belegte Positionen für die Zaun-Verbindungserkennung
  const occupied = new Set();
  for (const b of allBlocks) occupied.add(`${b.x},${b.y},${b.z}`);

  for (const b of allBlocks) {
    if (b.x < minX || b.x > maxX || b.z < minZ || b.z > maxZ) continue;
    if (mode === 'upTo' && b.y > targetY) continue;
    if (mode === 'single' && b.y !== targetY) continue;

    const { name, props } = parseBlockState(b.type);
    if (!groupedVisible.has(name)) groupedVisible.set(name, []);
    groupedVisible.get(name).push(b);

    // Zäune/Zauntore: Verbindungen zu Nachbarblöcken ermitteln
    if (name.endsWith('_fence') || name.endsWith('_fence_gate')) {
      let conn = 0;
      if (occupied.has(`${b.x + 1},${b.y},${b.z}`)) conn |= 1;
      if (occupied.has(`${b.x - 1},${b.y},${b.z}`)) conn |= 2;
      if (occupied.has(`${b.x},${b.y},${b.z + 1}`)) conn |= 4;
      if (occupied.has(`${b.x},${b.y},${b.z - 1}`)) conn |= 8;
      props.conn = conn;
    }

    const key = modelKeyOf(name, props);
    if (!renderGroups.has(key)) renderGroups.set(key, { cleanName: name, geometry: getBlockGeometry(name, props), positions: [] });
    renderGroups.get(key).positions.push(b);
  }

  const dummy = new THREE.Object3D();
  for (const { cleanName, geometry, positions } of renderGroups.values()) {
    const isGhost = activeXrayBlock !== null && activeXrayBlock !== cleanName;
    const mat = getBlockMaterial(cleanName, isGhost);
    const instancedMesh = new THREE.InstancedMesh(geometry, mat, positions.length);

    for (let i = 0; i < positions.length; i++) {
      const p = positions[i];
      dummy.position.set(p.x, p.y, p.z);
      dummy.updateMatrix();
      instancedMesh.setMatrixAt(i, dummy.matrix);

      // Leuchtender Rahmen um hervorgehobene Blöcke im Röntgen-Blick
      if (activeXrayBlock === cleanName) {
        const line = new THREE.LineSegments(edgeGeo, xrayEdgeMat);
        line.position.set(p.x, p.y, p.z);
        xrayEdgesGroup.add(line);
      }
    }
    instancedMesh.instanceMatrix.needsUpdate = true;
    instancedMesh.userData.blocks = positions;
    instancedMesh.castShadow = !mat.transparent && !isCrossPlant(cleanName);
    instancedMesh.receiveShadow = true;
    buildingGroup.add(instancedMesh);
  }

  updateMaterialListUI(groupedVisible);
}

function updateMaterialListUI(groupedVisible) {
  const countMap = new Map();
  let totalBlocks = 0;

  if (onlyVisibleLayerCheck.checked) {
    for (const [cleanName, list] of groupedVisible.entries()) {
      countMap.set(cleanName, list.length);
      totalBlocks += list.length;
    }
  } else {
    for (const b of allBlocks) {
      const cleanName = b.type.replace('minecraft:', '').split('[')[0];
      getBlockMaterial(cleanName, false);
      countMap.set(cleanName, (countMap.get(cleanName) || 0) + 1);
      totalBlocks++;
    }
  }

  document.getElementById('totalBlocksBadge').textContent = `${totalBlocks} Blöcke`;

  const sortedEntries = [...countMap.entries()].sort((a, b) => b[1] - a[1]);
  const listContainer = document.getElementById('materialList');
  listContainer.innerHTML = '';

  for (const [cleanName, count] of sortedEntries) {
    const stacks = Math.floor(count / 64);
    const remainder = count % 64;
    let stackText = '';
    if (stacks > 0 && remainder > 0) stackText = `${stacks} Stack${stacks > 1 ? 's' : ''} + ${remainder}`;
    else if (stacks > 0) stackText = `${stacks} Stack${stacks > 1 ? 's' : ''}`;
    else stackText = `${remainder} Stück`;

    const texFile = resolveTextureFileName(cleanName);
    const iconSrc = iconUrlCache.get(cleanName) || `${REMOTE_TEXTURE_BASE}${texFile}.png`;

    const row = document.createElement('div');
    row.className = 'mat-item' + (activeXrayBlock === cleanName ? ' active-xray' : '');
    row.innerHTML = `
      <div class="mat-left">
        <img class="mat-icon" data-block="${cleanName}" src="${iconSrc}" alt="${cleanName}">
        <div class="mat-name" title="${formatBlockName(cleanName)}">${formatBlockName(cleanName)}</div>
      </div>
      <div class="mat-right">
        <div class="mat-count">${count}x</div>
        <div class="mat-stacks">${stackText}</div>
      </div>
    `;
    row.addEventListener('click', () => setXrayBlock(cleanName));
    listContainer.appendChild(row);
  }
}

function changeLayerBy(delta) {
  if (layerMode.value === 'all') layerMode.value = 'upTo';
  const maxAllowed = parseInt(layerSlider.max, 10);
  const next = Math.max(0, Math.min(maxAllowed, parseInt(layerSlider.value, 10) + delta));
  layerSlider.value = next;
  updateBuildingView();
}

layerSlider.addEventListener('input', () => {
  if (layerMode.value === 'all') layerMode.value = 'upTo';
  updateBuildingView();
});
layerMode.addEventListener('change', updateBuildingView);
xMinSlider.addEventListener('input', updateBuildingView);
xMaxSlider.addEventListener('input', updateBuildingView);
zMinSlider.addEventListener('input', updateBuildingView);
zMaxSlider.addEventListener('input', updateBuildingView);
onlyVisibleLayerCheck.addEventListener('change', updateBuildingView);

document.getElementById('speedSlider').addEventListener('input', (e) => {
  flySpeed = parseFloat(e.target.value);
  document.getElementById('speedVal').textContent = flySpeed;
});

// --- 5b. SHADER-LOOK: HIMMEL, SONNE, WASSER & POST-PROCESSING ---
const sunVec = new THREE.Vector3();
const DAY_FOG = new THREE.Color(0x9fc6e8);
const NIGHT_FOG = new THREE.Color(0x0a0e1a);

const timeSlider = document.getElementById('timeSlider');
const timeVal = document.getElementById('timeVal');
const shaderQualitySelect = document.getElementById('shaderQuality');
const detailModelsCheck = document.getElementById('detailModelsCheck');

let shaderQuality = 'medium';

// Sonne, Lichtstärke, Nebel und Himmel anhand der Tageszeit aktualisieren
function updateSun() {
  const hour = timeSlider ? parseFloat(timeSlider.value) : 12;
  const elevation = 90 * Math.sin(((hour - 6) / 12) * Math.PI); // 6:00 0°, 12:00 90°, 18:00 0°
  const phi = THREE.MathUtils.degToRad(90 - elevation);
  const theta = THREE.MathUtils.degToRad((hour / 24) * 360 + 90);
  sunVec.setFromSphericalCoords(1, phi, theta);
  skyUniforms['sunPosition'].value.copy(sunVec);

  const center = new THREE.Vector3((bounds.minX + bounds.maxX) / 2, 0, (bounds.minZ + bounds.maxZ) / 2);
  dirLight.target.position.copy(center);
  dirLight.target.updateMatrixWorld();
  const span = Math.max(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ, bounds.maxY - bounds.minY, 1);
  const distance = span * 1.6 + 120;
  dirLight.position.copy(sunVec).multiplyScalar(distance).add(center);

  const day = THREE.MathUtils.clamp(elevation / 90, 0, 1);
  const night = THREE.MathUtils.clamp(-elevation / 30, 0, 1);
  dirLight.intensity = 0.15 + day * 2.4;
  dirLight.color.setRGB(1 - night * 0.25, 1 - night * 0.3, 1 - night * 0.1);
  ambient.intensity = 0.18 + day * 0.5;

  const skyColor = NIGHT_FOG.clone().lerp(DAY_FOG, THREE.MathUtils.clamp((elevation + 8) / 60, 0, 1));
  scene.background.copy(skyColor);

  if (timeVal) {
    timeVal.textContent = `${String(Math.floor(hour)).padStart(2, '0')}:${String(Math.round((hour % 1) * 60)).padStart(2, '0')}`;
  }
}

// Post-Processing-Kette
const composer = new EffectComposer(renderer);
composer.setPixelRatio(renderer.getPixelRatio());
composer.setSize(window.innerWidth, window.innerHeight);

composer.addPass(new RenderPass(scene, camera));

const ssaoPass = new SSAOPass(scene, camera, window.innerWidth, window.innerHeight);
ssaoPass.kernelRadius = 8;
ssaoPass.minDistance = 0.005;
ssaoPass.maxDistance = 0.1;
ssaoPass.enabled = false;
composer.addPass(ssaoPass);

const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.4, 0.5, 0.85);
composer.addPass(bloomPass);

composer.addPass(new OutputPass());

// Eigenes Farb-Grading (Sättigung, Kontrast, Vignette)
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uSaturation: { value: 1.12 },
    uContrast: { value: 1.06 },
    uVignette: { value: 0.35 }
  },
  vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: [
    'uniform sampler2D tDiffuse;',
    'uniform float uSaturation, uContrast, uVignette;',
    'varying vec2 vUv;',
    'void main() {',
    '  vec4 c = texture2D(tDiffuse, vUv);',
    '  float l = dot(c.rgb, vec3(0.299, 0.587, 0.114));',
    '  c.rgb = mix(vec3(l), c.rgb, uSaturation);',
    '  c.rgb = (c.rgb - 0.5) * uContrast + 0.5;',
    '  float d = distance(vUv, vec2(0.5));',
    '  c.rgb *= 1.0 - smoothstep(0.45, 0.85, d) * uVignette;',
    '  gl_FragColor = vec4(clamp(c.rgb, 0.0, 1.0), c.a);',
    '}'
  ].join('\n')
};
const gradePass = new ShaderPass(GradeShader);
composer.addPass(gradePass);

function applyQuality(quality) {
  shaderQuality = quality;
  const on = quality !== 'off';
  dirLight.castShadow = on;
  bloomPass.enabled = on;
  gradePass.enabled = on;
  ssaoPass.enabled = quality === 'high';
  bloomPass.strength = quality === 'high' ? 0.5 : 0.4;
}

function setDetailModels(enabled) {
  detailModels = enabled;
  geometryCache.clear();
  updateBuildingView();
}

// Weist die Punktlichter des Pools den der Kamera nächstgelegenen Fackeln zu.
let lightUpdateTimer = 0;
function updateTorchLights(delta) {
  if (shaderQuality === 'off' || emitterPositions.length === 0) {
    for (const pl of lightPool) pl.intensity = 0;
    return;
  }
  lightUpdateTimer -= delta;
  if (lightUpdateTimer > 0) return;
  lightUpdateTimer = 0.25;

  const cam = camera.position;
  const maxDistSq = 80 * 80;
  const sorted = emitterPositions
    .map((e) => ({ e, d: (e.x - cam.x) ** 2 + (e.y - cam.y) ** 2 + (e.z - cam.z) ** 2 }))
    .sort((a, b) => a.d - b.d);

  for (let i = 0; i < lightPool.length; i++) {
    const item = sorted[i];
    const pl = lightPool[i];
    if (item && item.d < maxDistSq) {
      pl.position.set(item.e.x, item.e.y, item.e.z);
      pl.color.setHex(item.e.color);
      pl.intensity = item.e.intensity;
      pl.distance = item.e.distance;
    } else {
      pl.intensity = 0;
    }
  }
}

if (timeSlider) timeSlider.addEventListener('input', updateSun);
if (shaderQualitySelect) shaderQualitySelect.addEventListener('change', () => applyQuality(shaderQualitySelect.value));
if (detailModelsCheck) detailModelsCheck.addEventListener('change', () => setDetailModels(detailModelsCheck.checked));

updateSun();
applyQuality('medium');

// --- 6. NBT & .SCHEM PARSER ---
function parseNBT(Uint8Buf) {
  const view = new DataView(Uint8Buf.buffer, Uint8Buf.byteOffset, Uint8Buf.byteLength);
  let offset = 0;

  function readString() {
    const len = view.getUint16(offset, false);
    offset += 2;
    const str = new TextDecoder('utf-8').decode(Uint8Buf.subarray(offset, offset + len));
    offset += len;
    return str;
  }

  function readPayload(type) {
    switch (type) {
      case 1: return view.getInt8(offset++);
      case 2: { const v = view.getInt16(offset, false); offset += 2; return v; }
      case 3: { const v = view.getInt32(offset, false); offset += 4; return v; }
      case 4: { const v = view.getBigInt64(offset, false); offset += 8; return v; }
      case 5: { const v = view.getFloat32(offset, false); offset += 4; return v; }
      case 6: { const v = view.getFloat64(offset, false); offset += 8; return v; }
      case 7: {
        const len = view.getInt32(offset, false); offset += 4;
        const arr = Uint8Buf.subarray(offset, offset + len); offset += len;
        return arr;
      }
      case 8: return readString();
      case 9: {
        const itemType = view.getUint8(offset++);
        const len = view.getInt32(offset, false); offset += 4;
        const list = [];
        for (let i = 0; i < len; i++) list.push(readPayload(itemType));
        return list;
      }
      case 10: {
        const obj = {};
        while (true) {
          const nextType = view.getUint8(offset++);
          if (nextType === 0) break;
          const name = readString();
          obj[name] = readPayload(nextType);
        }
        return obj;
      }
      case 11: {
        const len = view.getInt32(offset, false); offset += 4;
        const arr = [];
        for (let i = 0; i < len; i++) { arr.push(view.getInt32(offset, false)); offset += 4; }
        return arr;
      }
      case 12: {
        const len = view.getInt32(offset, false); offset += 4;
        offset += len * 8;
        return [];
      }
      default: throw new Error('Unbekannter NBT Tag: ' + type);
    }
  }

  const rootType = view.getUint8(offset++);
  if (rootType !== 10) throw new Error('Kein gültiges NBT Format');
  readString();
  return readPayload(10);
}

// Modernes Sponge-.schem: Palette + varint-kodierte BlockData.
function decodeSpongeSchematic(schem, paletteObj, blockData) {
  const width = schem.Width;
  const length = schem.Length;

  const idToBlock = {};
  for (const [blockName, id] of Object.entries(paletteObj)) {
    idToBlock[id] = blockName;
  }

  const decodedBlocks = [];
  let i = 0;
  let blockIndex = 0;
  while (i < blockData.length) {
    let value = 0;
    let varintLength = 0;
    while (true) {
      const byte = blockData[i++];
      value |= (byte & 127) << (varintLength++ * 7);
      if ((byte & 128) !== 128) break;
    }

    const blockName = idToBlock[value] || 'minecraft:air';
    if (!blockName.endsWith(':air') && blockName !== 'air' && !blockName.includes('cave_air')) {
      const y = Math.floor(blockIndex / (width * length));
      const z = Math.floor((blockIndex % (width * length)) / width);
      const x = blockIndex % width;
      decodedBlocks.push({
        x: x - Math.floor(width / 2),
        y: y,
        z: z - Math.floor(length / 2),
        type: blockName
      });
    }
    blockIndex++;
  }
  return decodedBlocks;
}

// Klassisches MCEdit/WorldEdit-.schematic-Format: Width/Height/Length (Short),
// Blocks/Data als Byte-Arrays mit numerischen Legacy-IDs, optional AddBlocks.
function decodeLegacySchematic(schem) {
  const width = schem.Width;
  const height = schem.Height;
  const length = schem.Length;
  const blocks = schem.Blocks;
  const data = schem.Data;
  const addBlocks = schem.AddBlocks;
  const total = width * height * length;

  const resolve = (typeof globalThis.resolveLegacyBlock === 'function')
    ? globalThis.resolveLegacyBlock
    : (id) => id === 0 ? 'minecraft:air' : 'minecraft:stone';

  const decodedBlocks = [];
  for (let index = 0; index < total; index++) {
    let blockId = blocks[index] & 0xFF;

    // AddBlocks speichert die oberen 4 Bit der ID (je Byte zwei Blöcke, High-Nibble zuerst).
    if (addBlocks) {
      const packed = addBlocks[index >> 1] & 0xFF;
      const high = (index % 2 === 0) ? (packed >> 4) : (packed & 0x0F);
      blockId |= high << 8;
    }

    const meta = data ? (data[index] & 0xFF) : 0;
    const blockName = resolve(blockId, meta);
    if (blockName.endsWith(':air') || blockName === 'air' || blockName.includes('cave_air')) continue;

    const y = Math.floor(index / (width * length));
    const z = Math.floor((index % (width * length)) / width);
    const x = index % width;
    decodedBlocks.push({
      x: x - Math.floor(width / 2),
      y: y,
      z: z - Math.floor(length / 2),
      type: blockName
    });
  }
  return decodedBlocks;
}

document.getElementById('fileInput').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  try {
    const arrayBuffer = await file.arrayBuffer();
    const raw = new Uint8Array(arrayBuffer);

    // Standard ist gzip-komprimiert; unkomprimierte Dateien als Fallback zulassen.
    let inflated = raw;
    try {
      inflated = window.pako.ungzip(raw);
    } catch (_) {
      inflated = raw;
    }

    const nbt = parseNBT(inflated);
    const schem = nbt.Schematic ? nbt.Schematic : nbt;

    const paletteObj = schem.Palette || (schem.Blocks && schem.Blocks.Palette);
    const blockData = schem.BlockData || (schem.Blocks && schem.Blocks.Data);
    const legacyBlocks = ArrayBuffer.isView(schem.Blocks) ? schem.Blocks : null;

    let decodedBlocks;
    if (paletteObj && blockData) {
      // Modernes Sponge-.schem: Palette + varint-kodierte BlockData
      decodedBlocks = decodeSpongeSchematic(schem, paletteObj, blockData);
    } else if (legacyBlocks && schem.Width && schem.Height && schem.Length) {
      // Klassisches .schematic: numerische Legacy-IDs
      decodedBlocks = decodeLegacySchematic(schem);
    } else {
      alert('Format nicht erkannt. Bitte nutze eine .schem oder .schematic Datei.');
      return;
    }

    setBuildingData(decodedBlocks);
  } catch (err) {
    console.error(err);
    alert('Fehler beim Laden der Datei: ' + err.message);
  }
});

// --- 7. DEMO-BURG MIT 4 ECKTÜRMEN BEIM START ---
function createDemoCastle() {
  const blocks = [];
  const added = new Set();
  function addBlock(x, y, z, type) {
    const key = `${x},${y},${z}`;
    if (!added.has(key)) {
      added.add(key);
      blocks.push({ x, y, z, type });
    }
  }

  for (let x = -10; x <= 10; x++) {
    for (let z = -10; z <= 10; z++) {
      addBlock(x, 0, z, 'cobblestone');
      if (Math.abs(x) === 7 || Math.abs(z) === 7) {
        if (Math.abs(x) <= 7 && Math.abs(z) <= 7) {
          if (z === 7 && Math.abs(x) <= 1) continue;
          for (let y = 1; y <= 5; y++) addBlock(x, y, z, 'stone_bricks');
          if ((x + z) % 2 === 0) addBlock(x, 6, z, 'stone_bricks');
        }
      }
    }
  }

  const corners = [[-7, -7], [7, -7], [-7, 7], [7, 7]];
  for (const [cx, cz] of corners) {
    for (let tx = cx - 2; tx <= cx + 2; tx++) {
      for (let tz = cz - 2; tz <= cz + 2; tz++) {
        const isWall = Math.abs(tx - cx) === 2 || Math.abs(tz - cz) === 2;
        if (isWall) {
          for (let y = 1; y <= 10; y++) {
            const isCorner = Math.abs(tx - cx) === 2 && Math.abs(tz - cz) === 2;
            const isWindow = (y === 5 || y === 8) && (tx === cx || tz === cz);
            addBlock(tx, y, tz, isCorner ? 'deepslate_bricks' : (isWindow ? 'glass' : 'stone_bricks'));
          }
        }
        addBlock(tx, 10, tz, 'spruce_planks');
        if (isWall && (tx + tz) % 2 === 0) addBlock(tx, 11, tz, 'bricks');
      }
    }
    for (let step = 0; step <= 2; step++) {
      for (let tx = cx - 2 + step; tx <= cx + 2 - step; tx++) {
        for (let tz = cz - 2 + step; tz <= cz + 2 - step; tz++) {
          addBlock(tx, 11 + step, tz, 'bricks');
        }
      }
    }
  }

  setBuildingData(blocks);
}
createDemoCastle();

// --- 8. RAYCASTER (HOVER-UMRANDUNG) & RENDER-LOOP ---
const raycaster = new THREE.Raycaster();
const hoverInfoEl = document.getElementById('hoverInfo');
const clock = new THREE.Clock();

function updateHoverHighlight() {
  raycaster.setFromCamera(mouseNDC, camera);
  const intersects = raycaster.intersectObjects(buildingGroup.children, false);

  if (intersects.length > 0) {
    const hit = intersects[0];
    const blockList = hit.object.userData.blocks;
    if (blockList && hit.instanceId !== undefined && blockList[hit.instanceId]) {
      const b = blockList[hit.instanceId];
      hoveredBlock = b;
      hoverHighlightGroup.position.set(b.x, b.y, b.z);
      hoverHighlightGroup.visible = true;

      const cleanName = b.type.replace('minecraft:', '').split('[')[0];
      hoverInfoEl.style.display = 'block';
      hoverInfoEl.innerHTML = `🎯 <b>${formatBlockName(cleanName)}</b> &nbsp;|&nbsp; X: ${b.x}, Y: ${b.y}, Z: ${b.z} &nbsp;<span style="color:#55ff55;font-size:12px;">(<b>[F]</b> = Diesen Turm isolieren)</span>`;
      return;
    }
  }

  hoveredBlock = null;
  hoverHighlightGroup.visible = false;
  hoverInfoEl.style.display = 'none';
}

function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();
  shaderTime.value = clock.getElapsedTime();

  if (controls.isLocked) {
    const moveDist = flySpeed * delta;
    if (keys.KeyW) controls.moveForward(moveDist);
    if (keys.KeyS) controls.moveForward(-moveDist);
    if (keys.KeyD) controls.moveRight(moveDist);
    if (keys.KeyA) controls.moveRight(-moveDist);
    if (keys.Space) camera.position.y += moveDist;
    if (keys.ShiftLeft) camera.position.y -= moveDist;
  }

  updateHoverHighlight();
  updateTorchLights(delta);

  if (shaderQuality === 'off') renderer.render(scene, camera);
  else composer.render();
}
animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
});