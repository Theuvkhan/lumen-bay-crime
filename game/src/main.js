// Boot and the one loop for LUMEN BAY. The renderer paints the city, the world advances in fixed
// 1/60 s steps (several in a slow frame, none in a fast one), and the game moves between four
// screens: title, play, paused and game over. The HUD is DOM over the canvas; the minimap is its own
// small canvas.
//
// ?shot=start|play|end (with &seed=N) plays the real game forward from a fresh world through a
// deterministic autopilot (shots.js) instead of reading input, paints it and sets window.__shotReady
// for a screenshot. Same seed, same frame.

import { STEP, SAVE_KEY } from './config.js';
import { createRandom } from './random.js';
import { createCity, districtAt } from './city.js';
import { createRenderer } from './render.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createHUD } from './hud.js';
import { createPlayer, createVehicle, createPedestrian, SHIRTS } from './entities.js';
import { createPlayerState, updatePlayer, collideCircle } from './player.js';
import { createVehicleState, driveVehicle, separateCars, updateTraffic, spawnTrafficCar } from './vehicles.js';
import { createPedestrianState, updatePedestrian, createPoliceState, updatePolice, starsForHeat } from './npcs.js';
import { MISSIONS, createMissionState, markerFor, objectiveText, updateMission } from './missions.js';
import { stageShot } from './shots.js';
import * as THREE from '../vendor/three.js';

const MAX_FRAME = 0.25;
const LIMIT = 244;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 20261124;
const rng = createRandom(seed);

// ------------------------------------------------------------------ build the world
const canvas = document.getElementById('game');
const minimapCanvas = document.getElementById('minimap');
const view = createRenderer(canvas, minimapCanvas);
const city = createCity(view.scene, rng);
const audio = createAudio();
const input = createInput(canvas);
const hud = createHUD();

const playerMesh = createPlayer();
view.scene.add(playerMesh);
const playerState = createPlayerState();

/** Parked and traffic cars: { state, mesh, isTraffic }. */
const vehicles = [];
const police = []; // police states
const policeMeshes = [];
const pedestrians = []; // pedestrian states
const pedestrianMeshes = [];

let driven = null; // the vehicle state the player is in, or null on foot
let drivenMesh = null;

const missionState = createMissionState();

let camYaw = 0;
let camPitch = 0.3;
let camDist = 9;

let health = 100;
let money = 250;
let heat = 0;
let evadeTimer = 0;
let screen = 'title';
let paused = false;
let muted = false;

const hudState = {
  health: 100, money: 250, wanted: 0, objective: '', inCar: false,
  vehicleName: '', speed: 0, vehicleHealth: 100, district: '',
};

// ------------------------------------------------------------------ spawning
function spawnParked(kind, x, z, angle) {
  const state = createVehicleState(kind, x, z, angle);
  const mesh = createVehicle(kind);
  mesh.position.set(x, 0, z);
  mesh.rotation.y = angle;
  view.scene.add(mesh);
  const record = { state, mesh, isTraffic: false };
  vehicles.push(record);
  return record;
}

function parkCars() {
  const kinds = ['compact', 'sedan', 'sport', 'truck', 'sedan', 'sport', 'compact', 'truck'];
  const coords = city.roadCoords;
  for (let i = 0; i < 44; i++) {
    const lane = coords[i % coords.length];
    const along = -230 + ((i * 37) % 440);
    const horizontal = i % 2 === 0;
    const kind = kinds[i % kinds.length];
    // park at the road edge, not the centre line
    const x = horizontal ? along : lane + 3.4;
    const z = horizontal ? lane - 3.4 : along;
    if (x > 150) continue; // keep out of the bay
    spawnParked(kind, x, z, horizontal ? Math.PI / 2 : 0);
  }
}

function spawnTrafficAndPeople() {
  const kinds = ['sedan', 'compact', 'truck', 'sport'];
  for (let i = 0; i < 24; i++) {
    const car = spawnTrafficCar(kinds[i % kinds.length], rng, city.roadCoords);
    if (car.x > 150) continue;
    const mesh = createVehicle(car.kind);
    mesh.position.set(car.x, 0, car.z);
    view.scene.add(mesh);
    vehicles.push({ state: car, mesh, isTraffic: true });
  }
  for (let i = 0; i < 44; i++) {
    const x = -220 + rng() * 340;
    const z = -220 + rng() * 440;
    const shirt = SHIRTS[i % SHIRTS.length];
    const state = createPedestrianState(x, z, rng);
    const mesh = createPedestrian(shirt);
    mesh.position.set(x, 0, z);
    view.scene.add(mesh);
    pedestrians.push(state);
    pedestrianMeshes.push(mesh);
  }
}

function spawnPolice(nearX, nearZ) {
  const mesh = createVehicle('police');
  view.scene.add(mesh);
  const angle = rng() * Math.PI * 2;
  const state = createPoliceState(nearX + Math.cos(angle) * 45, nearZ + Math.sin(angle) * 45, angle);
  state.spec = { name: 'Bay Patrol Cruiser', top: 40, accel: 18, brake: 24, turn: 2.0 };
  mesh.position.set(state.x, 0, state.z);
  mesh.rotation.y = state.angle;
  police.push(state);
  policeMeshes.push(mesh);
  return state;
}

function removePolice(state) {
  const index = police.indexOf(state);
  if (index >= 0) {
    police.splice(index, 1);
    const mesh = policeMeshes.splice(index, 1)[0];
    view.scene.remove(mesh);
  }
}

// ------------------------------------------------------------------ save / continue
function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeSave() {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      x: playerState.x, z: playerState.z, health, money, heat,
      missionIndex: missionState.index, completed: missionState.complete,
    }));
  } catch {
    // storage off (private window): the save lasts this visit only
  }
}

// ------------------------------------------------------------------ game flow
function startNew() {
  playerState.x = -60;
  playerState.z = -60;
  health = 100;
  money = 250;
  heat = 0;
  evadeTimer = 0;
  missionState.index = 0;
  missionState.step = 0;
  missionState.active = false;
  missionState.complete = [];
  missionState.completedAll = false;
  missionState.holdTimer = 0;
  driven = null;
  drivenMesh = null;
  for (const cop of [...police]) removePolice(cop);
  screen = 'play';
  paused = false;
  hud.setScreen('');
  hud.showControls(false);
  hud.renderMissions(MISSIONS, 0, []);
  input.clear();
  audio.unlock();
  camYaw = 0;
  hud.notify('Welcome to Lumen Bay. Find a car and start the Vesper contracts.');
}

function continueGame() {
  const save = readSave();
  if (!save) return startNew();
  playerState.x = save.x;
  playerState.z = save.z;
  health = save.health ?? 100;
  money = save.money ?? 250;
  heat = save.heat ?? 0;
  missionState.index = save.missionIndex ?? 0;
  missionState.complete = save.completed ?? [];
  missionState.active = false;
  missionState.completedAll = missionState.complete.length >= MISSIONS.length;
  screen = 'play';
  paused = false;
  hud.setScreen('');
  hud.showControls(false);
  hud.renderMissions(MISSIONS, missionState.index, missionState.complete);
  input.clear();
  audio.unlock();
  hud.notify('Save loaded. Back on the streets.');
}

function gameOver(reason) {
  screen = 'over';
  hud.setScreen('over');
  hud.setOverStats(money, reason);
  audio.sirenOn(false);
  audio.engineUpdate(0, 1, false);
}

function pauseGame(on) {
  if (screen !== 'play' && screen !== 'paused') return;
  paused = on;
  screen = on ? 'paused' : 'play';
  hud.setScreen(on ? 'paused' : '');
  audio.sirenOn(false);
  audio.engineUpdate(0, 1, false);
}

// ------------------------------------------------------------------ crime / heat
function commitCrime(amount, atX, atZ) {
  heat += amount;
  evadeTimer = 0;
  const wanted = starsForHeat(heat);
  const target = Math.min(5, Math.max(1, wanted));
  while (police.length < target) spawnPolice(atX, atZ);
  for (const ped of pedestrians) {
    if (Math.hypot(ped.x - atX, ped.z - atZ) < 26) ped.fleeing = true;
  }
}

// ------------------------------------------------------------------ enter / exit vehicles
function tryEnterVehicle() {
  if (driven) {
    driven.speed *= 0.2;
    const side = driven.angle + Math.PI / 2;
    const out = { x: driven.x + Math.cos(side) * 2.6, z: driven.z - Math.sin(side) * 2.6 };
    const fixed = collideCircle(out.x, out.z, 0.5, city.colliders);
    playerState.x = Math.max(-LIMIT, Math.min(LIMIT, fixed.x));
    playerState.z = Math.max(-LIMIT, Math.min(LIMIT, fixed.z));
    driven = null;
    drivenMesh = null;
    hud.notify('Left the vehicle.');
    return;
  }
  let best = null;
  let bestDist = 4.4;
  for (const v of vehicles) {
    const dist = Math.hypot(v.state.x - playerState.x, v.state.z - playerState.z);
    if (dist < bestDist) {
      bestDist = dist;
      best = v;
    }
  }
  if (!best) return;
  driven = best.state;
  drivenMesh = best.mesh;
  best.isTraffic = false;
  hud.notify(`Stole a ${best.state.spec.name}.`);
  commitCrime(12, best.state.x, best.state.z);
}

// ------------------------------------------------------------------ the fixed step
// `input` is either a live input object (moveX/moveZ/throttle/steer/sprint/brake) or an autopilot one
// from shots.js with the same shape. It runs one 1/60 s step of the whole world.
function stepFixed(input) {
  const dt = STEP;
  const target = driven ?? playerState;

  // on foot
  if (!driven) {
    updatePlayer(playerState, input.moveX ?? 0, input.moveZ ?? 0, input.sprint ?? false, camYaw, city.colliders, dt);
  }
  // driving
  if (driven) {
    driveVehicle(driven, input.throttle ?? 0, input.steer ?? 0, input.brake ?? false, dt, city.colliders);
    if (drivenMesh) {
      drivenMesh.position.set(driven.x, 0, driven.z);
      drivenMesh.rotation.y = driven.angle;
    }
    // running people down is a crime
    for (const ped of pedestrians) {
      if (Math.hypot(ped.x - driven.x, ped.z - driven.z) < 2.4 && Math.abs(driven.speed) > 8) {
        commitCrime(20, driven.x, driven.z);
        audio.crash();
      }
    }
    // a wrecked car strands the player on foot; in a shot, keep the stunt car alive so the frame
    // always shows the driving scene — the floor runs before the contact damage below
    if (driven && shot) driven.health = Math.max(driven.health, 40);
    // contact with a cruiser grinds both down
    for (const cop of police) {
      if (Math.hypot(cop.x - driven.x, cop.z - driven.z) < 3.6) {
        health -= 30 * dt;
        driven.health -= 40 * dt;
      }
    }
    if (driven.health <= 0) {
      hud.notify(`${driven.spec.name} is wrecked.`);
      driven = null;
      drivenMesh = null;
    }
  }
  // traffic
  const states = vehicles.map((v) => v.state);
  for (const v of vehicles) {
    if (!v.isTraffic) continue;
    updateTraffic(v.state, target, states, city.colliders, dt);
    v.mesh.position.set(v.state.x, 0, v.state.z);
    v.mesh.rotation.y = v.state.angle;
  }
  // keep cars from overlapping
  for (const v of vehicles) {
    if (driven && v.state !== driven) separateCars(driven, v.state);
  }
  // pedestrians
  const threats = [];
  if (driven && Math.abs(driven.speed) > 6) threats.push({ x: driven.x, z: driven.z });
  for (let i = 0; i < pedestrians.length; i++) {
    const ped = pedestrians[i];
    updatePedestrian(ped, threats, city.colliders, dt, rng);
    const mesh = pedestrianMeshes[i];
    mesh.position.set(ped.x, 0, ped.z);
    mesh.rotation.y = ped.heading;
    // a simple walk cycle: swing the legs
    if (mesh.children[0]) mesh.children[0].rotation.x = Math.sin(ped.anim) * 0.4;
  }
  // police pursuit
  for (const cop of police) {
    updatePolice(cop, target, city.colliders, dt);
  }
  for (let i = 0; i < police.length; i++) {
    policeMeshes[i].position.set(police[i].x, 0, police[i].z);
    policeMeshes[i].rotation.y = police[i].angle;
  }
  const wanted = starsForHeat(heat);
  audio.sirenOn(police.length > 0 && screen === 'play');
  // heat decays when the player stays out of sight
  if (police.length > 0) {
    const visible = police.some((cop) => Math.hypot(cop.x - target.x, cop.z - target.z) < 42);
    if (!visible) {
      evadeTimer += dt;
      if (evadeTimer > 3) {
        heat = Math.max(0, heat - 28 * dt);
        if (heat < 20) {
          for (const cop of [...police]) removePolice(cop);
          evadeTimer = 0;
          hud.notify('Lost the Bay Patrol.');
        }
      }
    } else evadeTimer = 0;
  } else if (heat > 0) {
    heat = Math.max(0, heat - 6 * dt);
  }
  // contracts
  const marker = markerFor(missionState, city.landmarks);
  if (marker) {
    const dist = Math.hypot(marker.x - target.x, marker.z - target.z);
    const event = updateMission(missionState, dist, starsForHeat(heat), dt);
    if (event === 'complete') {
      const mission = MISSIONS[missionState.complete.length - 1];
      money += mission.reward;
      audio.complete();
      hud.notify(`Contract complete: ${mission.title}. +$${mission.reward}`);
      hud.renderMissions(MISSIONS, missionState.index, missionState.complete);
      writeSave();
    } else if (event === 'advanced') {
      hud.notify('Objective complete.');
    }
  } else if (!missionState.active && !missionState.completedAll && screen === 'play' && driven) {
    missionState.active = true;
    hud.notify(`New contract: ${MISSIONS[missionState.index].title}`);
  }
  // health and game over
  health = Math.min(100, health + (screen === 'play' ? 0 : 0));
  if (health <= 0 && !shot) gameOver('You were taken down by the Bay Patrol.');
  sanitizeWorld();
  return { over: screen === 'over' };
}

/**
 * A degenerate frame (a car squeezed between two colliders, an exact overlap) can turn a position
 * into NaN, and separateCars would then spread it to every car it touches. Guard the whole world
 * once a step: restore any non-finite position to the entity's last good spot and clear bad
 * velocity, so one bad frame can never poison the camera or the rest of the traffic.
 */
function sanitizeWorld() {
  const restore = (entity) => {
    if (!Number.isFinite(entity.x)) entity.x = Number.isFinite(entity.gx) ? entity.gx : 0;
    if (!Number.isFinite(entity.z)) entity.z = Number.isFinite(entity.gz) ? entity.gz : 0;
    if (Number.isFinite(entity.x)) {
      entity.gx = entity.x;
      entity.gz = entity.z;
    }
    if (entity.angle !== undefined && !Number.isFinite(entity.angle)) entity.angle = 0;
    if (entity.speed !== undefined && !Number.isFinite(entity.speed)) entity.speed = 0;
    if (entity.health !== undefined) entity.health = Math.max(0, Math.min(100, entity.health));
  };
  for (const v of vehicles) restore(v.state);
  for (const cop of police) restore(cop);
  for (const ped of pedestrians) restore(ped);
}

// ------------------------------------------------------------------ input for a frame
function readInput() {
  return {
    moveX: (input.key('KeyD') ? 1 : 0) - (input.key('KeyA') ? 1 : 0),
    moveZ: (input.key('KeyW') ? 1 : 0) - (input.key('KeyS') ? 1 : 0),
    sprint: input.key('ShiftLeft') || input.key('ShiftRight'),
    throttle: input.key('KeyW') ? 1 : input.key('KeyS') ? -1 : 0,
    steer: (input.key('KeyD') ? 1 : 0) - (input.key('KeyA') ? 1 : 0),
    brake: input.key('Space'),
  };
}

function handleActions() {
  if (input.take('confirm')) {
    if (screen === 'title') startNew();
    else if (screen === 'over') startNew();
  }
  if (input.take('pause')) {
    if (screen === 'play') pauseGame(true);
    else if (screen === 'paused') pauseGame(false);
  }
  if (screen !== 'play') return;
  if (input.take('enter')) tryEnterVehicle();
  if (input.take('mute')) {
    muted = !muted;
    audio.setMute(muted);
    hud.setMute(muted);
    hud.notify(muted ? 'Muted.' : 'Sound on.');
  }
  if (input.take('missions')) hud.toggleMissions();
  for (let i = 0; i < MISSIONS.length; i++) {
    if (!input.take(`mission${i + 1}`)) continue;
    if (missionState.complete.includes(MISSIONS[i].id)) continue;
    missionState.index = i;
    missionState.step = 0;
    missionState.active = true;
    missionState.holdTimer = 0;
    hud.notify(`Started "${MISSIONS[i].title}" for ${MISSIONS[i].giver}.`);
    hud.renderMissions(MISSIONS, missionState.index, missionState.complete);
  }
}

function updateCamera(dt) {
  const mouse = input.mouse();
  camYaw -= mouse.x * 0.0025;
  camPitch = Math.max(0.08, Math.min(1.05, camPitch + mouse.y * 0.002));
  const heading = driven ? driven.angle : playerState.heading;
  if (driven) camYaw += (heading - camYaw) * Math.min(1, dt * 2.2);
  camDist = driven ? 11 : 9;
  const target = driven ?? playerState;
  view.setChase(new THREE.Vector3(target.x, 1.6, target.z), camYaw, camPitch, camDist);
}

function syncMeshes() {
  playerMesh.visible = driven === null;
  if (!driven) {
    playerMesh.position.set(playerState.x, 0, playerState.z);
    playerMesh.rotation.y = playerState.heading;
    // a subtle walk bob
    playerMesh.children[0].rotation.x = Math.sin(playerState.anim) * 0.5;
  }
}

// ------------------------------------------------------------------ a frame
let accumulator = 0;
let last = performance.now();

function frame(now) {
  requestAnimationFrame(frame);
  const delta = Math.min((now - last) / 1000, MAX_FRAME);
  last = now;
  if (screen === 'play' && !paused) {
    accumulator += delta;
    while (accumulator >= STEP) {
      handleActions();
      stepFixed(readInput());
      accumulator -= STEP;
    }
  } else {
    accumulator = 0;
    handleActions();
  }
  const target = driven ?? playerState;
  hudState.health = health;
  hudState.money = money;
  hudState.wanted = starsForHeat(heat);
  hudState.inCar = driven !== null;
  if (driven) {
    hudState.vehicleName = driven.spec.name;
    hudState.speed = driven.speed;
    hudState.vehicleHealth = driven.health;
  }
  hudState.district = districtAt(target.x, target.z);
  hudState.objective = objectiveText(missionState);
  if (screen === 'play') updateCamera(delta);
  syncMeshes();
  audio.engineOn();
  audio.engineUpdate(driven ? driven.speed : 0, 40, driven !== null && screen === 'play');
  view.drawMinimap({
    heading: camYaw, x: target.x, z: target.z,
    cityColliders: city.colliders,
    objective: markerFor(missionState, city.landmarks),
    traffic: vehicles.filter((v) => v.isTraffic).map((v) => ({ x: v.state.x, z: v.state.z })),
    police,
  });
  hud.update(hudState);
  view.render();
}

// ------------------------------------------------------------------ the shot world
// The interface shots.js drives: reset into a rich starting state, then step the real rules once.
function makeShotWorld() {
  return {
    player: playerState,
    resetShot(name) {
      startNew();
      const start = spawnParked('sport', playerState.x + 7, playerState.z + 3, 0.4);
      driven = start.state;
      drivenMesh = start.mesh;
      // aim at the first contract marker so the autopilot drives a purposeful line from step one
      missionState.active = true;
      missionState.step = 0;
      missionState.index = name === 'end' ? 2 : 0;
      if (name === 'end') commitCrime(320, playerState.x, playerState.z);
      else if (name === 'play') commitCrime(60, playerState.x, playerState.z);
    },
    stepOnce(input) {
      stepFixed(input);
    },
    drivenCar() {
      return driven;
    },
    shotMarker() {
      return markerFor(missionState, city.landmarks);
    },
  };
}

// ------------------------------------------------------------------ boot
function boot() {
  parkCars();
  spawnTrafficAndPeople();
  hud.renderMissions(MISSIONS, 0, []);
  hud.showContinue(readSave() !== null);
  document.getElementById('btn-new').addEventListener('click', () => startNew());
  document.getElementById('btn-continue').addEventListener('click', () => continueGame());
  document.getElementById('btn-resume').addEventListener('click', () => pauseGame(false));
  document.getElementById('btn-restart').addEventListener('click', () => startNew());
  document.getElementById('btn-restart-over').addEventListener('click', () => startNew());
  document.getElementById('btn-title-save').addEventListener('click', () => { writeSave(); hud.notify('Saved.'); pauseGame(false); });
  hud.setScreen('title');
  hud.showControls(true);

  // ---- screenshot mode: play forward, compose the frame, set window.__shotReady ----
  if (shot) {
    const world = makeShotWorld();
    const result = stageShot(shot, world);
    screen = result.screen;
    paused = false;
    hud.setScreen(result.screen === 'over' ? 'over' : result.screen === 'title' ? 'title' : '');
    hud.showControls(result.screen === 'title');
    hud.renderMissions(MISSIONS, missionState.index, missionState.complete);
    let painted = 0;
    const paint = () => {
      const target = driven ?? playerState;
      if (result.screen === 'title') {
        // slow orbit so the dusk skyline and the logo share the frame
        view.setOrbit(new THREE.Vector3(-10, 0, -10), 200, Math.PI + 0.3);
      } else {
        // a chase camera pulled back and up so the frame reads as a scene, not a bumper view
        const heading = driven ? driven.angle : playerState.heading;
        camYaw = heading + Math.PI * 0.9; // three-quarter view from behind, off to one side
        camPitch = 0.4;
        view.setChase(new THREE.Vector3(target.x, 1.6, target.z), camYaw, camPitch, 15);
      }
      view.drawMinimap({
        heading: camYaw, x: target.x, z: target.z,
        cityColliders: city.colliders,
        objective: markerFor(missionState, city.landmarks),
        traffic: vehicles.filter((v) => v.isTraffic).map((v) => ({ x: v.state.x, z: v.state.z })),
        police,
      });
      hud.update(hudState);
      view.render();
      painted += 1;
      if (painted < 3) requestAnimationFrame(paint);
      else window.__shotReady = true;
    };
    requestAnimationFrame(paint);
    return;
  }

  requestAnimationFrame(frame);
}

boot();
