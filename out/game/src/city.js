// Builds the city of Lumen Bay: the ground, the bay water, a grid of roads with lane markings and
// crosswalks, and the raised blocks between them, each holding buildings (instanced, so the whole
// city is a handful of draw calls), neon signs on some facades, and named landmarks. Districts
// differ by block height, palette and skyline: Vesper Heights is a palm-lined mid-rise in the
// north-west, Downtown Lumen carries the tallest towers around Lumen Tower, Mirage Row is the neon
// strip in the south, Old Harbour is low warehouses on the bay. The grid stops east of the bay, so
// the water reads as a coast. Every solid building is also an axis-aligned box collider
// (result.colliders), which the player, cars and police are pushed out of.

import * as THREE from '../vendor/three.js';
import { COLORS, WORLD } from './config.js';
import { randInt, randRange } from './random.js';

const { cell, block, grid, half } = WORLD;
const road = cell - block; // the street width between two blocks
const sidewalk = 4; // the walkway ring inside each block's edge

/** East of this x the grid ends and the bay begins. */
export const WATER_X = 168;

/** Named places the minimap and missions point at. */
export const LANDMARKS = [
  { name: 'Vesper Tower', x: -180, z: -180, color: '#ff3d8b' },
  { name: 'Lumen Tower', x: 30, z: -90, color: '#22e1ff' },
  { name: 'Cathedral', x: -150, z: 30, color: '#ffc93d' },
  { name: 'Mirage Casino', x: -30, z: 150, color: '#b14cff' },
  { name: 'Harbour Cranes', x: 120, z: 150, color: '#ff6a2a' },
  { name: 'Orbit Wheel', x: 120, z: -30, color: '#7cff4f' },
];

/** Which district a world point falls in, for the HUD and mission text. */
export function districtAt(x, z) {
  if (x > WATER_X - 12) return 'The Bay';
  if (x < -90 && z < -90) return 'Vesper Heights';
  if (x >= -90 && x < 90 && z < 30) return 'Downtown Lumen';
  if (z >= 90 && x < 90) return 'Mirage Row';
  if (x >= 90) return 'Old Harbour';
  return 'Lumen Bay';
}

function makeWindowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, 128, 256);
  const cols = 8;
  const rows = 16;
  const w = 128 / cols;
  const h = 256 / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const roll = (r * 31 + c * 17) % 11;
      if (roll < 2) continue; // a dark window
      ctx.fillStyle = roll < 7 ? '#ffd9a0' : roll < 9 ? '#9fd8ff' : '#fff3e0';
      ctx.fillRect(c * w + w * 0.25, r * h + h * 0.3, w * 0.5, h * 0.4);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeSignTexture(word, colorHex) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, 256, 64);
  ctx.font = 'bold 42px Impact, Arial Black, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = colorHex;
  ctx.shadowBlur = 22;
  ctx.fillStyle = colorHex;
  ctx.fillText(word, 128, 34);
  ctx.fillStyle = '#ffffff';
  ctx.shadowBlur = 6;
  ctx.fillText(word, 128, 34);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const SIGN_WORDS = ['VESPER', 'LUMEN', 'MIRAGE', 'CASINO', 'HARBOUR', 'ORBIT', 'NEON', 'BAY', 'PALMS', 'CLUB 9', 'DINER', 'MOTEL'];
const FACADES = [0x2a2440, 0x33284a, 0x243044, 0x3a2f4a, 0x2c3440, 0x402c48];

export function createCity(scene, rng) {
  const colliders = [];
  const cityGroup = new THREE.Group();
  scene.add(cityGroup);

  // --- ground: asphalt west of the bay ---
  const groundWidth = WATER_X + half;
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(groundWidth, half * 2),
    new THREE.MeshStandardMaterial({ color: COLORS.asphalt, roughness: 0.95 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set((WATER_X - half) / 2, 0, 0);
  cityGroup.add(ground);

  // --- bay water east of the city ---
  const waterWidth = half * 2 - WATER_X;
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(waterWidth, half * 2),
    new THREE.MeshStandardMaterial({ color: COLORS.water, roughness: 0.1, metalness: 0.8 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(WATER_X + waterWidth / 2, -0.3, 0);
  cityGroup.add(water);

  // --- sidewalks: a raised ring at the edge of every block (instanced) ---
  const blockCenters = [];
  for (let ix = 0; ix < grid; ix++) {
    for (let iz = 0; iz < grid; iz++) {
      const bx = -half + block / 2 + ix * cell;
      const bz = -half + block / 2 + iz * cell;
      blockCenters.push({ bx, bz, ix, iz });
    }
  }
  const slabGeo = new THREE.BoxGeometry(block, 0.3, block);
  const slabMat = new THREE.MeshStandardMaterial({ color: COLORS.sidewalk, roughness: 0.85 });
  const slabs = new THREE.InstancedMesh(slabGeo, slabMat, blockCenters.length);
  const matrix = new THREE.Matrix4();
  const color = new THREE.Color();
  let slabCount = 0;

  // --- buildings (instanced with a lit-window texture) and neon signs ---
  const windowTex = makeWindowTexture();
  const buildingMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.7,
    metalness: 0.15,
    map: windowTex,
    emissive: 0xffffff,
    emissiveMap: windowTex,
    emissiveIntensity: 1.1,
  });
  const buildingGeo = new THREE.BoxGeometry(1, 1, 1);
  const maxBuildings = blockCenters.length * 4;
  const buildings = new THREE.InstancedMesh(buildingGeo, buildingMat, maxBuildings);
  const beaconGeo = new THREE.SphereGeometry(0.6, 8, 6);
  const beacons = new THREE.InstancedMesh(beaconGeo, new THREE.MeshBasicMaterial({ color: 0xff2244 }), maxBuildings);
  let buildingCount = 0;
  let beaconCount = 0;

  for (const { bx, bz, ix, iz } of blockCenters) {
    const cx = bx + block / 2;
    if (cx > WATER_X) continue; // this block is in the bay
    matrix.makeTranslation(bx, 0.15, bz);
    slabs.setMatrixAt(slabCount++, matrix);

    const district = districtAt(bx, bz);
    // height by district: Downtown tallest, Harbour low warehouses, Heights mid-rise
    let hMin = 9;
    let hMax = 22;
    if (district === 'Downtown Lumen') { hMin = 30; hMax = 82; }
    else if (district === 'Vesper Heights') { hMin = 14; hMax = 36; }
    else if (district === 'Mirage Row') { hMin = 16; hMax = 44; }
    else if (district === 'Old Harbour') { hMin = 7; hMax = 17; }

    // subdivide the block footprint into up to 2x2 lots, leaving the sidewalk ring
    const across = randInt(rng, 1, 2);
    const down = randInt(rng, 1, 2);
    const inner = block - sidewalk * 2;
    const lotW = inner / across;
    const lotD = inner / down;
    for (let a = 0; a < across; a++) {
      for (let d = 0; d < down; d++) {
        if (rng() < 0.1) continue; // an empty lot / alley
        const w = lotW - randRange(rng, 1.5, 4);
        const dep = lotD - randRange(rng, 1.5, 4);
        const h = randRange(rng, hMin, hMax);
        const x = bx - block / 2 + sidewalk + lotW * a + lotW / 2;
        const z = bz - block / 2 + sidewalk + lotD * d + lotD / 2;
        matrix.makeScale(w, h, dep);
        matrix.setPosition(x, h / 2 + 0.3, z);
        buildings.setMatrixAt(buildingCount, matrix);
        color.setHex(FACADES[randInt(rng, 0, FACADES.length - 1)]);
        color.offsetHSL(randRange(rng, -0.02, 0.02), 0, randRange(rng, -0.03, 0.05));
        buildings.setColorAt(buildingCount, color);
        buildingCount++;
        colliders.push({ x, z, hx: w / 2, hz: dep / 2, top: h });
        if (h > 48 && rng() < 0.5) {
          matrix.makeTranslation(x, h + 0.9, z);
          beacons.setMatrixAt(beaconCount++, matrix);
        }
        // a neon sign facing the street on some mid+ buildings
        if (h >= 14 && rng() < 0.4) {
          const word = SIGN_WORDS[randInt(rng, 0, SIGN_WORDS.length - 1)];
          const neonColor = '#' + COLORS.neon[randInt(rng, 0, COLORS.neon.length - 1)].toString(16).padStart(6, '0');
          const mat = new THREE.MeshBasicMaterial({ map: makeSignTexture(word, neonColor), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
          const signW = Math.min(w * 0.9, 12);
          const sign = new THREE.Mesh(new THREE.PlaneGeometry(signW, signW / 4), mat);
          sign.position.set(x, randRange(rng, h * 0.5, h * 0.85), z + dep / 2 + 0.12);
          cityGroup.add(sign);
        }
      }
    }
  }
  slabs.count = slabCount;
  buildings.count = buildingCount;
  beacons.count = beaconCount;
  slabs.instanceMatrix.needsUpdate = true;
  buildings.instanceMatrix.needsUpdate = true;
  beacons.instanceMatrix.needsUpdate = true;
  cityGroup.add(slabs);
  cityGroup.add(buildings);
  cityGroup.add(beacons);

  // --- landmarks: distinct structures so the skyline reads and missions have targets ---
  for (const landmark of LANDMARKS) {
    const { x, z, name } = landmark;
    const towerColor = new THREE.Color(landmark.color);
    if (name === 'Lumen Tower') {
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(6, 9, 95, 8), new THREE.MeshStandardMaterial({ color: 0x1e2a44, emissive: 0x22e1ff, emissiveIntensity: 0.4, roughness: 0.3, metalness: 0.7 }));
      tower.position.set(x, 47.5, z);
      cityGroup.add(tower);
      const spire = new THREE.Mesh(new THREE.ConeGeometry(3, 22, 8), new THREE.MeshStandardMaterial({ color: 0x22e1ff, emissive: 0x22e1ff, emissiveIntensity: 1.6 }));
      spire.position.set(x, 106, z);
      cityGroup.add(spire);
      colliders.push({ x, z, hx: 9, hz: 9, top: 95 });
    } else if (name === 'Orbit Wheel') {
      const wheel = new THREE.Group();
      wheel.add(new THREE.Mesh(new THREE.TorusGeometry(18, 0.7, 8, 48), new THREE.MeshBasicMaterial({ color: 0x7cff4f })));
      for (let i = 0; i < 12; i++) {
        const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 36, 4), new THREE.MeshBasicMaterial({ color: 0x22e1ff }));
        spoke.rotation.z = (i / 12) * Math.PI;
        wheel.add(spoke);
      }
      wheel.position.set(x, 24, z);
      cityGroup.add(wheel);
      const base = new THREE.Mesh(new THREE.BoxGeometry(6, 10, 6), new THREE.MeshStandardMaterial({ color: 0x333344 }));
      base.position.set(x, 3, z);
      cityGroup.add(base);
      colliders.push({ x, z, hx: 4, hz: 4, top: 10 });
    } else if (name === 'Harbour Cranes') {
      const craneMat = new THREE.MeshStandardMaterial({ color: 0xff6a2a, roughness: 0.6, metalness: 0.4 });
      for (let i = 0; i < 3; i++) {
        const crane = new THREE.Group();
        for (const [lx, lz] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) {
          const leg = new THREE.Mesh(new THREE.BoxGeometry(0.8, 28, 0.8), craneMat);
          leg.position.set(lx, 14, lz);
          crane.add(leg);
        }
        const boom = new THREE.Mesh(new THREE.BoxGeometry(26, 1.2, 1.2), craneMat);
        boom.position.set(8, 27, 0);
        crane.add(boom);
        crane.position.set(x + i * 12, 0, z);
        cityGroup.add(crane);
      }
      colliders.push({ x: x + 12, z, hx: 8, hz: 8, top: 28 });
    } else {
      const h = name === 'Vesper Tower' ? 60 : 34;
      const tower = new THREE.Mesh(new THREE.BoxGeometry(16, h, 16), new THREE.MeshStandardMaterial({ color: 0x2a2440, emissive: towerColor, emissiveIntensity: 0.45, roughness: 0.4, metalness: 0.5 }));
      tower.position.set(x, h / 2, z);
      cityGroup.add(tower);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(9, 10, 4), new THREE.MeshBasicMaterial({ color: towerColor }));
      cap.position.set(x, h + 5, z);
      cityGroup.add(cap);
      colliders.push({ x, z, hx: 8, hz: 8, top: h });
    }
  }

  // --- lane markings and crosswalks: dashed centre lines, white crosswalk stripes at junctions ---
  const markings = new THREE.Group();
  cityGroup.add(markings);
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xf0e6c8 });
  const crossMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 });
  // road centre lines sit between blocks: at -half + block + road/2 + k*cell
  const roadCoords = [];
  for (let k = 0; k <= grid; k++) roadCoords.push(-half + block + road / 2 + (k - 1) * cell);
  for (const r of roadCoords) {
    for (let t = -half + 3; t < Math.min(half, WATER_X) - 3; t += 9) {
      const dashV = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 4), lineMat);
      dashV.rotation.x = -Math.PI / 2;
      dashV.position.set(r, 0.02, t);
      markings.add(dashV);
      const dashH = new THREE.Mesh(new THREE.PlaneGeometry(4, 0.35), lineMat);
      dashH.rotation.x = -Math.PI / 2;
      dashH.position.set(t, 0.02, r);
      markings.add(dashH);
    }
  }
  for (const rx of roadCoords) {
    for (const rz of roadCoords) {
      if (rx > WATER_X) continue;
      for (let s = -2; s <= 2; s++) {
        const a = new THREE.Mesh(new THREE.PlaneGeometry(1.1, road * 0.6), crossMat);
        a.rotation.x = -Math.PI / 2;
        a.position.set(rx + s * 2.4, 0.03, rz);
        markings.add(a);
        const b = new THREE.Mesh(new THREE.PlaneGeometry(road * 0.6, 1.1), crossMat);
        b.rotation.x = -Math.PI / 2;
        b.position.set(rx, 0.03, rz + s * 2.4);
        markings.add(b);
      }
    }
  }

  return { colliders, group: cityGroup, landmarks: LANDMARKS, districtAt, roadCoords };
}
