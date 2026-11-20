// Vehicles and driving: arcade car physics (accel, brake, reverse, speed-scaled steering, a
// handbrake), collision against buildings, and the traffic AI that drives the roads and stops for
// the player. A car is a mesh Group from entities.js plus a plain state object; main.js owns the
// lists, this file moves them.

import { VEHICLE_SPECS, WORLD } from './config.js';
import { collideCircle } from './player.js';

const { half } = WORLD;
const LIMIT = 244;

export function createVehicleState(kind, x, z, angle) {
  const spec = VEHICLE_SPECS[kind] ?? VEHICLE_SPECS.sedan;
  return { kind, spec, x, z, angle, speed: 0, steer: 0, health: 100, drift: 0 };
}

/** One physics step for a driven car. throttle -1..1, steerInput -1..1, handbrake bool. */
export function driveVehicle(car, throttle, steerInput, handbrake, dt, colliders) {
  const spec = car.spec;
  if (throttle > 0) car.speed += spec.accel * throttle * dt;
  else if (throttle < 0) {
    if (car.speed > 0.5) car.speed -= spec.brake * dt;
    else car.speed += spec.accel * 0.6 * throttle * dt;
  } else {
    car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 6 * dt);
  }
  if (handbrake) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 24 * dt);
  car.speed = Math.max(-spec.top * 0.4, Math.min(spec.top, car.speed));

  const steerTarget = steerInput * spec.turn * (1 / (1 + Math.abs(car.speed) * 0.045));
  car.steer += (steerTarget - car.steer) * Math.min(1, dt * 8);
  car.angle += car.steer * (car.speed / spec.top) * (handbrake ? 1.6 : 1) * dt * 2.2;

  const radius = car.kind === 'truck' ? 2.4 : 1.9;
  const nx = car.x + Math.sin(car.angle) * car.speed * dt;
  const nz = car.z + Math.cos(car.angle) * car.speed * dt;
  const fixed = collideCircle(nx, nz, radius, colliders);
  if (Math.abs(fixed.x - nx) > 0.001 || Math.abs(fixed.z - nz) > 0.001) {
    car.health = Math.max(0, car.health - Math.abs(car.speed) * 0.3);
    car.speed *= -0.15;
  }
  // a degenerate frame (a tiny separation push, a wild steer) must never poison the position:
  // fall back to the last good spot and bleed the speed rather than carry a NaN forward
  if (!Number.isFinite(fixed.x) || !Number.isFinite(fixed.z)) {
    car.speed = 0;
    car.steer = 0;
  } else {
    car.x = Math.max(-LIMIT, Math.min(LIMIT, fixed.x));
    car.z = Math.max(-LIMIT, Math.min(LIMIT, fixed.z));
  }
  if (!Number.isFinite(car.angle)) car.angle = 0;
  if (!Number.isFinite(car.speed)) car.speed = 0;
}

/** Keep two cars from overlapping: push them apart and bleed speed. */
export function separateCars(a, b) {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const dist = Math.hypot(dx, dz);
  if (dist > 3.2 || dist === 0) return false;
  const push = ((3.2 - dist) / dist) * 0.5;
  a.x -= dx * push;
  a.z -= dz * push;
  b.x += dx * push;
  b.z += dz * push;
  const rel = Math.abs(a.speed - b.speed);
  a.health = Math.max(0, a.health - rel * 0.2);
  b.health = Math.max(0, b.health - rel * 0.2);
  a.speed *= 0.85;
  b.speed *= 0.85;
  return true;
}

/** The road centre lines cars drive along (between the blocks). */
export function roadLines(grid, cell, block, half) {
  const lines = [];
  for (let k = 0; k <= grid; k++) lines.push(-half + block + (cell - block) / 2 + (k - 1) * cell);
  return lines;
}

/**
 * Advance a traffic car along its lane toward a target intersection; it slows for the player and
 * other cars ahead and picks a new lane target when it arrives. No pathfinding — just the grid.
 */
export function updateTraffic(car, player, others, colliders, dt) {
  const targetSpeed = car.blocked ? 0 : car.cruise;
  car.speed += Math.sign(targetSpeed - car.speed) * Math.min(Math.abs(targetSpeed - car.speed), 10 * dt);
  const dx = car.targetX - car.x;
  const dz = car.targetZ - car.z;
  if (Math.hypot(dx, dz) < 8) {
    const alongX = Math.abs(Math.sin(car.angle)) > 0.5;
    if (alongX) {
      const nextZ = car.targetZ + car.dirZ * 60;
      car.targetZ = Math.abs(nextZ) > 230 ? car.targetZ - car.dirZ * 60 : nextZ;
      car.dirZ = Math.sign(car.targetZ - car.z) || car.dirZ;
    } else {
      const nextX = car.targetX + car.dirX * 60;
      car.targetX = Math.abs(nextX) > 230 || nextX > 150 ? car.targetX - car.dirX * 60 : nextX;
      car.dirX = Math.sign(car.targetX - car.x) || car.dirX;
    }
  }
  let diff = Math.atan2(dx, dz) - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  car.angle += diff * Math.min(1, dt * 3);
  const fixed = collideCircle(car.x + Math.sin(car.angle) * car.speed * dt, car.z + Math.cos(car.angle) * car.speed * dt, 1.8, colliders);
  car.x = fixed.x;
  car.z = fixed.z;
  // stop when something is close ahead
  car.blocked = false;
  const aheadX = car.x + Math.sin(car.angle) * 6;
  const aheadZ = car.z + Math.cos(car.angle) * 6;
  if (Math.hypot(player.x - aheadX, player.z - aheadZ) < 4.5) car.blocked = true;
  for (const other of others) {
    if (other === car) continue;
    if (Math.hypot(other.x - aheadX, other.z - aheadZ) < 3.8) car.blocked = true;
  }
}

/** Place a traffic car on a lane heading along an axis, from the seeded rng. */
export function spawnTrafficCar(kind, rng, roadCoords) {
  const lane = roadCoords[Math.floor(rng() * roadCoords.length)];
  const along = Math.max(-230, Math.min(150, rng() * 380 - 230));
  const horizontal = rng() < 0.5;
  const x = horizontal ? along : lane;
  const z = horizontal ? lane : along;
  const car = createVehicleState(kind, x, z, horizontal ? Math.PI / 2 : 0);
  car.cruise = 10 + rng() * 8;
  car.targetX = x;
  car.targetZ = z;
  if (horizontal) {
    car.dirX = rng() < 0.5 ? 1 : -1;
    car.targetX = x + car.dirX * 60;
  } else {
    car.dirZ = rng() < 0.5 ? 1 : -1;
    car.targetZ = z + car.dirZ * 60;
  }
  car.isTraffic = true;
  return car;
}
