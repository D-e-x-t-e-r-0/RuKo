export function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Box-Muller Gaussian random generator
export function createGaussian(prng: () => number): () => number {
  let hasSpare = false;
  let spare = 0;

  return function () {
    if (hasSpare) {
      hasSpare = false;
      return spare;
    }

    let u = 0;
    let v = 0;
    let s = 0;

    do {
      u = prng() * 2 - 1;
      v = prng() * 2 - 1;
      s = u * u + v * v;
    } while (s >= 1 || s === 0);

    const mul = Math.sqrt((-2.0 * Math.log(s)) / s);
    spare = v * mul;
    hasSpare = true;
    return u * mul;
  };
}
