// The player on foot: third-person movement over the grid, a sprint, and collision against every
// building's box (the city's colliders). The camera yaw comes from the mouse; movement is relative
// to it. Nothing here knows about cars — main.js hands the player between this and vehicles.js when
// they enter or leave one.

import { PLAYER } from './config.js';

export function createPlayerState() {
  return { x: -60, z: -60, heading: 0, speed: 0, sprinting: false, anim: 0 };
}

/** Push a circle (x,z,radius) out of every box collider it overlaps; returns corrected x,z. */
export function collideCircle(x, z, radius, colliders) {
  for (const c of colliders) {
    const dx = x - c.x;
    const dz = z - c.z;
    const closestX = Math.max(-c.hx, Math.min(c.hx, dx));
    const closestZ = Math.max(-c.hz, Math.min(c.hz, dz));
    const ox = dx - closestX;
    const oz = dz - closestZ;
    const dist = Math.hypot(ox, oz);
    if (dist < radius) {
      if (dist > 0.0001) {
        const push = (radius - dist) / dist;
        x += ox * push;
        z += oz * push;
      } else {
        // Centre inside the box (closest point is the centre itself): escape along the shallowest
        // axis. dx and dz are both ~0 here, so sign() alone cannot pick a side — use which face is
        // nearest, else walk +x.
        const toEdgeX = c.hx - Math.abs(dx);
        const toEdgeZ = c.hz - Math.abs(dz);
        if (toEdgeX <= toEdgeZ) x = c.x + (dx >= 0 ? 1 : -1) * (c.hx + radius);
        else z = c.z + (dz >= 0 ? 1 : -1) * (c.hz + radius);
      }
    }
  }
  return { x, z };
}

const LIMIT = 244;
/** Move the on-foot player from camera-relative input (moveX, moveZ in -1..1) for dt seconds. */
export function updatePlayer(player, moveX, moveZ, sprint, cameraYaw, colliders, dt) {
  const mag = Math.hypot(moveX, moveZ);
  player.sprinting = sprint && mag > 0.1;
  if (mag > 0.1) {
    const speed = player.sprinting ? PLAYER.sprint : PLAYER.walk;
    const forwardX = -Math.sin(cameraYaw);
    const forwardZ = -Math.cos(cameraYaw);
    const rightX = Math.cos(cameraYaw);
    const rightZ = -Math.sin(cameraYaw);
    let wx = forwardX * moveZ + rightX * moveX;
    let wz = forwardZ * moveZ + rightZ * moveX;
    const wmag = Math.hypot(wx, wz) || 1;
    wx /= wmag;
    wz /= wmag;
    const fixed = collideCircle(player.x + wx * speed * dt, player.z + wz * speed * dt, PLAYER.radius, colliders);
    player.x = fixed.x;
    player.z = fixed.z;
    player.heading = Math.atan2(wx, wz);
    player.speed = speed;
    player.anim += dt * (player.sprinting ? 14 : 9);
  } else {
    player.speed = 0;
    player.anim += dt * 2;
  }
  player.x = Math.max(-LIMIT, Math.min(LIMIT, player.x));
  player.z = Math.max(-LIMIT, Math.min(LIMIT, player.z));
  return player;
}
