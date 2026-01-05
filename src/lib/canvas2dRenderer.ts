import type { ViewBounds, Complex, FractalType } from '../types';
import { getWorkerPool } from './workerPool';

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

function getColor(t: number, colorOffset: number): [number, number, number] {
  if (t >= 1) return [0, 0, 0];

  const hue = (t * 5 + colorOffset) % 1;
  const saturation = 0.7 + 0.3 * Math.sin(t * Math.PI);
  const value = 0.5 + 0.5 * Math.cos(t * Math.PI * 2);

  return hsv2rgb(hue, saturation, value);
}

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

export function renderCanvas2D(
  ctx: CanvasRenderingContext2D,
  bounds: ViewBounds,
  maxIterations: number,
  colorOffset: number = 0,
  fractalType: FractalType = 'mandelbrot',
  juliaC?: Complex,
  equationId: number = 1
): void {
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;
  const imageData = ctx.createImageData(width, height);
  const data = imageData.data;

  const realRange = bounds.maxReal - bounds.minReal;
  const imagRange = bounds.maxImag - bounds.minImag;

  for (let py = 0; py < height; py++) {
    for (let px = 0; px < width; px++) {
      const pointReal = bounds.minReal + (px / width) * realRange;
      const pointImag = bounds.maxImag - (py / height) * imagRange;

      let z: Complex;
      let c: Complex;

      if (fractalType === 'mandelbrot') {
        z = { real: 0, imag: 0 };
        c = { real: pointReal, imag: pointImag };
      } else {
        z = { real: pointReal, imag: pointImag };
        c = juliaC || { real: -0.7, imag: 0.27015 };
      }

      let iterations = 0;

      while (iterations < maxIterations && z.real * z.real + z.imag * z.imag <= 4) {
        if (fractalType === 'mandelbrot') {
          const newReal = z.real * z.real - z.imag * z.imag + c.real;
          const newImag = 2 * z.real * z.imag + c.imag;
          z = { real: newReal, imag: newImag };
        } else {
          z = applyEquation(z, c, equationId);
        }
        iterations++;
      }

      const idx = (py * width + px) * 4;

      if (iterations >= maxIterations) {
        data[idx] = 0;
        data[idx + 1] = 0;
        data[idx + 2] = 0;
        data[idx + 3] = 255;
      } else {
        const zMag = Math.sqrt(z.real * z.real + z.imag * z.imag);
        const smoothIter = iterations + 1 - Math.log(Math.log(zMag) / Math.log(2)) / Math.log(2);
        const t = smoothIter / maxIterations;
        const [r, g, b] = getColor(t, colorOffset);

        data[idx] = Math.floor(r * 255);
        data[idx + 1] = Math.floor(g * 255);
        data[idx + 2] = Math.floor(b * 255);
        data[idx + 3] = 255;
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);
}

// Render request ID for cancellation
let currentRenderId = 0;

/**
 * Parallel canvas 2D rendering using Web Workers
 * Returns a promise that resolves when rendering is complete
 */
export async function renderCanvas2DParallel(
  ctx: CanvasRenderingContext2D,
  bounds: ViewBounds,
  maxIterations: number,
  colorOffset: number = 0,
  fractalType: FractalType = 'mandelbrot',
  juliaC?: Complex,
  equationId: number = 1,
  onProgress?: (progress: number) => void,
  palette?: number[],
  antiAlias: number = 1
): Promise<void> {
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;

  // Increment render ID to cancel previous render
  const renderId = ++currentRenderId;

  try {
    const pool = getWorkerPool();

    const imageData = await pool.render({
      width,
      height,
      bounds,
      maxIterations,
      fractalType,
      juliaC,
      equationId,
      palette,
      colorOffset,
      antiAlias,
      onProgress: (completed, total) => {
        // Check if this render was cancelled
        if (renderId !== currentRenderId) return;
        onProgress?.(completed / total);
      }
    });

    // Check if this render was cancelled before drawing
    if (renderId !== currentRenderId) return;

    ctx.putImageData(imageData, 0, 0);
  } catch (error) {
    // Silently fail if render was cancelled
    if (renderId !== currentRenderId) return;
    console.error('Parallel render failed:', error);
    // Fall back to synchronous render
    renderCanvas2D(ctx, bounds, maxIterations, colorOffset, fractalType, juliaC, equationId);
  }
}
