// Web Worker for parallel fractal rendering
// This worker renders a horizontal strip of the fractal

interface Complex {
  real: number;
  imag: number;
}

interface RenderMessage {
  type: 'render';
  id: number;
  startY: number;
  endY: number;
  width: number;
  height: number;
  bounds: {
    minReal: number;
    maxReal: number;
    minImag: number;
    maxImag: number;
  };
  maxIterations: number;
  fractalType: 'mandelbrot' | 'julia';
  juliaC?: Complex;
  equationId: number;
  palette?: number[];  // Flat array of RGB values (0-1), 64 colors = 192 values
  colorOffset?: number;  // Color offset for palette cycling (0-1)
  antiAlias?: number;  // Anti-aliasing samples per axis (1=off, 2=4x, 3=9x)
}

type WorkerMessage = RenderMessage;

// Complex number operations
function cMul(a: Complex, b: Complex): Complex {
  return { real: a.real * b.real - a.imag * b.imag, imag: a.real * b.imag + a.imag * b.real };
}

function cDiv(a: Complex, b: Complex): Complex {
  const denom = b.real * b.real + b.imag * b.imag;
  return {
    real: (a.real * b.real + a.imag * b.imag) / denom,
    imag: (a.imag * b.real - a.real * b.imag) / denom,
  };
}

function cExp(z: Complex): Complex {
  const er = Math.exp(z.real);
  return { real: er * Math.cos(z.imag), imag: er * Math.sin(z.imag) };
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
  return { real: Math.sin(z.real) * Math.cosh(z.imag), imag: Math.cos(z.real) * Math.sinh(z.imag) };
}

function cCos(z: Complex): Complex {
  return { real: Math.cos(z.real) * Math.cosh(z.imag), imag: -Math.sin(z.real) * Math.sinh(z.imag) };
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

function applyEquation(z: Complex, c: Complex, eq: number): Complex {
  const one: Complex = { real: 1, imag: 0 };
  const half: Complex = { real: 0.5, imag: 0 };

  switch (eq) {
    case 1: return cAdd(cMul(z, z), c);
    case 2: return cAdd(cMul(cMul(z, z), z), c);
    case 3: return cAdd(cMul(cMul(cMul(z, z), z), z), c);
    case 4: return cAdd(cMul(cMul(cMul(cMul(z, z), z), z), z), c);
    case 5: return cDiv(cAdd(cMul(z, z), c), cSub(z, c));
    case 6: return cSub(cMul(z, z), cAdd(z, c));
    case 7: return cAdd(cAdd(cSub(cMul(cMul(z, z), z), cMul(z, z)), z), c);
    case 8: return cSub(cMul(cAdd(one, c), z), cMul(c, cMul(z, z)));
    case 9: return cDiv(cMul(cMul(z, z), z), cAdd(one, cMul(c, cMul(z, z))));
    case 10: return cAdd(cMul(cMul(cSub(z, one), cAdd(z, half)), cSub(cMul(z, z), one)), c);
    case 11: return cDiv(cAdd(cAdd(cMul(z, z), one), c), cSub(cSub(cMul(z, z), one), c));
    case 12: return cAdd(cPow(z, 1.5), c);
    case 13: return cSub(cExp(z), c);
    case 14: return cAdd(cAdd(cSub(cPow(z, 3), half), cMul(c, cExp(cScale(z, -1)))), { real: 0, imag: 0 });
    case 15: return cAdd(cSub(cMul(c, z), one), cMul(c, cExp(cScale(z, -1))));
    case 16: return cDiv(cAdd(cScale(cPow(z, 5), 4), c), cScale(cPow(z, 4), 5));
    case 17: return cAdd(cAdd(cSub(cPow(z, 5), cMul(cMul(z, z), z)), z), c);
    case 18: return cAdd(cAdd(cMul(cMul(z, z), z), z), c);
    case 19: return cAdd(cAdd(cScale(z, 2 * Math.sin(z.real)), cScale(cMul(c, z), Math.cos(z.imag))), c);
    case 20: return cAdd(cMul(z, cExp(cScale(z, -1))), c);
    case 21: return cAdd(cMul(c, cExp(cScale(z, -1))), cMul(z, z));
    case 22: { const t = cAdd(cMul(z, z), c); return cAdd(cAdd(cMul(t, t), z), c); }
    case 23: { const t = cAdd(z, cSin(z)); return cAdd(cMul(t, t), c); }
    case 24: return cAdd(cMul(z, z), cMul(cMul(c, c), c));
    case 25: return cDiv(cAdd(cMul(z, z), c), cSub(cSub(cMul(z, z), one), c));
    case 26: return cAdd(cAdd(cScale(cMul(z, z), Math.cos(z.imag)), cScale(cMul(c, z), Math.sin(z.real))), c);
    case 27: return cAdd(cAdd(cScale(cMul(z, z), Math.cos(z.real)), cScale(cMul(c, z), Math.sin(z.imag))), c);
    case 28: { const m = cMag(z); return cAdd(cAdd(cScale(cMul(z, z), Math.cos(m)), cScale(cMul(c, z), Math.sin(m))), c); }
    case 29: { const z2 = cMul(z, z); return cAdd(cMul(cSin(z2), cTan(z2)), c); }
    case 30: return cAdd(cMul(c, cMul(z, z)), cMul(z, cMul(c, c)));
    case 31: return cExp(cSin(cMul(c, z)));
    case 32: return cMul(c, cAdd(cSin(z), cCos(z)));
    case 33: { const t = cAdd(cMul(z, z), c); return cDiv(cMul(t, t), cSub(z, c)); }
    case 34: return cMul(cMul(c, cAdd(cSin(z), cCos(z))), cAdd(cAdd(cPow(z, 3), z), c));
    case 35: return cMul(cMul(c, cExp(z)), cCos(cMul(c, z)));
    case 36: return cMul(cMul(cAdd(cAdd(cMul(cMul(z, z), z), z), c), c), cAdd(cSin(z), cCos(z)));
    case 37: return cAdd(cAdd(cSub(one, cMul(z, z)), cDiv(cPow(z, 4), cAdd({ real: 2, imag: 0 }, cScale(z, 4)))), c);
    case 38: return cAdd(cAdd(cMul(z, z), cPow(z, 1.5)), c);
    case 39: return cAdd(cAdd(cSub(one, cMul(z, z)), cDiv(cPow(z, 5), cAdd({ real: 2, imag: 0 }, cScale(z, 4)))), c);
    case 40: return cAdd(cMul(cMul(cMul(z, z), z), cExp(z)), c);
    case 41: { const t = cAdd(z, cSin(z)); return cAdd(cAdd(cAdd(cMul(t, t), cMul(c, cExp(cScale(z, -1)))), cMul(z, z)), c); }
    case 42: return cSub(cAdd(cDiv(cMul(cMul(z, z), z), cAdd(one, cMul(c, cMul(z, z)))), cExp(z)), c);
    case 43: { const t = cAdd(z, cSin(z)); return cAdd(cAdd(cMul(t, t), cMul(c, cExp(z))), c); }
    case 44: return cDiv(cAdd(cMul(cMul(z, z), z), c), cMul(z, z));
    case 45: return cDiv(cAdd(cMul(cMul(z, z), z), c), z);
    case 46: { const t = cSub(z, cSqrt(z)); return cAdd(cMul(t, t), c); }
    case 47: { const t = cAdd(z, c); return cAdd(cMul(t, t), t); }
    case 48: { const t = cAdd(z, c); return cSub(cPow(t, 3), cMul(t, t)); }
    case 49: { const t = cSub(cMul(cMul(z, z), z), cMul(z, z)); return cAdd(cMul(t, t), c); }
    case 50: { const t = cSub(cMul(z, z), z); return cAdd(cMul(t, t), c); }
    case 51: { const t = cSub(z, cSqrt(z)); return cAdd(cMul(t, t), c); }
    case 52: { const t = cAdd(cMul(z, z), cSqrt(z)); return cAdd(cMul(t, t), c); }
    case 53: { const ez = cExp(z); return cAdd(cSub(cMul(cMul(z, z), ez), cMul(z, ez)), c); }
    case 54: { const t = cAdd(cExp(cMul(c, z)), c); return cMul(t, t); }
    case 55: return cAdd(cAdd(cPow(z, 5), cMul(c, cPow(z, 3))), c);
    case 56: return cExp(cAdd(cMul(z, z), c));
    case 57: return cAdd(cPow(z, 8), c);
    default: return cAdd(cMul(z, z), c);
  }
}

function hsv2rgb(h: number, s: number, v: number): [number, number, number] {
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);

  switch (i % 6) {
    case 0: return [v, t, p];
    case 1: return [q, v, p];
    case 2: return [p, v, t];
    case 3: return [p, q, v];
    case 4: return [t, p, v];
    case 5: return [v, p, q];
    default: return [0, 0, 0];
  }
}

function getColor(t: number): [number, number, number] {
  if (t >= 1) return [0, 0, 0];

  const hue = (t * 5) % 1;
  const saturation = 0.7 + 0.3 * Math.sin(t * Math.PI);
  const value = 0.5 + 0.5 * Math.cos(t * Math.PI * 2);

  return hsv2rgb(hue, saturation, value);
}

// Get color from palette using interpolation
// Palette is a flat array of RGB values (0-1), 64 colors = 192 values
// Uses same formula as GPU: fract(t * 3.0 + colorOffset) * (paletteSize - 1)
function getPaletteColor(t: number, palette: number[], colorOffset: number): [number, number, number] {
  if (t >= 1) return [0, 0, 0];

  const paletteSize = palette.length / 3;
  if (paletteSize === 0) return getColor(t); // Fallback

  // Match GPU formula: fract(t * 3.0 + u_colorOffset) * (paletteSize - 1)
  const palettePos = ((t * 3.0 + colorOffset) % 1) * (paletteSize - 1);
  const index = Math.floor(palettePos);
  const blend = palettePos - index;

  const i1 = Math.min(index, paletteSize - 1) * 3;
  const i2 = Math.min(index + 1, paletteSize - 1) * 3;

  // Linear interpolation between adjacent palette colors
  const r = palette[i1] + (palette[i2] - palette[i1]) * blend;
  const g = palette[i1 + 1] + (palette[i2 + 1] - palette[i1 + 1]) * blend;
  const b = palette[i1 + 2] + (palette[i2 + 2] - palette[i1 + 2]) * blend;

  return [r, g, b];
}

// Check if point is in main cardioid or period-2 bulb (definitely in set)
function inCardioidOrBulb(cReal: number, cImag: number): boolean {
  // Check main cardioid: |1 - sqrt(1-4c)| <= 1
  // Simplified: q = (x - 1/4)² + y², q(q + (x - 1/4)) <= y²/4
  const x = cReal - 0.25;
  const y2 = cImag * cImag;
  const q = x * x + y2;
  if (q * (q + x) <= 0.25 * y2) return true;

  // Check period-2 bulb: (x + 1)² + y² <= 1/16
  const x1 = cReal + 1;
  if (x1 * x1 + y2 <= 0.0625) return true;

  return false;
}

// Compute a single sample point and return RGB color (0-1)
function computeSample(
  pointReal: number,
  pointImag: number,
  fractalType: 'mandelbrot' | 'julia',
  jcReal: number,
  jcImag: number,
  equationId: number,
  maxIterations: number,
  palette: number[] | undefined,
  colorOffset: number
): [number, number, number] {
  let zReal: number;
  let zImag: number;
  let cReal: number;
  let cImag: number;

  if (fractalType === 'mandelbrot') {
    zReal = 0;
    zImag = 0;
    cReal = pointReal;
    cImag = pointImag;

    // Fast path: skip iteration if in cardioid or bulb
    if (inCardioidOrBulb(cReal, cImag)) {
      return [0, 0, 0];
    }
  } else {
    zReal = pointReal;
    zImag = pointImag;
    cReal = jcReal;
    cImag = jcImag;
  }

  let iterations = 0;

  // For periodicity detection
  let oldReal = 0;
  let oldImag = 0;
  let period = 0;
  const checkPeriod = 20;

  // Use standard equation (z² + c) for Mandelbrot, or equation 1 for Julia
  const useStandardEquation = fractalType === 'mandelbrot' || equationId === 1;

  if (useStandardEquation) {
    // Optimized loop using primitives only
    while (iterations < maxIterations) {
      const zReal2 = zReal * zReal;
      const zImag2 = zImag * zImag;

      if (zReal2 + zImag2 > 4) break;

      const newReal = zReal2 - zImag2 + cReal;
      const newImag = 2 * zReal * zImag + cImag;
      zReal = newReal;
      zImag = newImag;
      iterations++;

      // Periodicity checking
      if (zReal === oldReal && zImag === oldImag) {
        iterations = maxIterations;
        break;
      }

      period++;
      if (period > checkPeriod) {
        period = 0;
        oldReal = zReal;
        oldImag = zImag;
      }
    }
  } else {
    // Complex equations
    let z: Complex = { real: zReal, imag: zImag };
    const c: Complex = { real: cReal, imag: cImag };

    while (iterations < maxIterations && z.real * z.real + z.imag * z.imag <= 4) {
      z = applyEquation(z, c, equationId);
      iterations++;
    }

    zReal = z.real;
    zImag = z.imag;
  }

  if (iterations >= maxIterations) {
    return [0, 0, 0];
  } else {
    const zMag2 = zReal * zReal + zImag * zImag;
    const logZn = 0.5 * Math.log(zMag2);
    const nu = Math.log(logZn / Math.LN2) / Math.LN2;
    const smoothIter = iterations + 1 - nu;
    const t = smoothIter / maxIterations;

    return palette ? getPaletteColor(t, palette, colorOffset) : getColor(t);
  }
}

function renderStrip(msg: RenderMessage): Uint8ClampedArray {
  const { startY, endY, width, height, bounds, maxIterations, fractalType, juliaC, equationId, palette, colorOffset, antiAlias } = msg;

  const stripHeight = endY - startY;
  const data = new Uint8ClampedArray(width * stripHeight * 4);

  const realRange = bounds.maxReal - bounds.minReal;
  const imagRange = bounds.maxImag - bounds.minImag;

  // Precompute scale factors
  const realScale = realRange / width;
  const imagScale = imagRange / height;

  // Default Julia constant
  const jcReal = juliaC?.real ?? -0.7;
  const jcImag = juliaC?.imag ?? 0.27015;

  // Default color offset
  const offset = colorOffset ?? 0;

  // Anti-aliasing setup
  const aa = antiAlias ?? 1;
  const aaSamples = aa * aa;
  const aaStep = 1 / aa;

  for (let py = startY; py < endY; py++) {
    const localY = py - startY;

    for (let px = 0; px < width; px++) {
      const idx = (localY * width + px) * 4;

      let r = 0, g = 0, b = 0;

      if (aa === 1) {
        // No anti-aliasing - single sample
        const pointReal = bounds.minReal + (px + 0.5) * realScale;
        const pointImag = bounds.maxImag - (py + 0.5) * imagScale;
        const color = computeSample(pointReal, pointImag, fractalType, jcReal, jcImag, equationId, maxIterations, palette, offset);
        r = color[0];
        g = color[1];
        b = color[2];
      } else {
        // Multi-sample anti-aliasing
        for (let sy = 0; sy < aa; sy++) {
          for (let sx = 0; sx < aa; sx++) {
            const subX = px + (sx + 0.5) * aaStep;
            const subY = py + (sy + 0.5) * aaStep;
            const pointReal = bounds.minReal + subX * realScale;
            const pointImag = bounds.maxImag - subY * imagScale;
            const color = computeSample(pointReal, pointImag, fractalType, jcReal, jcImag, equationId, maxIterations, palette, offset);
            r += color[0];
            g += color[1];
            b += color[2];
          }
        }
        // Average the samples
        r /= aaSamples;
        g /= aaSamples;
        b /= aaSamples;
      }

      data[idx] = (r * 255) | 0;
      data[idx + 1] = (g * 255) | 0;
      data[idx + 2] = (b * 255) | 0;
      data[idx + 3] = 255;
    }
  }

  return data;
}

// Worker message handler
self.onmessage = (event: MessageEvent<WorkerMessage>) => {
  const msg = event.data;

  if (msg.type === 'render') {
    const data = renderStrip(msg);

    // Transfer the buffer back to main thread
    self.postMessage({
      type: 'result',
      id: msg.id,
      startY: msg.startY,
      endY: msg.endY,
      data: data
    }, { transfer: [data.buffer] });
  }
};

export {}; // Make this a module
