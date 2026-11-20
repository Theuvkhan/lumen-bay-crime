// Shared tuning for LUMEN BAY: world scale, the dusk colour grade, on-foot movement, vehicle
// performance specs and the wanted-level thresholds. One place to balance the city.

/** The street grid: a cell is one block plus one road, laid out grid×grid across the city. */
export const WORLD = {
  cell: 60, // block (46) + road (14)
  block: 46,
  road: 14,
  sidewalk: 4,
  grid: 8, // blocks per side
  half: 250, // playable half-extent (roads run -247..247)
  water: 0, // the bay begins beyond +x (set in city.js)
};

/** The dusk palette: sky gradient stops, fog, sun and the neon sign colours. */
export const COLORS = {
  skyTop: 0x150c33,
  skyMid: 0x4a2a6b,
  skyHorizon: 0xe0653f,
  fog: 0x3b2a5a,
  sun: 0xffa25e,
  hemiSky: 0x6a4a9c,
  hemiGround: 0x2a1830,
  water: 0x0b1a33,
  asphalt: 0x15161b,
  sidewalk: 0x262833,
  building: 0x241f33,
  neon: [0xff3d8b, 0x22e1ff, 0xffc93d, 0x7cff4f, 0xb14cff, 0xff6a2a],
};

/** On-foot movement. */
export const PLAYER = { walk: 7.5, sprint: 13.5, radius: 0.5, height: 1.8 };

/** Fixed physics step, seconds. */
export const STEP = 1 / 60;

/** Vehicle types the player can steal and drive, with arcade handling specs. */
export const VEHICLE_SPECS = {
  compact: { name: 'Pico Hatch', top: 26, accel: 11, brake: 18, turn: 2.0, color: 0x4fd1c5 },
  sedan: { name: 'Vesper GL', top: 30, accel: 12, brake: 20, turn: 1.8, color: 0xc0c6d4 },
  sport: { name: 'Mirage GT', top: 44, accel: 20, brake: 26, turn: 2.1, color: 0xff3d6e },
  truck: { name: 'Harbor Hauler', top: 22, accel: 8, brake: 16, turn: 1.3, color: 0x8a6a3a },
  police: { name: 'Bay Patrol Cruiser', top: 38, accel: 17, brake: 24, turn: 1.9, color: 0x1a1c22 },
};

/** Wanted level: heat needed for each star and how many cruisers pursue at that star. */
export const WANTED = {
  thresholds: [0, 20, 60, 130, 240, 380], // heat per star (index = stars)
  decay: 4, // heat lost per second while evading
  evadeTime: 8, // seconds out of sight before a star drops
  max: 5,
};

/** localStorage key for the save slot. */
export const SAVE_KEY = 'lumen-bay-save-v1';
