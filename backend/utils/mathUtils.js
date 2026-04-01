// Mean of array
export const mean = (arr) =>
  arr.reduce((s, v) => s + v, 0) / arr.length;

// Standard deviation
export const stdDev = (arr) => {
  const m = mean(arr);
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length);
};

// Z-score of a value against an array
export const zScore = (value, arr) => {
  const m = mean(arr);
  const s = stdDev(arr);
  return s === 0 ? 0 : (value - m) / s;
};

// Clamp value to [min, max]
export const clamp = (val, min, max) =>
  Math.max(min, Math.min(max, val));

// Map a value from [inMin,inMax] to [outMin,outMax]
export const mapRange = (val, inMin, inMax, outMin, outMax) => {
  if (inMax === inMin) return (outMin + outMax) / 2;
  return outMin + ((val - inMin) / (inMax - inMin)) * (outMax - outMin);
};

// Min-max normalize array
export const minMaxNormalize = (arr) => {
  const min = Math.min(...arr);
  const max = Math.max(...arr);
  const range = max - min || 1;
  return { norm: arr.map(v => (v - min) / range), min, max, range };
};

export const denormalize = (v, min, range) => v * range + min;
