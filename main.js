import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

// Lädt die generierten Original-Texturnamen (Block-ID -> Texturdatei), falls sie
// nicht bereits über ein <script src="blocktextures.js"> im Dokument geladen sind.
if (typeof document !== 'undefined' && !globalThis.BLOCK_TEXTURES) {
  await new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'blocktextures.js';
    script.onload = resolve;
    script.onerror = resolve; // Ohne Map greift weiterhin die Heuristik.
    document.head.appendChild(script);
  });
}

// --- 1. SZENE, KAMERA & RENDERER ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
camera.position.set(18, 16, 26);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.body.appendChild(renderer.domElement);

scene.add(new THREE.AmbientLight(0xffffff, 0.78));
const dirLight = new THREE.DirectionalLight(0xffffff, 0.75);
dirLight.position.set(100, 200, 100);
scene.add(dirLight);

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

function getBlockMaterial(rawBlockName, isGhost = false) {
  const cleanName = rawBlockName.replace('minecraft:', '').split('[')[0];

  if (!materialCache.has(cleanName)) {
    const isTransparent =
      cleanName.includes('glass') || cleanName.includes('leaves') ||
      cleanName.includes('water') || cleanName.includes('ice') ||
      cleanName.includes('trapdoor') || cleanName.includes('lantern') ||
      cleanName.includes('torch') || cleanName.includes('bars');

    const texFile = resolveTextureFileName(cleanName);
    const placeholderTex = new THREE.CanvasTexture(createFallbackCanvas());
    placeholderTex.magFilter = THREE.NearestFilter;
    placeholderTex.minFilter = THREE.NearestFilter;
    placeholderTex.colorSpace = THREE.SRGBColorSpace;

    const normalMat = new THREE.MeshLambertMaterial({
      map: placeholderTex,
      transparent: isTransparent,
      opacity: cleanName.includes('glass') || cleanName.includes('water') ? 0.65 : 1.0,
      alphaTest: isTransparent ? 0.1 : 0
    });

    const ghostMat = new THREE.MeshLambertMaterial({
      map: placeholderTex,
      transparent: true,
      opacity: 0.14,
      depthWrite: false
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

const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const edgeGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.006, 1.006, 1.006));
const xrayEdgeMat = new THREE.LineBasicMaterial({ color: 0x55ff55 });

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

  for (const b of allBlocks) {
    if (b.x < bounds.minX) bounds.minX = b.x;
    if (b.x > bounds.maxX) bounds.maxX = b.x;
    if (b.y > bounds.maxY) bounds.maxY = b.y;
    if (b.z < bounds.minZ) bounds.minZ = b.z;
    if (b.z > bounds.maxZ) bounds.maxZ = b.z;

    const colKey = `${b.x},${b.z}`;
    const prevMax = columnMaxYMap.get(colKey) ?? -1;
    if (b.y > prevMax) columnMaxYMap.set(colKey, b.y);
  }

  layerSlider.max = bounds.maxY;
  layerSlider.value = bounds.maxY;

  xMinSlider.min = bounds.minX; xMinSlider.max = bounds.maxX; xMinSlider.value = bounds.minX;
  xMaxSlider.min = bounds.minX; xMaxSlider.max = bounds.maxX; xMaxSlider.value = bounds.maxX;

  zMinSlider.min = bounds.minZ; zMinSlider.max = bounds.maxZ; zMinSlider.value = bounds.minZ;
  zMaxSlider.min = bounds.minZ; zMaxSlider.max = bounds.maxZ; zMaxSlider.value = bounds.maxZ;

  updateBuildingView();
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

  const groupedVisible = new Map();
  for (const b of allBlocks) {
    if (b.x < minX || b.x > maxX || b.z < minZ || b.z > maxZ) continue;
    if (mode === 'upTo' && b.y > targetY) continue;
    if (mode === 'single' && b.y !== targetY) continue;

    const cleanName = b.type.replace('minecraft:', '').split('[')[0];
    if (!groupedVisible.has(cleanName)) groupedVisible.set(cleanName, []);
    groupedVisible.get(cleanName).push(b);
  }

  const dummy = new THREE.Object3D();
  for (const [cleanName, positions] of groupedVisible.entries()) {
    const isGhost = activeXrayBlock !== null && activeXrayBlock !== cleanName;
    const mat = getBlockMaterial(cleanName, isGhost);
    const instancedMesh = new THREE.InstancedMesh(boxGeo, mat, positions.length);
    
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

document.getElementById('fileInput').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  try {
    const arrayBuffer = await file.arrayBuffer();
    const inflated = window.pako.ungzip(new Uint8Array(arrayBuffer));
    const nbt = parseNBT(inflated);
    
    const schem = nbt.Schematic ? nbt.Schematic : nbt;
    const width = schem.Width;
    const height = schem.Height;
    const length = schem.Length;

    const paletteObj = schem.Palette || (schem.Blocks && schem.Blocks.Palette);
    const blockData = schem.BlockData || (schem.Blocks && schem.Blocks.Data);

    if (!paletteObj || !blockData) {
      alert('Format nicht erkannt. Bitte nutze eine .schem Datei.');
      return;
    }

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
  renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});