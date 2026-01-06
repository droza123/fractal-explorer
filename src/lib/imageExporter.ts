import type { ViewBounds, Complex, Camera3D, MandelbulbParams, LightingParams, RenderQuality, ExportSettings, ExportProgress, FractalType } from '../types';
import { WebGLRenderer } from '../webgl/renderer';
import { PRESET_PALETTES, generateShaderPalette, applyTemperatureToPalette } from './colors';
import type { RGB } from './colors';

// Maximum tile size to avoid GPU memory issues
const MAX_TILE_SIZE = 2048;

export interface ExportOptions {
  fractalType: FractalType;
  viewBounds: ViewBounds;
  juliaConstant: Complex;
  equationId: number;
  maxIterations: number;
  paletteId: string;
  colorTemperature: number;
  customPalettes: { id: string; name: string; colors: RGB[] }[];
  exportSettings: ExportSettings;
  camera3D: Camera3D;
  mandelbulbParams: MandelbulbParams;
  lightingParams: LightingParams;
  renderQuality: RenderQuality;
  onProgress: (progress: ExportProgress) => void;
  abortSignal: AbortSignal;
}

function checkAborted(signal: AbortSignal): void {
  if (signal.aborted) {
    const error = new Error('Export cancelled');
    error.name = 'AbortError';
    throw error;
  }
}

function getWebGLMaxTextureSize(): number {
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl2');
  if (!gl) return 4096; // Default fallback
  const maxSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
  return maxSize || 4096;
}

function supportsWebP(): boolean {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  return canvas.toDataURL('image/webp').startsWith('data:image/webp');
}

function calculateTileGrid(width: number, height: number): { cols: number; rows: number; tileWidth: number; tileHeight: number } {
  const cols = Math.ceil(width / MAX_TILE_SIZE);
  const rows = Math.ceil(height / MAX_TILE_SIZE);
  const tileWidth = Math.ceil(width / cols);
  const tileHeight = Math.ceil(height / rows);
  return { cols, rows, tileWidth, tileHeight };
}

function getTileBounds(
  viewBounds: ViewBounds,
  col: number,
  row: number,
  _cols: number,
  _rows: number,
  tileWidth: number,
  tileHeight: number,
  totalWidth: number,
  totalHeight: number
): ViewBounds {
  const realRange = viewBounds.maxReal - viewBounds.minReal;
  const imagRange = viewBounds.maxImag - viewBounds.minImag;

  // Calculate the portion of the complex plane this tile covers
  const x1 = col * tileWidth;
  const y1 = row * tileHeight;
  const x2 = Math.min((col + 1) * tileWidth, totalWidth);
  const y2 = Math.min((row + 1) * tileHeight, totalHeight);

  return {
    minReal: viewBounds.minReal + (x1 / totalWidth) * realRange,
    maxReal: viewBounds.minReal + (x2 / totalWidth) * realRange,
    // Y is inverted (top of canvas is maxImag)
    minImag: viewBounds.maxImag - (y2 / totalHeight) * imagRange,
    maxImag: viewBounds.maxImag - (y1 / totalHeight) * imagRange,
  };
}

// Helper to get palette colors by ID
function getPaletteColors(paletteId: string, customPalettes: { id: string; colors: RGB[] }[]): RGB[] {
  // Check custom palettes first
  const customPalette = customPalettes.find(p => p.id === paletteId);
  if (customPalette) {
    return customPalette.colors;
  }

  // Check preset palettes
  const presetPalette = PRESET_PALETTES.find(p => p.id === paletteId);
  if (presetPalette) {
    return presetPalette.colors;
  }

  // Default fallback
  return PRESET_PALETTES[0].colors;
}

async function render2DTiled(
  options: ExportOptions,
  outputCanvas: HTMLCanvasElement
): Promise<void> {
  const { exportSettings, viewBounds, juliaConstant, equationId, maxIterations,
          paletteId, colorTemperature, customPalettes, fractalType, onProgress, abortSignal } = options;

  const { width, height } = exportSettings;
  const { cols, rows, tileWidth, tileHeight } = calculateTileGrid(width, height);
  const totalTiles = cols * rows;

  // Create tile canvas for rendering
  const tileCanvas = document.createElement('canvas');

  // Get output context for compositing
  const outputCtx = outputCanvas.getContext('2d');
  if (!outputCtx) {
    throw new Error('Failed to get 2D context for output canvas');
  }

  // Create WebGL renderer for tile canvas
  const renderer = new WebGLRenderer(tileCanvas);
  if (!renderer.isAvailable()) {
    throw new Error('WebGL is not available for export');
  }
  renderer.setFractalType(fractalType);

  // Set up palette
  const paletteColors = getPaletteColors(paletteId, customPalettes);
  const adjustedPalette = applyTemperatureToPalette(paletteColors, colorTemperature);
  const shaderPalette = generateShaderPalette(adjustedPalette);
  renderer.setPalette(shaderPalette);

  try {
    let currentTile = 0;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        checkAborted(abortSignal);

        // Calculate actual tile dimensions (may be smaller at edges)
        const actualTileWidth = Math.min(tileWidth, width - col * tileWidth);
        const actualTileHeight = Math.min(tileHeight, height - row * tileHeight);

        // Resize tile canvas
        tileCanvas.width = actualTileWidth;
        tileCanvas.height = actualTileHeight;

        // Calculate bounds for this tile
        const tileBounds = getTileBounds(
          viewBounds, col, row, cols, rows,
          tileWidth, tileHeight, width, height
        );

        // Report progress
        onProgress({
          phase: 'rendering',
          currentTile: currentTile + 1,
          totalTiles,
          percent: Math.round((currentTile / totalTiles) * 90),
        });

        // Render the tile - use high anti-aliasing for export quality
        const colorOffset = 0;
        const antiAlias = 3; // 9x AA for export quality

        if (fractalType === 'julia') {
          renderer.render(tileBounds, maxIterations, colorOffset, juliaConstant, equationId, antiAlias);
        } else if (fractalType === 'heatmap') {
          renderer.render(tileBounds, maxIterations, colorOffset, undefined, equationId, antiAlias);
        } else {
          renderer.render(tileBounds, maxIterations, colorOffset, undefined, undefined, antiAlias);
        }

        // Copy tile to output canvas
        const destX = col * tileWidth;
        const destY = row * tileHeight;
        outputCtx.drawImage(tileCanvas, destX, destY);

        currentTile++;

        // Allow UI to update between tiles
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
  } finally {
    renderer.dispose();
  }
}

async function render3DDirect(
  options: ExportOptions,
  outputCanvas: HTMLCanvasElement
): Promise<void> {
  const { exportSettings, camera3D, mandelbulbParams, lightingParams,
          renderQuality, maxIterations, paletteId, colorTemperature,
          customPalettes, onProgress, abortSignal } = options;

  const { width, height } = exportSettings;
  const maxTextureSize = getWebGLMaxTextureSize();

  // Check if resolution exceeds GPU limits
  if (width > maxTextureSize || height > maxTextureSize) {
    throw new Error(
      `Resolution ${width}x${height} exceeds GPU limit of ${maxTextureSize}px. ` +
      `Please reduce resolution or try a smaller size.`
    );
  }

  checkAborted(abortSignal);

  onProgress({
    phase: 'rendering',
    currentTile: 1,
    totalTiles: 1,
    percent: 10,
  });

  // Set output canvas size
  outputCanvas.width = width;
  outputCanvas.height = height;

  // Create WebGL renderer
  const renderer = new WebGLRenderer(outputCanvas);
  if (!renderer.isAvailable()) {
    throw new Error('WebGL is not available for 3D export');
  }
  renderer.setFractalType('mandelbulb');

  // Set up palette
  const paletteColors = getPaletteColors(paletteId, customPalettes);
  const adjustedPalette = applyTemperatureToPalette(paletteColors, colorTemperature);
  const shaderPalette = generateShaderPalette(adjustedPalette);
  renderer.setPalette(shaderPalette);

  try {
    // Use ultra quality settings for export
    const exportQuality: RenderQuality = {
      maxSteps: Math.max(renderQuality.maxSteps, 1024),
      shadowSteps: Math.max(renderQuality.shadowSteps, 128),
      aoSamples: Math.max(renderQuality.aoSamples, 12),
      detailLevel: Math.min(renderQuality.detailLevel, 0.4),
    };

    checkAborted(abortSignal);

    renderer.render3D(
      camera3D,
      mandelbulbParams,
      lightingParams,
      exportQuality,
      maxIterations,
      0 // colorOffset
    );

    onProgress({
      phase: 'rendering',
      currentTile: 1,
      totalTiles: 1,
      percent: 90,
    });
  } finally {
    renderer.dispose();
  }
}

async function encodeAndDownload(
  canvas: HTMLCanvasElement,
  settings: ExportSettings,
  onProgress: (progress: ExportProgress) => void,
  abortSignal: AbortSignal
): Promise<void> {
  checkAborted(abortSignal);

  onProgress({
    phase: 'encoding',
    currentTile: 0,
    totalTiles: 0,
    percent: 92,
  });

  let mimeType: string;
  let extension: string;

  switch (settings.format) {
    case 'jpeg':
      mimeType = 'image/jpeg';
      extension = 'jpg';
      break;
    case 'webp':
      if (!supportsWebP()) {
        console.warn('WebP not supported, falling back to PNG');
        mimeType = 'image/png';
        extension = 'png';
      } else {
        mimeType = 'image/webp';
        extension = 'webp';
      }
      break;
    default:
      mimeType = 'image/png';
      extension = 'png';
  }

  // Convert to blob
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to create image blob'));
        }
      },
      mimeType,
      settings.format === 'png' ? undefined : settings.quality
    );
  });

  checkAborted(abortSignal);

  onProgress({
    phase: 'encoding',
    currentTile: 0,
    totalTiles: 0,
    percent: 98,
  });

  // Create download link
  const url = URL.createObjectURL(blob);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `fractal-${settings.width}x${settings.height}-${timestamp}.${extension}`;

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Cleanup
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  onProgress({
    phase: 'complete',
    currentTile: 0,
    totalTiles: 0,
    percent: 100,
  });
}

export async function exportImage(options: ExportOptions): Promise<void> {
  const { exportSettings, fractalType, onProgress, abortSignal } = options;

  onProgress({
    phase: 'preparing',
    currentTile: 0,
    totalTiles: 0,
    percent: 0,
  });

  // Create output canvas
  const outputCanvas = document.createElement('canvas');
  outputCanvas.width = exportSettings.width;
  outputCanvas.height = exportSettings.height;

  try {
    if (fractalType === 'mandelbulb') {
      // 3D rendering - no tiling
      await render3DDirect(options, outputCanvas);
    } else {
      // 2D fractals - use tiled rendering
      await render2DTiled(options, outputCanvas);
    }

    // Encode and download
    await encodeAndDownload(outputCanvas, exportSettings, onProgress, abortSignal);
  } catch (e) {
    // Re-throw abort errors as-is
    if (e instanceof Error && e.name === 'AbortError') {
      throw e;
    }
    console.error('Export failed:', e);
    throw e;
  }
}

export function estimateFileSize(width: number, height: number, format: 'png' | 'jpeg' | 'webp', quality: number): string {
  const pixels = width * height;
  let bytes: number;

  switch (format) {
    case 'jpeg':
      // JPEG typically 0.3-0.8 bytes per pixel depending on quality
      bytes = pixels * (0.3 + quality * 0.5);
      break;
    case 'webp':
      // WebP typically 0.2-0.6 bytes per pixel
      bytes = pixels * (0.2 + quality * 0.4);
      break;
    default:
      // PNG typically 2-4 bytes per pixel for fractal images (high detail)
      bytes = pixels * 3;
  }

  if (bytes < 1024) {
    return `${bytes.toFixed(0)} B`;
  } else if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  } else {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}
