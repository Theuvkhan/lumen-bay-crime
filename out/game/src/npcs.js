// Pedestrians and the Bay Patrol. Pedestrians wander and flee nearby threats; Bay Patrol cruisers
// chase the player when their wanted heat rises, sirens on, and are evaded by staying out of sight.
// main.js owns the lists; this file moves them.

import { collideCircle } from './player.js';
import { WANTED } from './config.js';

const PED = { walk: 2.6, flee: 7.2, radius: 0.4 };

export function createPedestrianState(x, z, rng) {
  return { x, z, heading: rng() * Math.PI * 2, speed: 0, fleeing: false, timer: 1 + rng() * 4, anim: rng() * 6 };
}

/** Wander; flee the nearest threat (the game passes fast cars and gunshots as threats). */
export function updatePedestrian(ped, threats, colliders, dt, rng) {
  let danger = null;
  let bestDist = 18;
  for (const t of threats) {
    const dist = Math.hypot(t.x - ped.x, t.z - ped.z);
    if (dist < bestDist) {
      bestDist = dist;
      danger = t;
    }
  }
  ped.fleeing = danger !== null;
  if (ped.fleeing) {
    const away = Math.atan2(ped.x - danger.x, ped.z - danger.z);
    ped.heading += (away - ped.heading) * Math.min(1, dt * 6);
    ped.speed = PED.flee;
  } else {
    ped.timer -= dt;
    if (ped.timer <= 0) {
      ped.heading += (rng() - 0.5) * 2;
      ped.timer = 1.5 + rng() * 3.5;
    }
    ped.speed = PED.walk;
  }
  const fixed = collideCircle(ped.x + Math.sin(ped.heading) * ped.speed * dt, ped.z + Math.cos(ped.heading) * ped.speed * dt, PED.radius, colliders);
  if (Math.abs(fixed.x - (ped.x + Math.sin(ped.heading) * ped.speed * dt)) > 0.001) ped.heading += 2.2;
  ped.x = Math.max(-244, Math.min(244, fixed.x));
  ped.z = Math.max(-244, Math.min(244, fixed.z));
  ped.anim += dt * (ped.fleeing ? 12 : 6);
}

// --- Bay Patrol ---

export function createPoliceState(x, z, angle) {
  return { kind: 'police', x, z, angle, speed: 0, steer: 0, stuckTimer: 0 };
}

/** Steer a cruiser toward a target with arcade car physics; returns true while it is alongside. */
export function updatePolice(car, target, colliders, dt) {
  const spec = car.spec;
  const dx = target.x - car.x;
  const dz = target.z - car.z;
  const dist = Math.hypot(dx, dz);
  let diff = Math.atan2(dx, dz) - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const steerInput = Math.max(-1, Math.min(1, diff * 2));
  const throttle = dist > 14 ? 1 : dist < 6 ? -0.4 : 0.3;
  car.steer += (steerInput * spec.turn - car.steer) * Math.min(1, dt * 6);
  if (throttle > 0) car.speed += spec.accel * throttle * dt;
  else if (throttle < 0) car.speed -= spec.brake * 0.5 * dt;
  car.speed = Math.max(-8, Math.min(spec.top * 0.92, car.speed));
  car.angle += car.steer * (car.speed / spec.top) * dt * 2.2;
  const fixed = collideCircle(car.x + Math.sin(car.angle) * car.speed * dt, car.z + Math.cos(car.angle) * car.speed * dt, 1.9, colliders);
  if (Math.abs(fixed.x - (car.x + Math.sin(car.angle) * car.speed * dt)) > 0.001) car.speed *= 0.6;
  car.x = Math.max(-244, Math.min(244, fixed.x));
  car.z = Math.max(-244, Math.min(244, fixed.z));
  // stuck against a wall: reverse out for a moment
  if (Math.abs(car.speed) < 1.5) car.stuckTimer += dt;
  else car.stuckTimer = 0;
  if (car.stuckTimer > 1.6 && car.stuckTimer < 2.6) {
    car.speed = -8;
    car.steer = 0.8;
  } else if (car.stuckTimer >= 2.6) car.stuckTimer = 0;
  return dist < 7;
}

/** Stars (0..5) for a heat value. */
export function starsForHeat(heat) {
  let stars = 0;
  for (let i = 1; i <= WANTED.max; i++) if (heat >= WANTED.thresholds[i]) stars = i;
  return stars;
}
