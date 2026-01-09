import type { FractalType, ViewBounds, Complex, Camera3D, MandelbulbParams } from '../types';

// Schema version for future compatibility
const SCHEMA_VERSION = 1;

// Fractal type abbreviations for compact URLs
const FRACTAL_TYPE_MAP: Record<string, FractalType> = {
  'm': 'mandelbrot',
  'j': 'julia',
  'h': 'heatmap',
  'b': 'mandelbulb'
};

const FRACTAL_TYPE_ABBREV: Record<FractalType, string> = {
  'mandelbrot': 'm',
  'julia': 'j',
  'heatmap': 'h',
  'mandelbulb': 'b'
};

/**
 * State that can be shared via URL
 */
export interface ShareableState {
  version: number;
  fractalType: FractalType;
  viewBounds: ViewBounds;
  equationId: number;
  juliaConstant: Complex;
  juliaZoomFactor: number;
  maxIterations: number;
  currentPaletteId: string;
  colorTemperature: number;
  // 3D specific (optional)
  camera3D?: Camera3D;
  mandelbulbParams?: MandelbulbParams;
  equation3dId?: number;
}

/**
 * Encode shareable state to URL hash string
 */
export function encodeStateToHash(state: ShareableState): string {
  const params = new URLSearchParams();

  // Version for future compatibility
  params.set('v', SCHEMA_VERSION.toString());

  // Fractal type (abbreviated)
  params.set('t', FRACTAL_TYPE_ABBREV[state.fractalType]);

  // View bounds with full precision for deep zooms
  // Using underscore separator to avoid URL encoding issues
  const b = `${state.viewBounds.minReal}_${state.viewBounds.maxReal}_${state.viewBounds.minImag}_${state.viewBounds.maxImag}`;
  params.set('b', b);

  // Equation ID
  params.set('e', state.equationId.toString());

  // Julia constant
  params.set('c', `${state.juliaConstant.real}_${state.juliaConstant.imag}`);

  // Julia zoom factor
  params.set('z', state.juliaZoomFactor.toString());

  // Iterations
  params.set('i', state.maxIterations.toString());

  // Palette
  params.set('p', state.currentPaletteId);

  // Color temperature
  params.set('ct', state.colorTemperature.toString());

  // 3D params (only if mandelbulb)
  if (state.fractalType === 'mandelbulb' && state.camera3D && state.mandelbulbParams) {
    const cam = `${state.camera3D.distance}_${state.camera3D.rotationX}_${state.camera3D.rotationY}_${state.camera3D.fov}`;
    params.set('3d', cam);
    // Include scale and minRadius for full state sharing
    const p = state.mandelbulbParams;
    params.set('3p', `${p.power}_${p.bailout}_${p.scale ?? 2.0}_${p.minRadius ?? 0.5}`);
    // 3D equation ID
    if (state.equation3dId !== undefined) {
      params.set('3e', state.equation3dId.toString());
    }
  }

  return params.toString();
}

/**
 * Decode URL hash to shareable state
 * Returns null if hash is empty or completely invalid
 * Returns partial state with only valid properties
 */
export function decodeHashToState(hash: string): Partial<ShareableState> | null {
  if (!hash || hash === '#') return null;

  // Remove leading # if present
  const cleanHash = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!cleanHash) return null;

  try {
    const params = new URLSearchParams(cleanHash);
    const state: Partial<ShareableState> = {};

    // Version (for future migration support)
    const version = parseInt(params.get('v') || '1', 10);
    state.version = isNaN(version) ? 1 : version;

    // Fractal type
    const typeAbbrev = params.get('t');
    if (typeAbbrev && typeAbbrev in FRACTAL_TYPE_MAP) {
      state.fractalType = FRACTAL_TYPE_MAP[typeAbbrev];
    }

    // View bounds
    const boundsStr = params.get('b');
    if (boundsStr) {
      const parts = boundsStr.split('_').map(parseFloat);
      if (parts.length === 4 && parts.every(n => !isNaN(n) && isFinite(n))) {
        const [minReal, maxReal, minImag, maxImag] = parts;
        // Validate bounds make sense
        if (minReal < maxReal && minImag < maxImag) {
          state.viewBounds = { minReal, maxReal, minImag, maxImag };
        }
      }
    }

    // Equation ID
    const eqId = params.get('e');
    if (eqId) {
      const parsed = parseInt(eqId, 10);
      if (!isNaN(parsed) && parsed > 0) {
        state.equationId = parsed;
      }
    }

    // Julia constant
    const constStr = params.get('c');
    if (constStr) {
      const parts = constStr.split('_').map(parseFloat);
      if (parts.length === 2 && parts.every(n => !isNaN(n) && isFinite(n))) {
        state.juliaConstant = { real: parts[0], imag: parts[1] };
      }
    }

    // Zoom factor
    const zoom = params.get('z');
    if (zoom) {
      const parsed = parseFloat(zoom);
      if (!isNaN(parsed) && isFinite(parsed) && parsed > 0) {
        state.juliaZoomFactor = parsed;
      }
    }

    // Iterations
    const iter = params.get('i');
    if (iter) {
      const parsed = parseInt(iter, 10);
      if (!isNaN(parsed) && parsed > 0 && parsed <= 10000) {
        state.maxIterations = parsed;
      }
    }

    // Palette
    const palette = params.get('p');
    if (palette) {
      state.currentPaletteId = palette;
    }

    // Color temperature
    const temp = params.get('ct');
    if (temp) {
      const parsed = parseFloat(temp);
      if (!isNaN(parsed) && parsed >= -1 && parsed <= 1) {
        state.colorTemperature = parsed;
      }
    }

    // 3D camera
    const cam3d = params.get('3d');
    if (cam3d) {
      const parts = cam3d.split('_').map(parseFloat);
      if (parts.length === 4 && parts.every(n => !isNaN(n) && isFinite(n))) {
        state.camera3D = {
          distance: parts[0],
          rotationX: parts[1],
          rotationY: parts[2],
          fov: parts[3]
        };
      }
    }

    // 3D params (support both old 2-param and new 4-param formats)
    const params3d = params.get('3p');
    if (params3d) {
      const parts = params3d.split('_').map(parseFloat);
      if (parts.length >= 2 && parts.slice(0, 2).every(n => !isNaN(n) && isFinite(n))) {
        state.mandelbulbParams = {
          power: parts[0],
          bailout: parts[1],
          scale: parts[2] ?? 2.0,      // Default for backwards compatibility
          minRadius: parts[3] ?? 0.5   // Default for backwards compatibility
        };
      }
    }

    // 3D equation ID
    const eq3d = params.get('3e');
    if (eq3d) {
      const parsed = parseInt(eq3d, 10);
      if (!isNaN(parsed) && parsed > 0 && parsed <= 8) {
        state.equation3dId = parsed;
      }
    }

    // Only return state if we got at least some valid properties
    if (Object.keys(state).length > 1) { // More than just version
      return state;
    }
    return null;
  } catch (e) {
    console.warn('Failed to parse URL hash:', e);
    return null;
  }
}

/**
 * Generate shareable URL from current state
 */
export function generateShareUrl(state: ShareableState): string {
  const hash = encodeStateToHash(state);
  return `${window.location.origin}${window.location.pathname}#${hash}`;
}

/**
 * Copy text to clipboard with fallback for older browsers
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for older browsers or when clipboard API is not available
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    textarea.style.pointerEvents = 'none';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      return true;
    } catch {
      return false;
    } finally {
      document.body.removeChild(textarea);
    }
  }
}
