// The three.js scene: renderer, camera, the dusk sky, lights, fog and the two cameras (a third-
// person chase behind the player and a free orbit for the title/shot screens), plus the rotating
// minimap drawn to its own small canvas. Owns nothing about game rules — game.js drives it.

import * as THREE from '../vendor/three.js';
import { COLORS, WORLD } from './config.js';

const half = WORLD.half;

function makeSky() {
  // A large sphere with a vertical gradient shader: indigo zenith, violet mid, orange dusk horizon.
  const geometry = new THREE.SphereGeometry(900, 32, 16);
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      top: { value: new THREE.Color(COLORS.skyTop) },
      mid: { value: new THREE.Color(COLORS.skyMid) },
      horizon: { value: new THREE.Color(COLORS.skyHorizon) },
    },
    vertexShader: `
      varying vec3 vPosition;
      void main() {
        vPosition = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 top; uniform vec3 mid; uniform vec3 horizon;
      varying vec3 vPosition;
      void main() {
        float h = normalize(vPosition).y;
        vec3 color = mix(horizon, mid, smoothstep(-0.05, 0.25, h));
        color = mix(color, top, smoothstep(0.25, 0.8, h));
        gl_FragColor = vec4(color, 1.0);
      }
    `,
  });
  return new THREE.Mesh(geometry, material);
}

export function createRenderer(canvas, minimapCanvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(COLORS.fog, 0.0032);
  scene.add(makeSky());

  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.3, 2000);
  camera.position.set(0, 30, 60);
  camera.lookAt(0, 0, 0);

  // lights: a low warm sun (the dusk), a cool hemisphere fill, and a shadow-casting directional
  const hemi = new THREE.HemisphereLight(COLORS.hemiSky, COLORS.hemiGround, 0.85);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(COLORS.sun, 1.6);
  sun.position.set(-120, 70, -160);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -160;
  sun.shadow.camera.right = 160;
  sun.shadow.camera.top = 160;
  sun.shadow.camera.bottom = -160;
  sun.shadow.camera.far = 500;
  sun.shadow.bias = -0.0006;
  scene.add(sun);
  const ambient = new THREE.AmbientLight(0x2a1a3a, 0.5);
  scene.add(ambient);

  // the camera rig: yaw/pitch around a target the game moves each frame
  const rig = { yaw: 0, pitch: 0.32, distance: 9, target: new THREE.Vector3(), mode: 'chase' };

  function resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  /** Point the rig at a target with a yaw/pitch/distance; used by the chase camera and shots. */
  function setChase(target, yaw, pitch, distance) {
    rig.mode = 'chase';
    rig.target.copy(target);
    rig.yaw = yaw;
    rig.pitch = pitch;
    rig.distance = distance;
  }

  /** A slow orbit around the city for the title screen. */
  function setOrbit(center, radius, angle) {
    rig.mode = 'orbit';
    rig.target.copy(center);
    rig.distance = radius;
    rig.yaw = angle;
    rig.pitch = 0.55;
  }

  function applyCamera() {
    const horizontal = Math.cos(rig.pitch) * rig.distance;
    const vertical = Math.sin(rig.pitch) * rig.distance;
    camera.position.set(
      rig.target.x + Math.sin(rig.yaw) * horizontal,
      rig.target.y + vertical,
      rig.target.z + Math.cos(rig.yaw) * horizontal,
    );
    camera.lookAt(rig.target);
  }

  // --- minimap: top-down roads, buildings, water, the player arrow and objective marker ---
  const mapCtx = minimapCanvas.getContext('2d');
  const MAP_SIZE = 180; // canvas pixels
  const MAP_RANGE = 170; // world units across the map
  function drawMinimap(state) {
    const ctx = mapCtx;
    const scale = MAP_SIZE / MAP_RANGE;
    const cx = MAP_SIZE / 2;
    const cy = MAP_SIZE / 2;
    ctx.clearRect(0, 0, MAP_SIZE, MAP_SIZE);
    ctx.fillStyle = '#0d1020';
    ctx.fillRect(0, 0, MAP_SIZE, MAP_SIZE);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(state.heading); // north-up rotates with the player
    const px = state.x;
    const pz = state.z;
    const toMap = (wx, wz) => [(wx - px) * scale, (wz - pz) * scale];
    // water east of the city (WATER_X from city.js, inlined to keep this module rule-free)
    ctx.fillStyle = '#0b1a33';
    const [wx1, wz1] = toMap(168, -half);
    const [wx2, wz2] = toMap(half, half);
    ctx.fillRect(wx1, wz1, (wx2 - wx1), (wz2 - wz1));
    // buildings (light blocks) — approximate from colliders
    ctx.fillStyle = '#2a2f45';
    for (const c of state.cityColliders) {
      const [mx, mz] = toMap(c.x - c.hx, c.z - c.hz);
      const size = Math.max(1, c.hx * 2 * scale);
      if (Math.abs(c.x - px) > MAP_RANGE || Math.abs(c.z - pz) > MAP_RANGE) continue;
      ctx.fillRect(mx, mz, Math.max(1, c.hx * 2 * scale), Math.max(1, c.hz * 2 * scale));
    }
    // objective marker
    if (state.objective) {
      const [ox, oz] = toMap(state.objective.x, state.objective.z);
      ctx.fillStyle = '#ffd93d';
      ctx.beginPath();
      ctx.arc(ox, oz, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    // traffic dots
    ctx.fillStyle = '#7fd0ff';
    for (const car of state.traffic ?? []) {
      const [tx, tz] = toMap(car.x, car.z);
      if (Math.abs(car.x - px) > MAP_RANGE || Math.abs(car.z - pz) > MAP_RANGE) continue;
      ctx.fillRect(tx - 1.5, tz - 1.5, 3, 3);
    }
    // police dots
    ctx.fillStyle = '#ff3355';
    for (const car of state.police ?? []) {
      const [tx, tz] = toMap(car.x, car.z);
      if (Math.abs(car.x - px) > MAP_RANGE || Math.abs(car.z - pz) > MAP_RANGE) continue;
      ctx.fillRect(tx - 2, tz - 2, 4, 4);
    }
    ctx.restore();
    // player arrow at the centre (always points up on the map)
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(cx, cy - 6);
    ctx.lineTo(cx - 4, cy + 5);
    ctx.lineTo(cx + 4, cy + 5);
    ctx.closePath();
    ctx.fill();
    // ring
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, MAP_SIZE - 2, MAP_SIZE - 2);
  }

  function render() {
    applyCamera();
    renderer.render(scene, camera);
  }

  return { renderer, scene, camera, sun, hemi, setChase, setOrbit, drawMinimap, render, resize, rig };
}
