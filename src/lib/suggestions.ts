/**
 * AI Suggestions Engine for Fractal Explorer
 *
 * Implements heuristic-based "interesting point" detection by analyzing
 * the complex plane to find points that produce visually compelling Julia sets.
 *
 * Equation-aware: adapts analysis based on the selected equation.
 *
 * Heuristics used:
 * 1. Boundary proximity - points near the set boundary
 * 2. Iteration variance - high variance in nearby escape times indicates complex structure
 * 3. Classic points - well-known Julia set locations (equation 1 only)
 */

import type { Complex, ViewBounds } from '../types';

export interface SuggestedPoint {
  id: string;
  point: Complex;
  score: number;
  category: SuggestionCategory;
  description: string;
}

export type SuggestionCategory =
  | 'boundary'      // On set boundary
  | 'classic'       // Classic interesting Julia points (equation 1 only)
  | 'high-variance'; // High iteration variance detected

interface AnalysisPoint {
  c: Complex;
  escapeIter: number;
  variance: number;
  mixedness: number;
  multiScaleScore: number;
  escapeSpread: number; // How well-distributed escape times are (0-1)
}

// Classic interesting Julia set points - ONLY valid for equation 1 (z² + c)
const CLASSIC_POINTS: { point: Complex; name: string }[] = [
  { point: { real: -0.7269, imag: 0.1889 }, name: 'Douady Rabbit' },
  { point: { real: -0.8, imag: 0.156 }, name: 'Classic Spiral' },
  { point: { real: -0.4, imag: 0.6 }, name: 'Dendrite' },
  { point: { real: 0.285, imag: 0.01 }, name: 'Siegel Disk' },
  { point: { real: -0.835, imag: -0.2321 }, name: 'Dragon Curve' },
  { point: { real: -0.70176, imag: -0.3842 }, name: 'Seahorse Valley' },
  { point: { real: -0.75, imag: 0.11 }, name: 'Main Cardioid Edge' },
  { point: { real: -1.25, imag: 0.0 }, name: 'Period-2 Bulb' },
  { point: { real: 0.0, imag: 1.0 }, name: 'Basilica' },
  { point: { real: -0.1, imag: 0.651 }, name: 'Rabbit Variant' },
  { point: { real: -1.476, imag: 0.0 }, name: 'Feigenbaum Point' },
  { point: { real: -0.39054, imag: -0.58679 }, name: 'Swirl' },
  { point: { real: 0.27334, imag: 0.00742 }, name: 'Near Siegel' },
  { point: { real: -0.12256, imag: 0.74486 }, name: 'Near Seahorse' },
  { point: { real: -0.745429, imag: 0.113009 }, name: 'Elegant Spiral' },
];


// Complex number operations
function cMul(a: Complex, b: Complex): Complex {
  return { real: a.real * b.real - a.imag * b.imag, imag: a.real * b.imag + a.imag * b.real };
}

function cDiv(a: Complex, b: Complex): Complex {
  const denom = b.real * b.real + b.imag * b.imag;
  if (denom === 0) return { real: 1e10, imag: 0 }; // Avoid division by zero
  return { real: (a.real * b.real + a.imag * b.imag) / denom, imag: (a.imag * b.real - a.real * b.imag) / denom };
}

function cExp(z: Complex): Complex {
  const expReal = Math.exp(z.real);
  return { real: expReal * Math.cos(z.imag), imag: expReal * Math.sin(z.imag) };
}

function cPow(z: Complex, n: number): Complex {
  const r = Math.sqrt(z.real * z.real + z.imag * z.imag);
  const theta = Math.atan2(z.imag, z.real);
  const rn = Math.pow(r, n);
  return { real: rn * Math.cos(n * theta), imag: rn * Math.sin(n * theta) };
}

function cSqrt(z: Complex): Complex {
  return cPow(z, 0.5);
}

function cSin(z: Complex): Complex {
  const coshY = (Math.exp(z.imag) + Math.exp(-z.imag)) * 0.5;
  const sinhY = (Math.exp(z.imag) - Math.exp(-z.imag)) * 0.5;
  return { real: Math.sin(z.real) * coshY, imag: Math.cos(z.real) * sinhY };
}

function cCos(z: Complex): Complex {
  const coshY = (Math.exp(z.imag) + Math.exp(-z.imag)) * 0.5;
  const sinhY = (Math.exp(z.imag) - Math.exp(-z.imag)) * 0.5;
  return { real: Math.cos(z.real) * coshY, imag: -Math.sin(z.real) * sinhY };
}

function cTan(z: Complex): Complex {
  return cDiv(cSin(z), cCos(z));
}

function cAdd(a: Complex, b: Complex): Complex {
  return { real: a.real + b.real, imag: a.imag + b.imag };
}

function cSub(a: Complex, b: Complex): Complex {
  return { real: a.real - b.real, imag: a.imag - b.imag };
}

function cScale(z: Complex, s: number): Complex {
  return { real: z.real * s, imag: z.imag * s };
}

function cMag(z: Complex): number {
  return Math.sqrt(z.real * z.real + z.imag * z.imag);
}

/**
 * Apply the equation iteration - mirrors the GLSL shader equations
 */
function applyEquation(z: Complex, c: Complex, eq: number): Complex {
  const one: Complex = { real: 1, imag: 0 };
  const half: Complex = { real: 0.5, imag: 0 };

  const z2 = cMul(z, z);
  const z3 = cMul(z2, z);
  const z4 = cMul(z3, z);
  const z5 = cMul(z4, z);

  switch (eq) {
    case 1: return cAdd(z2, c);
    case 2: return cAdd(z3, c);
    case 3: return cAdd(z4, c);
    case 4: return cAdd(z5, c);
    case 5: return cDiv(cAdd(z2, c), cSub(z, c));
    case 6: return cSub(cSub(z2, z), c);
    case 7: return cAdd(cAdd(cSub(z3, z2), z), c);
    case 8: return cSub(cMul(cAdd(one, c), z), cMul(c, z2));
    case 9: return cDiv(z3, cAdd(one, cMul(c, z2)));
    case 10: return cAdd(cMul(cMul(cSub(z, one), cAdd(z, half)), cSub(z2, one)), c);
    case 11: return cDiv(cAdd(cAdd(z2, one), c), cSub(cSub(z2, one), c));
    case 12: return cAdd(cPow(z, 1.5), c);
    case 13: return cSub(cExp(z), c);
    case 14: return cAdd(cSub(cPow(z, 3), half), cMul(c, cExp({ real: -z.real, imag: -z.imag })));
    case 15: return cAdd(cSub(cMul(c, z), one), cMul(c, cExp({ real: -z.real, imag: -z.imag })));
    case 16: return cDiv(cAdd(cScale(z5, 4), c), cScale(z4, 5));
    case 17: return cAdd(cAdd(cSub(z5, z3), z), c);
    case 18: return cAdd(cAdd(z3, z), c);
    case 19: return cAdd(cAdd(cScale(z, 2 * Math.sin(z.real)), cMul(c, cScale(z, Math.cos(z.imag)))), c);
    case 20: return cAdd(cMul(z, cExp({ real: -z.real, imag: -z.imag })), c);
    case 21: return cAdd(cMul(c, cExp({ real: -z.real, imag: -z.imag })), z2);
    case 22: { const t = cAdd(z2, c); return cAdd(cAdd(cMul(t, t), z), c); }
    case 23: { const t = cAdd(z, cSin(z)); return cAdd(cMul(t, t), c); }
    case 24: return cAdd(z2, cMul(cMul(c, c), c));
    case 25: return cDiv(cAdd(z2, c), cSub(cSub(z2, one), c));
    case 26: return cAdd(cAdd(cScale(z2, Math.cos(z.imag)), cMul(c, cScale(z, Math.sin(z.real)))), c);
    case 27: return cAdd(cAdd(cScale(z2, Math.cos(z.real)), cMul(c, cScale(z, Math.sin(z.imag)))), c);
    case 28: { const m = cMag(z); return cAdd(cAdd(cScale(z2, Math.cos(m)), cMul(c, cScale(z, Math.sin(m)))), c); }
    case 29: return cAdd(cMul(cSin(z2), cTan(z2)), c);
    case 30: return cAdd(cMul(c, z2), cMul(z, cMul(c, c)));
    case 31: return cExp(cSin(cMul(c, z)));
    case 32: return cMul(c, cAdd(cSin(z), cCos(z)));
    case 33: { const t = cAdd(z2, c); return cDiv(cMul(t, t), cSub(z, c)); }
    case 34: return cMul(cMul(c, cAdd(cSin(z), cCos(z))), cAdd(cAdd(z3, z), c));
    case 35: return cMul(cMul(c, cExp(z)), cCos(cMul(c, z)));
    case 36: return cMul(cMul(cAdd(cAdd(z3, z), c), c), cAdd(cSin(z), cCos(z)));
    case 37: return cAdd(cAdd(cSub(one, z2), cDiv(z4, cAdd({ real: 2, imag: 0 }, cScale(z, 4)))), c);
    case 38: return cAdd(cAdd(z2, cPow(z, 1.5)), c);
    case 39: return cAdd(cAdd(cSub(one, z2), cDiv(z5, cAdd({ real: 2, imag: 0 }, cScale(z, 4)))), c);
    case 40: return cAdd(cMul(z3, cExp(z)), c);
    case 41: { const t = cAdd(z, cSin(z)); return cAdd(cAdd(cAdd(cMul(t, t), cMul(c, cExp({ real: -z.real, imag: -z.imag }))), z2), c); }
    case 42: return cSub(cAdd(cDiv(z3, cAdd(one, cMul(c, z2))), cExp(z)), c);
    case 43: { const t = cAdd(z, cSin(z)); return cAdd(cAdd(cMul(t, t), cMul(c, cExp(z))), c); }
    case 44: return cDiv(cAdd(z3, c), z2);
    case 45: return cDiv(cAdd(z3, c), z);
    case 46: { const t = cSub(z, cSqrt(z)); return cAdd(cMul(t, t), c); }
    case 47: { const t = cAdd(z, c); return cAdd(cMul(t, t), t); }
    case 48: { const t = cAdd(z, c); return cSub(cPow(t, 3), cMul(t, t)); }
    case 49: { const t = cSub(z3, z2); return cAdd(cMul(t, t), c); }
    case 50: { const t = cSub(z2, z); return cAdd(cMul(t, t), c); }
    case 51: { const t = cSub(z, cSqrt(z)); return cAdd(cMul(t, t), c); }
    case 52: { const t = cAdd(z2, cSqrt(z)); return cAdd(cMul(t, t), c); }
    case 53: { const ez = cExp(z); return cAdd(cSub(cMul(z2, ez), cMul(z, ez)), c); }
    case 54: { const t = cAdd(cExp(cMul(c, z)), c); return cMul(t, t); }
    case 55: return cAdd(cAdd(z5, cMul(c, z3)), c);
    case 56: return cExp(cAdd(z2, c));
    case 57: return cAdd(cPow(z, 8), c);
    default: return cAdd(z2, c);
  }
}

/**
 * Compute escape time using the specified equation
 */
function escapeTime(z: Complex, c: Complex, maxIter: number, equationId: number): number {
  let current = { ...z };
  for (let i = 0; i < maxIter; i++) {
    const mag2 = current.real * current.real + current.imag * current.imag;
    // Early bailout for large values (prevents slow computation)
    if (mag2 > 1e6) return i;
    if (mag2 > 4) return i;
    current = applyEquation(current, c, equationId);
    // Check for overflow/NaN
    if (!isFinite(current.real) || !isFinite(current.imag)) return i;
    // Additional bailout for very large values after equation
    if (Math.abs(current.real) > 1e10 || Math.abs(current.imag) > 1e10) return i;
  }
  return maxIter;
}

/**
 * Compute "Mandelbrot-like" escape for a c value using the equation
 * Starting from z = 0 (or appropriate starting point for the equation)
 */
function equationEscape(c: Complex, maxIter: number, equationId: number): number {
  // For most equations, start at z = 0
  return escapeTime({ real: 0, imag: 0 }, c, maxIter, equationId);
}

/**
 * Get equation-specific sampling parameters
 * Different equations have interesting behavior at different scales
 */
function getEquationParams(equationId: number): { radii: number[]; numSamples: number; angleOffsets?: number[] } {
  // Very high power equations (z^8 + c) - creates n-fold symmetric snowflakes
  // The "Mandelbrot" is nearly circular, interesting c values are in narrow annulus around |c|≈1
  // Need very small radii since z^8 explodes fast, and angle sampling for symmetry
  if (equationId === 57) {
    return {
      radii: [0.2, 0.4, 0.6, 0.8, 1.0], // Much smaller - z^8 explodes quickly
      numSamples: 16, // More samples to catch the 8-fold symmetry
      angleOffsets: [0, Math.PI / 8, Math.PI / 4, 3 * Math.PI / 8] // Match 8-fold symmetry
    };
  }
  // Equation 3: z³ + c - optimal |c| ≈ 0.65, 3-fold symmetry
  if (equationId === 3) {
    return {
      radii: [0.3, 0.5, 0.7, 0.9, 1.1],
      numSamples: 12,
      angleOffsets: [0, Math.PI / 6, Math.PI / 3] // 3-fold
    };
  }
  // Equation 4: z⁴ + c - optimal |c| ≈ 0.75, 4-fold symmetry
  if (equationId === 4) {
    return {
      radii: [0.35, 0.55, 0.75, 0.95, 1.15],
      numSamples: 12,
      angleOffsets: [0, Math.PI / 8, Math.PI / 4] // 4-fold
    };
  }
  // Equation 6: z² - z - c - optimal |c| ≈ 0.4
  if (equationId === 6) {
    return {
      radii: [0.15, 0.3, 0.45, 0.6, 0.8],
      numSamples: 12,
      angleOffsets: [0, Math.PI / 5, 2 * Math.PI / 5]
    };
  }
  // Equation 13: exp(z) - c - optimal |c| ≈ 0.85, creates ring structures
  if (equationId === 13) {
    return {
      radii: [0.4, 0.6, 0.85, 1.1, 1.4],
      numSamples: 10,
      angleOffsets: [0, Math.PI / 4, Math.PI / 2]
    };
  }
  // Equation 17: z⁵ - z³ + z + c - optimal |c| ≈ 0.7
  if (equationId === 17) {
    return {
      radii: [0.35, 0.55, 0.75, 1.0, 1.25],
      numSamples: 12,
      angleOffsets: [0, Math.PI / 5, 2 * Math.PI / 5]
    };
  }
  // Equation 5: (z² + c)/(z - c) - optimal |c| ≈ 0.67
  if (equationId === 5) {
    return {
      radii: [0.3, 0.5, 0.7, 0.9, 1.1],
      numSamples: 12,
      angleOffsets: [0, Math.PI / 5, 2 * Math.PI / 5]
    };
  }
  // Equation 7: z³ - z² + z + c - optimal |c| ≈ 0.71
  if (equationId === 7) {
    return {
      radii: [0.35, 0.55, 0.75, 0.95, 1.15],
      numSamples: 12,
      angleOffsets: [0, Math.PI / 6, Math.PI / 3]
    };
  }
  // Equation 18: z³ + z + c - optimal |c| ≈ 0.62
  if (equationId === 18) {
    return {
      radii: [0.3, 0.5, 0.65, 0.85, 1.05],
      numSamples: 12,
      angleOffsets: [0, Math.PI / 6, Math.PI / 3]
    };
  }
  // Equation 40: z³·exp(z) + c - optimal |c| ≈ 0.76
  if (equationId === 40) {
    return {
      radii: [0.4, 0.6, 0.8, 1.0, 1.2],
      numSamples: 12,
      angleOffsets: [0, Math.PI / 6, Math.PI / 3]
    };
  }
  // Equation 54: (exp(cz) + c)² - optimal |c| ≈ 1.02, interesting in multiple quadrants
  if (equationId === 54) {
    return {
      radii: [0.75, 0.9, 1.05, 1.2, 1.35],
      numSamples: 16,
      angleOffsets: [0, Math.PI / 6, Math.PI / 3, Math.PI / 2] // Full quadrant coverage
    };
  }
  // Equation 55: z⁵ + cz³ + c - optimal |c| ≈ 0.64
  if (equationId === 55) {
    return {
      radii: [0.3, 0.5, 0.7, 0.9, 1.1],
      numSamples: 12,
      angleOffsets: [0, Math.PI / 5, 2 * Math.PI / 5]
    };
  }
  // Parameter-transformed equations (c³, c²) - the parameter space is warped
  // For z² + c³, interesting region is where |c³| ≈ 0.3-1.5, so |c| ≈ 0.67-1.14
  // Need to sample carefully to capture the spiral structures
  if ([24, 30].includes(equationId)) {
    return {
      radii: [0.4, 0.7, 1.0, 1.4, 1.8], // Broader range to catch transformed space
      numSamples: 14,
      angleOffsets: [0, Math.PI / 6, Math.PI / 3, Math.PI / 2] // Multiple angles for spirals
    };
  }
  // Nested/composed equations - each has different optimal |c| range
  // Equation 22: (z² + c)² + z + c - optimal |c| ≈ 1.15
  if (equationId === 22) {
    return {
      radii: [0.6, 0.9, 1.2, 1.6, 2.0], // Larger radii for |c| ≈ 1.15
      numSamples: 14,
      angleOffsets: [0, Math.PI / 5, 2 * Math.PI / 5, 3 * Math.PI / 5]
    };
  }
  // Equation 33: (z² + c)² / (z - c) - optimal |c| ≈ 0.65 (division shifts region inward)
  if (equationId === 33) {
    return {
      radii: [0.3, 0.5, 0.7, 1.0, 1.3], // Smaller radii for |c| ≈ 0.65
      numSamples: 14,
      angleOffsets: [0, Math.PI / 6, Math.PI / 3, Math.PI / 2]
    };
  }
  // Equation 49: (z³ - z²)² + c - optimal |c| ≈ 0.5
  if (equationId === 49) {
    return {
      radii: [0.25, 0.4, 0.6, 0.85, 1.1], // Smaller radii for |c| ≈ 0.5
      numSamples: 12,
      angleOffsets: [0, Math.PI / 5, 2 * Math.PI / 5]
    };
  }
  // Equation 50: (z² - z)² + c - optimal |c| ≈ 0.38 (very small!)
  if (equationId === 50) {
    return {
      radii: [0.15, 0.3, 0.45, 0.6, 0.8], // Very small radii for |c| ≈ 0.38
      numSamples: 14,
      angleOffsets: [0, Math.PI / 6, Math.PI / 3, Math.PI / 2] // More angles for symmetry
    };
  }
  // Trig-based equations (sin, cos, tan) - periodic behavior, sample at multiple phases
  // These often have beautiful spirals at specific c values
  if ([19, 23, 26, 27, 28, 29, 32, 34, 36].includes(equationId)) {
    return {
      radii: [0.3, 0.6, 1.0, 1.5, 2.5],
      numSamples: 12,
      angleOffsets: [0, Math.PI / 4, Math.PI / 2] // Sample at different phase angles
    };
  }
  // Equations with division or complex terms - check multiple scales
  if ([5, 9, 11, 25, 33, 44, 45].includes(equationId)) {
    return { radii: [0.5, 1.0, 1.5, 2.0], numSamples: 8 };
  }
  // Pure exponential equations - often have interesting behavior closer to origin
  if ([13, 14, 15, 20, 21, 31, 35, 40, 42, 53, 54, 56].includes(equationId)) {
    return { radii: [0.3, 0.7, 1.2], numSamples: 6 };
  }
  // Other composed/nested equations - multi-scale (22, 33, 49, 50 handled above)
  if ([41, 43, 46, 47, 48, 51, 52].includes(equationId)) {
    return { radii: [0.5, 1.0, 1.5, 2.0], numSamples: 8 };
  }
  // Default for z^2 + c and similar
  return { radii: [1.0, 1.5, 2.0], numSamples: 10 };
}

/**
 * Check if equation is trig-based (uses sin, cos, tan)
 */
function isTrigEquation(equationId: number): boolean {
  return [19, 23, 26, 27, 28, 29, 32, 34, 36].includes(equationId);
}

/**
 * Check if equation is high-power polynomial (z^n + c where n >= 3)
 */
function isHighPowerEquation(equationId: number): boolean {
  return [3, 4, 17, 57].includes(equationId);
}

/**
 * Check if equation has transformed parameter (c² or c³ instead of c)
 * These equations have shifted interesting regions in c-space
 */
function isParameterTransformedEquation(equationId: number): boolean {
  // Equation 24: z² + c³
  // Equation 30: c*z² + z*c²
  return [24, 30].includes(equationId);
}

/**
 * Get optimal magnitude for equations with shifted interesting regions
 * Returns { optimal, spread } or null if not a specialized equation
 * Each equation can have very different optimal |c| ranges!
 */
function getOptimalMagnitude(equationId: number): { optimal: number; spread: number } | null {
  switch (equationId) {
    // Equation 3: z³ + c - 3-fold symmetric, smaller |c| than expected
    case 3: return { optimal: 0.65, spread: 0.3 };
    // Equation 4: z⁴ + c - 4-fold symmetric
    case 4: return { optimal: 0.75, spread: 0.35 };
    // Equation 5: (z² + c)/(z - c) - division moderates, |c| ≈ 0.67
    case 5: return { optimal: 0.67, spread: 0.3 };
    // Equation 6: z² - z - c - subtraction shifts region to small |c|
    case 6: return { optimal: 0.4, spread: 0.25 };
    // Equation 7: z³ - z² + z + c - mixed terms balance, |c| ≈ 0.71
    case 7: return { optimal: 0.71, spread: 0.35 };
    // Equation 13: exp(z) - c - exponential creates rings, moderate |c|
    case 13: return { optimal: 0.85, spread: 0.35 };
    // Equation 17: z⁵ - z³ + z + c - high power with mixed terms
    case 17: return { optimal: 0.7, spread: 0.4 };
    // Equation 18: z³ + z + c - linear term stabilizes, |c| ≈ 0.62
    case 18: return { optimal: 0.62, spread: 0.3 };
    // Equation 22: (z² + c)² + z + c - interesting at LARGER |c| ≈ 1.1-1.3
    case 22: return { optimal: 1.15, spread: 0.4 };
    // Equation 33: (z² + c)² / (z - c) - division shifts interesting region to SMALLER |c| ≈ 0.6-0.8
    case 33: return { optimal: 0.65, spread: 0.3 };
    // Equation 49: (z³ - z²)² + c - cubic term amplifies, smaller |c|
    case 49: return { optimal: 0.5, spread: 0.35 };
    // Equation 50: (z² - z)² + c - heavy amplification, very small |c| ≈ 0.35-0.45
    case 50: return { optimal: 0.38, spread: 0.25 };
    // Equation 40: z³·exp(z) + c - exp near origin ≈ 1, so polynomial-like, |c| ≈ 0.76
    case 40: return { optimal: 0.76, spread: 0.35 };
    // Equation 54: (exp(cz) + c)² - c-scaled exp, |c| ≈ 1.0-1.05, multiple quadrants
    case 54: return { optimal: 1.02, spread: 0.35 };
    // Equation 55: z⁵ + cz³ + c - c-scaled term, |c| ≈ 0.64
    case 55: return { optimal: 0.64, spread: 0.3 };
    // Equation 57: z⁸ + c - very high power, narrow annulus
    case 57: return { optimal: 0.9, spread: 0.4 };
    default: return null;
  }
}

/**
 * Check if equation is a nested/composed equation with shifted interesting region
 */
function isNestedEquation(equationId: number): boolean {
  return getOptimalMagnitude(equationId) !== null;
}

/**
 * Sample Julia set at multiple points and radii to compute variance of escape times
 * Multi-radius sampling captures structure at different scales
 */
function computeJuliaVariance(c: Complex, maxIter: number, equationId: number): { variance: number; mixedness: number; multiScaleScore: number; escapeSpread: number } {
  const { radii, numSamples, angleOffsets } = getEquationParams(equationId);
  const allSamples: number[] = [];
  const radiusVariances: number[] = [];

  // For trig equations, also sample at different phase angles
  const offsets = angleOffsets || [0];

  for (const radius of radii) {
    const samples: number[] = [];
    for (const offset of offsets) {
      for (let i = 0; i < numSamples; i++) {
        const angle = (i / numSamples) * Math.PI * 2 + offset;
        const z = { real: Math.cos(angle) * radius, imag: Math.sin(angle) * radius };
        const escape = escapeTime(z, c, maxIter, equationId);
        samples.push(escape / maxIter);
        allSamples.push(escape / maxIter);
      }
    }

    // Compute variance for this radius
    const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
    const variance = samples.reduce((acc, val) => acc + (val - mean) ** 2, 0) / samples.length;
    radiusVariances.push(variance);
  }

  // Compute overall mean and variance
  const mean = allSamples.reduce((a, b) => a + b, 0) / allSamples.length;
  const variance = allSamples.reduce((acc, val) => acc + (val - mean) ** 2, 0) / allSamples.length;

  // Mixedness: how close to 50% escape rate (peaks when half escape, half don't)
  const mixedness = 4 * mean * (1 - mean);

  // Multi-scale score: high if there's interesting variance at multiple radii
  // This captures points with structure at different zoom levels
  const avgRadiusVariance = radiusVariances.reduce((a, b) => a + b, 0) / radiusVariances.length;
  const multiScaleScore = Math.min(1, avgRadiusVariance * 6 + (radiusVariances.filter(v => v > 0.02).length / radii.length) * 0.3);

  // Escape spread: measure how well-distributed escape times are
  // Interesting fractals have points escaping at many different iteration counts
  // Boring ones have either all-escape-quickly or all-never-escape (bimodal)
  const numBuckets = 10;
  const buckets = new Array(numBuckets).fill(0);
  for (const sample of allSamples) {
    const bucketIndex = Math.min(numBuckets - 1, Math.floor(sample * numBuckets));
    buckets[bucketIndex]++;
  }

  // Count how many buckets have samples (excluding the extremes: 0 and maxIter)
  // Middle buckets (indices 1-8) represent intermediate escape times = colorful gradients
  const middleBuckets = buckets.slice(1, numBuckets - 1);
  const occupiedMiddleBuckets = middleBuckets.filter(count => count > 0).length;
  const maxMiddleBuckets = numBuckets - 2;

  // Also check if there's meaningful distribution (not just 1-2 samples in middle)
  const middleSamples = middleBuckets.reduce((a, b) => a + b, 0);
  const middleRatio = middleSamples / allSamples.length;

  // Escape spread: combination of bucket diversity and middle-range presence
  // High value = many different escape times = colorful fractal with gradients
  const escapeSpread = (occupiedMiddleBuckets / maxMiddleBuckets) * 0.5 + middleRatio * 0.5;

  return { variance, mixedness, multiScaleScore, escapeSpread };
}


/**
 * Compute interestingness score for a point
 */
function computeInterestingness(c: Complex, maxIter: number, equationId: number): AnalysisPoint {
  const escapeIter = equationEscape(c, maxIter, equationId);
  const { variance, mixedness, multiScaleScore, escapeSpread } = computeJuliaVariance(c, maxIter, equationId);

  return {
    c,
    escapeIter,
    variance,
    mixedness,
    multiScaleScore,
    escapeSpread,
  };
}

/**
 * Score a point based on multiple heuristics
 */
function scorePoint(analysis: AnalysisPoint, maxIter: number, equationId: number): number {
  const { c, escapeIter, variance, mixedness, multiScaleScore, escapeSpread } = analysis;

  // Boundary proximity: points that escape close to maxIter/2 are on the boundary
  const normalizedIter = escapeIter / maxIter;
  const boundaryScore = 4 * normalizedIter * (1 - normalizedIter); // Peaks at 0.5

  // Variance score: high variance indicates complex structure
  const varianceScore = Math.min(1, Math.sqrt(variance) * 4);

  // Mixedness score
  const mixednessScore = mixedness;

  // Escape spread penalty: if escape times are bimodal (all quick or all never),
  // the fractal will be boring (solid color blob). We want colorful gradients.
  // Low spread = boring, high spread = colorful
  const spreadPenalty = escapeSpread < 0.15 ? 0.3 : (escapeSpread < 0.25 ? 0.6 : 1.0);

  // Adjust weights based on equation
  // For equation 1, boundary detection is very reliable (Mandelbrot set is well-understood)
  if (equationId === 1) {
    const baseScore = boundaryScore * 0.35 + varianceScore * 0.35 + mixednessScore * 0.15 + escapeSpread * 0.15;
    return Math.min(1, baseScore * spreadPenalty);
  }

  // High-power equations (z^3, z^4, z^5, z^8) have nearly circular "Mandelbrot" sets
  // The most interesting Julia sets are when |c| is close to 1 (the boundary)
  // Points too close to origin or too far away are less interesting
  if (isHighPowerEquation(equationId)) {
    const cMagnitude = Math.sqrt(c.real * c.real + c.imag * c.imag);
    // For z^n, interesting region varies by power. z^8 is around |c|≈0.8-1.1
    // z^3, z^4 is around |c|≈0.9-1.3
    const optimalMagnitude = equationId === 57 ? 0.9 : 1.1;
    const magnitudeSpread = equationId === 57 ? 0.4 : 0.5;
    // Score based on distance from optimal magnitude (Gaussian-like)
    const magnitudeScore = Math.exp(-Math.pow((cMagnitude - optimalMagnitude) / magnitudeSpread, 2));

    const boostedVariance = Math.min(1, Math.sqrt(variance) * 5);
    const baseScore =
      magnitudeScore * 0.25 +      // Reward optimal |c| magnitude
      boostedVariance * 0.25 +
      mixednessScore * 0.15 +
      multiScaleScore * 0.15 +
      escapeSpread * 0.20;
    return Math.min(1, baseScore * spreadPenalty);
  }

  // Parameter-transformed equations (z² + c³, etc.) - the c parameter is raised to a power
  // This warps the interesting region: for c³, we want |c³| in good range, so |c| = |c³|^(1/3)
  // For z² + c³: optimal |c³| ≈ 0.6-0.8 means optimal |c| ≈ 0.84-0.93
  if (isParameterTransformedEquation(equationId)) {
    const cMagnitude = Math.sqrt(c.real * c.real + c.imag * c.imag);
    // For equation 24 (z² + c³): effective param is c³, so we want |c|³ ≈ 0.5-0.8
    // which means |c| ≈ 0.79-0.93. Your point at 0.77 is close!
    // For equation 30 (c*z² + z*c²): mixed, use broader range
    const optimalMagnitude = equationId === 24 ? 0.85 : 0.9;
    const magnitudeSpread = 0.35;
    const magnitudeScore = Math.exp(-Math.pow((cMagnitude - optimalMagnitude) / magnitudeSpread, 2));

    const boostedVariance = Math.min(1, Math.sqrt(variance) * 5);
    const boostedMultiScale = Math.min(1, multiScaleScore * 1.3);
    const baseScore =
      magnitudeScore * 0.20 +      // Reward optimal |c| for transformed space
      boostedVariance * 0.25 +
      mixednessScore * 0.15 +
      boostedMultiScale * 0.20 +
      escapeSpread * 0.20;
    return Math.min(1, baseScore * spreadPenalty);
  }

  // Nested equations have equation-specific optimal |c| ranges
  // Each equation's structure shifts the interesting region differently
  const optimalMag = getOptimalMagnitude(equationId);
  if (optimalMag) {
    const cMagnitude = Math.sqrt(c.real * c.real + c.imag * c.imag);
    const magnitudeScore = Math.exp(-Math.pow((cMagnitude - optimalMag.optimal) / optimalMag.spread, 2));

    // Equation 54: points that don't escape (deep inside set) produce boring black blobs
    // Good fractals come from points NEAR the boundary in ANY quadrant
    let trappedPenalty = 1.0;
    if (equationId === 54) {
      const normalizedEscape = escapeIter / maxIter;
      if (normalizedEscape > 0.9) {
        // Point doesn't escape - likely a boring blob
        trappedPenalty = 0.2;
      } else if (normalizedEscape > 0.7) {
        // Point barely escapes - might be borderline
        trappedPenalty = 0.5;
      }
    }

    const boostedVariance = Math.min(1, Math.sqrt(variance) * 5);
    const boostedMultiScale = Math.min(1, multiScaleScore * 1.4);
    const baseScore =
      magnitudeScore * 0.25 +      // Reward equation-specific optimal |c|
      boostedVariance * 0.25 +
      mixednessScore * 0.10 +
      boostedMultiScale * 0.20 +
      escapeSpread * 0.20;
    return Math.min(1, baseScore * spreadPenalty * trappedPenalty);
  }

  // Trig equations have unique patterns - prioritize multi-scale structure and variance
  if (isTrigEquation(equationId)) {
    // Trig equations often have beautiful nested spirals when there's high variance
    // across multiple scales, even if the boundary score is low
    const boostedVariance = Math.min(1, Math.sqrt(variance) * 5); // More sensitive
    const boostedMultiScale = Math.min(1, multiScaleScore * 1.5);
    const baseScore =
      boundaryScore * 0.05 +
      boostedVariance * 0.25 +
      mixednessScore * 0.15 +
      boostedMultiScale * 0.30 +
      escapeSpread * 0.25; // Escape spread is important for colorful fractals
    return Math.min(1, baseScore * spreadPenalty);
  }

  // For other non-trig equations, use multi-scale score which captures structure at different zoom levels
  const baseScore =
    boundaryScore * 0.10 +
    varianceScore * 0.30 +
    mixednessScore * 0.20 +
    multiScaleScore * 0.20 +
    escapeSpread * 0.20;
  return Math.min(1, baseScore * spreadPenalty);
}

/**
 * Generate category and description based on analysis
 */
function categorizePoint(analysis: AnalysisPoint, maxIter: number): { category: SuggestionCategory; description: string } {
  const normalizedIter = analysis.escapeIter / maxIter;

  // Determine category based on characteristics
  // Check multi-scale score first - indicates interesting structure at multiple zoom levels
  if (analysis.multiScaleScore > 0.5) {
    return { category: 'high-variance', description: 'Multi-scale detail - spirals/fractals' };
  }
  if (analysis.variance > 0.15) {
    return { category: 'high-variance', description: 'High complexity - rich detail' };
  }
  if (analysis.mixedness > 0.8) {
    return { category: 'boundary', description: 'Boundary region - interesting transition' };
  }
  if (normalizedIter > 0.7) {
    return { category: 'boundary', description: 'Near set boundary' };
  }
  if (analysis.variance > 0.06 || analysis.multiScaleScore > 0.3) {
    return { category: 'high-variance', description: 'Complex structure detected' };
  }

  return { category: 'boundary', description: 'Potentially interesting point' };
}

/**
 * Find the most interesting points in a region using grid sampling
 */
export function findInterestingPoints(
  bounds: ViewBounds,
  gridSize: number = 20,
  maxIter: number = 100,
  topN: number = 10,
  equationId: number = 1
): SuggestedPoint[] {
  const candidates: { point: Complex; score: number; analysis: AnalysisPoint }[] = [];

  // Use finer grid for specialized equations since interesting points can be sparse
  const needsFinerGrid = isTrigEquation(equationId) || isHighPowerEquation(equationId) || isParameterTransformedEquation(equationId) || isNestedEquation(equationId);
  const effectiveGridSize = needsFinerGrid ? Math.max(gridSize, 25) : gridSize;

  const realStep = (bounds.maxReal - bounds.minReal) / effectiveGridSize;
  const imagStep = (bounds.maxImag - bounds.minImag) / effectiveGridSize;

  // Lower threshold for specialized equations - they can have subtler interesting points
  let scoreThreshold = 0.15; // default for non-equation-1
  if (equationId === 1) {
    scoreThreshold = 0.2;
  } else if (isTrigEquation(equationId) || isHighPowerEquation(equationId) || isParameterTransformedEquation(equationId) || isNestedEquation(equationId)) {
    scoreThreshold = 0.12;
  }

  // Grid search for interesting points
  for (let i = 0; i <= effectiveGridSize; i++) {
    for (let j = 0; j <= effectiveGridSize; j++) {
      const c: Complex = {
        real: bounds.minReal + i * realStep,
        imag: bounds.minImag + j * imagStep,
      };

      const analysis = computeInterestingness(c, maxIter, equationId);
      const score = scorePoint(analysis, maxIter, equationId);

      // Only consider points with meaningful scores
      if (score > scoreThreshold) {
        candidates.push({ point: c, score, analysis });
      }
    }
  }

  // Sort by score descending
  candidates.sort((a, b) => b.score - a.score);

  // Remove nearby duplicates (keep highest scoring)
  const filtered: typeof candidates = [];
  const minDistance = Math.min(realStep, imagStep) * 2;

  for (const candidate of candidates) {
    const tooClose = filtered.some(f => {
      const dist = Math.sqrt(
        (f.point.real - candidate.point.real) ** 2 +
        (f.point.imag - candidate.point.imag) ** 2
      );
      return dist < minDistance;
    });

    if (!tooClose) {
      filtered.push(candidate);
      if (filtered.length >= topN) break;
    }
  }

  // Convert to SuggestedPoint format
  return filtered.map((f, index) => {
    const { category, description } = categorizePoint(f.analysis, maxIter);
    return {
      id: `suggestion-${index}-${f.point.real.toFixed(6)}-${f.point.imag.toFixed(6)}`,
      point: f.point,
      score: f.score,
      category,
      description,
    };
  });
}

/**
 * Get classic Julia points that fall within the given bounds
 * Only returns points for equation 1 (z² + c)
 */
export function getClassicPointsInBounds(bounds: ViewBounds, equationId: number): SuggestedPoint[] {
  // Classic points only apply to equation 1
  if (equationId !== 1) return [];

  return CLASSIC_POINTS
    .filter(cp =>
      cp.point.real >= bounds.minReal && cp.point.real <= bounds.maxReal &&
      cp.point.imag >= bounds.minImag && cp.point.imag <= bounds.maxImag
    )
    .map((cp, index) => ({
      id: `classic-${index}-${cp.name.replace(/\s/g, '-').toLowerCase()}`,
      point: cp.point,
      score: 0.95, // Classic points get high base score
      category: 'classic' as SuggestionCategory,
      description: cp.name,
    }));
}

/**
 * Get all suggestions for a region, combining classic points and discovered points
 */
export function getSuggestions(
  bounds: ViewBounds,
  maxIter: number = 100,
  includeClassic: boolean = true,
  equationId: number = 1,
  isExpensiveEquation: boolean = false
): SuggestedPoint[] {
  const suggestions: SuggestedPoint[] = [];

  // Add classic points in view (only for equation 1)
  if (includeClassic && equationId === 1) {
    suggestions.push(...getClassicPointsInBounds(bounds, equationId));
  }

  // Reduce grid size for expensive equations to avoid hanging
  const gridSize = isExpensiveEquation ? 12 : 20;

  // Find interesting points via analysis using the actual equation
  const discovered = findInterestingPoints(bounds, gridSize, maxIter, 15, equationId);

  // Add discovered points, avoiding duplicates near classic points
  for (const point of discovered) {
    const nearClassic = suggestions.some(s => {
      const dist = Math.sqrt(
        (s.point.real - point.point.real) ** 2 +
        (s.point.imag - point.point.imag) ** 2
      );
      return dist < 0.05;
    });

    if (!nearClassic) {
      suggestions.push(point);
    }
  }

  // Sort all by score
  suggestions.sort((a, b) => b.score - a.score);

  // Return top suggestions
  return suggestions.slice(0, 12);
}

/**
 * Get suggestion category color for UI
 */
export function getCategoryColor(category: SuggestionCategory): string {
  switch (category) {
    case 'classic': return '#ec4899';      // pink
    case 'boundary': return '#f59e0b';     // amber
    case 'high-variance': return '#f97316'; // orange
    default: return '#6b7280';             // gray
  }
}

/**
 * Get suggestion category icon name
 */
export function getCategoryIcon(category: SuggestionCategory): string {
  switch (category) {
    case 'classic': return '★';
    case 'boundary': return '◐';
    case 'high-variance': return '◆';
    default: return '•';
  }
}
