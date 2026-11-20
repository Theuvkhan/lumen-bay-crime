// A small deterministic PRNG (mulberry32). The city is always built from a fixed seed so every
// load is the same Lumen Bay; the ?seed= parameter drives traffic, pedestrians and shot staging.

export function createRandom(seed) {
  let a = seed >>> 0;
  return function random() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pick a whole number in [min, max] from `rng`. */
export function randInt(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

/** Pick a float in [min, max) from `rng`. */
export function randRange(rng, min, max) {
  return min + rng() * (max - min);
}

/** Pick one element of `list` from `rng`. */
export function pick(rng, list) {
  return list[Math.floor(rng() * list.length)];
}
