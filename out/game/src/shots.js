// The screenshot scenes behind ?shot=start|play|end. Each one plays the real game forward from a
// fresh world for a fixed number of seconds, steered by a small autopilot (drive toward the current
// contract marker, ease off in tight turns), so the frame is what a short session really looks like
// and the same seed always gives the same frame. The start scene leaves the camera orbiting the city
// for the title; the end scene runs a long, hot chase and lands on the game-over screen.

const SCENE_SECONDS = { start: 1, play: 22, end: 45 };

/**
 * Stage `world` into the named scene and return the screen to draw. `world` is the object main.js
 * exposes; staging resets it into a rich starting state, then drives it through its own fixed step.
 */
export function stageShot(name, world) {
  world.resetShot(name);
  const seconds = SCENE_SECONDS[name] ?? SCENE_SECONDS.start;
  const totalSteps = Math.floor(seconds * 60);
  for (let step = 0; step < totalSteps; step++) {
    world.stepOnce(autopilot(name, world));
  }
  const screen = name === 'start' ? 'title' : name === 'end' ? 'over' : 'play';
  return { screen, seconds };
}

/** The autopilot: a tiny driver. The start scene idles (the camera orbits); the others drive. */
function autopilot(name, world) {
  if (name === 'start') return { moveX: 0, moveZ: 0, sprint: false, steer: 0, throttle: 0, brake: false };
  const car = world.drivenCar();
  const marker = world.shotMarker();
  const target = marker ?? { x: world.player.x + 80, z: world.player.z + 60 };
  if (!car) return { moveX: 0, moveZ: 1, sprint: true, steer: 0, throttle: 0, brake: false };
  let diff = Math.atan2(target.x - car.x, target.z - car.z) - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const steer = Math.max(-1, Math.min(1, diff * 1.7));
  return {
    moveX: 0, moveZ: 0, sprint: false, steer,
    throttle: Math.abs(diff) > 1.3 ? 0.35 : 1,
    brake: Math.abs(diff) > 2.3,
  };
}
