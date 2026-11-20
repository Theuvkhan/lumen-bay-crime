// The three connected contracts of LUMEN BAY and their state machine. Each is a short chain of
// objectives (drive to a place, hold, deliver, escape), tracked on the HUD and minimap; finishing
// one pays cash and unlocks the next. All fiction is original to this city.

export const MISSIONS = [
  {
    id: 'pickup',
    title: 'Vesper Pickup',
    giver: 'Nadia Vesper',
    brief: 'A package waits at Vesper Tower. Grab a car and bring it to the Orbit Wheel.',
    steps: [
      { text: 'Reach the drop at Vesper Tower', marker: 'Vesper Tower' },
      { text: 'Deliver the package to the Orbit Wheel', marker: 'Orbit Wheel' },
    ],
    reward: 500,
  },
  {
    id: 'crane',
    title: 'Harbour Run',
    giver: 'Cassius Rill',
    brief: 'A crate at the Harbour Cranes has your name on it. The Bay Patrol is watching — lose them after.',
    steps: [
      { text: 'Reach the Harbour Cranes', marker: 'Harbour Cranes' },
      { text: 'Pick up the crate (hold in the marker)', marker: 'Harbour Cranes', offset: 16 },
      { text: 'Lose the heat and reach the Mirage Casino', marker: 'Mirage Casino' },
    ],
    reward: 900,
  },
  {
    id: 'lumen',
    title: 'Lumen Tower Heist',
    giver: 'Nadia Vesper',
    brief: 'The Lumen Tower vault holds the Vesper ledger. Get in, get it, get out before the whole Bay Patrol descends.',
    steps: [
      { text: 'Drive to the Lumen Tower', marker: 'Lumen Tower' },
      { text: 'Drill the vault (hold position)', marker: 'Lumen Tower', offset: 18 },
      { text: 'Escape clean to the Cathedral drop', marker: 'Cathedral' },
    ],
    reward: 1500,
  },
];

export function createMissionState() {
  return { index: 0, step: 0, active: false, holdTimer: 0, complete: [], completedAll: false };
}

/** The world point a mission step points at, or null between missions. */
export function markerFor(state, landmarks) {
  if (!state.active) return null;
  const mission = MISSIONS[state.index];
  const step = mission.steps[state.step];
  const landmark = landmarks.find((l) => l.name === step.marker);
  if (!landmark) return null;
  const offset = step.offset ?? 0;
  return { x: landmark.x + offset, z: landmark.z + offset * 0.3, name: landmark.name };
}

/** Objective text for the HUD banner. */
export function objectiveText(state) {
  if (!state.active) {
    if (state.completedAll) return 'All contracts done — Lumen Bay is yours.';
    const next = MISSIONS[state.index];
    return next ? `Press ${state.index + 1} to start "${next.title}"` : '';
  }
  return MISSIONS[state.index].steps[state.step].text;
}

/** How close the player must be to a step marker to advance. */
export function stepRadius(step) {
  return step.offset ? 9 : 12;
}

/**
 * Advance the mission. `dist` is how far the player is from the marker, `wanted` the stars, `inCar`
 * whether they are driving. Returns 'none' | 'advanced' | 'complete'.
 */
export function updateMission(state, dist, wanted, dt) {
  if (!state.active) return 'none';
  const mission = MISSIONS[state.index];
  const step = mission.steps[state.step];
  if (dist > stepRadius(step)) {
    state.holdTimer = 0;
    return 'none';
  }
  if (step.text.startsWith('Pick up') || step.text.startsWith('Drill')) {
    state.holdTimer += dt;
    if (state.holdTimer < 3.5) return 'none';
    state.holdTimer = 0;
  }
  if (step.text.startsWith('Lose') || step.text.startsWith('Escape')) {
    if (wanted > 0) return 'none';
  }
  state.step += 1;
  if (state.step >= mission.steps.length) {
    state.complete.push(mission.id);
    state.active = false;
    state.step = 0;
    if (state.index >= MISSIONS.length - 1) state.completedAll = true;
    else state.index += 1;
    return 'complete';
  }
  return 'advanced';
}
