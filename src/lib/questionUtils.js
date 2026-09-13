// Deterministic 32-bit FNV-1a hash function
export function fnv1a(str) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

// SplitMix32 Seeded PRNG
export function createSeededRandom(seedStr) {
  let state = fnv1a(seedStr);
  return function () {
    state |= 0;
    state = (state + 0x9e3779b9) | 0;
    let t = Math.imul(state ^ (state >>> 16), 0x21f0aaad);
    t = Math.imul(t ^ (t >>> 15), 0x735a2d97);
    return ((t ^ (t >>> 15)) >>> 0) / 4294967296;
  };
}

// Deterministic Fisher-Yates option shuffle using seed
export function getSeededShuffledOptions(optionsArray, seedStr) {
  if (!optionsArray || !Array.isArray(optionsArray)) return [];
  const shuffled = [...optionsArray];
  const rng = createSeededRandom(seedStr);
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Deterministic boolean for Round 1 real image placement (left vs right)
export function getSeededIsRealOnLeft(seedStr) {
  const rng = createSeededRandom(seedStr);
  return rng() < 0.5;
}
