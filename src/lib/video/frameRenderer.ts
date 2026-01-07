import type { AnimationKeyframe, VideoExportSettings, VideoExportProgress, VideoRenderQuality, ViewBounds, FractalType } from '../../types';
import { getStateAtTime, calculateTotalDuration, type InterpolatedState } from '../animation/interpolation';
import { WebGLRenderer } from '../../webgl/renderer';
import { PRESET_PALETTES, generateShaderPalette, applyTemperatureToPalette } from '../colors';
import type { RGB } from '../colors';
import { getWorkerPool } from '../workerPool';

// Maximum tile size to avoid GPU memory issues
const MAX_TILE_SIZE = 2048;

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

export interface TiledRenderOptions {
  width: number;
  height: number;
  viewBounds: ViewBounds;
  fractalType: FractalType;
  juliaConstant: { real: number; imag: number };
  equationId: number;
  maxIterations: number;
  paletteId: string;
  colorTemperature: number;
  customPalettes: { id: string; name: string; colors: RGB[] }[];
  antiAlias?: number;
}

/**
 * Reusable tiled renderer for video export.
 * Reuses the output canvas but creates/disposes WebGL context per frame
 * to avoid having two WebGL contexts active simultaneously (which causes GPU memory issues).
 */
export class TiledFrameRenderer {
  private outputCanvas: HTMLCanvasElement | null = null;
  private outputCtx: CanvasRenderingContext2D | null = null;
  private currentWidth: number = 0;
  private currentHeight: number = 0;

  /**
   * Initialize or reinitialize the output canvas for a given size.
   */
  private ensureOutputCanvas(width: number, height: number): void {
    // Only recreate if size changed
    if (this.outputCanvas && this.currentWidth === width && this.currentHeight === height) {
      return;
    }

    this.currentWidth = width;
    this.currentHeight = height;

    // Create output canvas at full resolution
    this.outputCanvas = document.createElement('canvas');
    this.outputCanvas.width = width;
    this.outputCanvas.height = height;
    this.outputCtx = this.outputCanvas.getContext('2d');
    if (!this.outputCtx) {
      throw new Error('Failed to get 2D context for output canvas');
    }
  }

  /**
   * Render a single frame using tiled rendering at full resolution.
   * Returns the output canvas (reused across frames).
   * WebGL context is created and disposed per frame to avoid GPU memory pressure.
   */
  renderFrame(options: TiledRenderOptions): HTMLCanvasElement {
    const {
      width,
      height,
      viewBounds,
      fractalType,
      juliaConstant,
      equationId,
      maxIterations,
      paletteId,
      colorTemperature,
      customPalettes,
      antiAlias = 3, // 9x AA by default for ultra quality
    } = options;

    // Ensure output canvas is ready
    this.ensureOutputCanvas(width, height);

    if (!this.outputCanvas || !this.outputCtx) {
      throw new Error('TiledFrameRenderer output canvas not initialized');
    }

    // Create tile canvas and WebGL renderer for this frame only
    const tileCanvas = document.createElement('canvas');
    const renderer = new WebGLRenderer(tileCanvas);
    if (!renderer.isAvailable()) {
      throw new Error('WebGL is not available for tiled rendering');
    }

    try {
      // Set up fractal type and palette
      renderer.setFractalType(fractalType);
      const paletteColors = getPaletteColors(paletteId, customPalettes);
      const adjustedPalette = applyTemperatureToPalette(paletteColors, colorTemperature);
      const shaderPalette = generateShaderPalette(adjustedPalette);
      renderer.setPalette(shaderPalette);

      // Calculate tile grid
      const { cols, rows, tileWidth, tileHeight } = calculateTileGrid(width, height);

      // Clear the output canvas
      this.outputCtx.clearRect(0, 0, width, height);

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          // Calculate actual tile dimensions (may be smaller at edges)
          const actualTileWidth = Math.min(tileWidth, width - col * tileWidth);
          const actualTileHeight = Math.min(tileHeight, height - row * tileHeight);

          // Resize tile canvas
          tileCanvas.width = actualTileWidth;
          tileCanvas.height = actualTileHeight;

          // Calculate bounds for this tile
          const tileBounds = getTileBounds(
            viewBounds, col, row,
            tileWidth, tileHeight, width, height
          );

          // Render the tile with high anti-aliasing
          const colorOffset = 0;

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
          this.outputCtx.drawImage(tileCanvas, destX, destY);
        }
      }

      return this.outputCanvas;
    } finally {
      // Dispose WebGL context after each frame to free GPU memory
      // This prevents having two active WebGL contexts (main app + this one)
      renderer.dispose();
    }
  }

  /**
   * Dispose of all resources.
   */
  dispose(): void {
    this.outputCanvas = null;
    this.outputCtx = null;
    this.currentWidth = 0;
    this.currentHeight = 0;
  }
}

/**
 * CPU-based frame renderer using worker pool for high-precision deep zooms.
 * Uses JavaScript float64 for much higher precision than WebGL float32.
 */
export class CPUFrameRenderer {
  private outputCanvas: HTMLCanvasElement | null = null;
  private outputCtx: CanvasRenderingContext2D | null = null;
  private currentWidth: number = 0;
  private currentHeight: number = 0;

  /**
   * Initialize or reinitialize the output canvas for a given size.
   */
  private ensureOutputCanvas(width: number, height: number): void {
    if (this.outputCanvas && this.currentWidth === width && this.currentHeight === height) {
      return;
    }

    this.currentWidth = width;
    this.currentHeight = height;

    this.outputCanvas = document.createElement('canvas');
    this.outputCanvas.width = width;
    this.outputCanvas.height = height;
    this.outputCtx = this.outputCanvas.getContext('2d');
    if (!this.outputCtx) {
      throw new Error('Failed to get 2D context for output canvas');
    }
  }

  /**
   * Render a single frame using CPU worker pool at full resolution.
   * Returns the output canvas (reused across frames).
   */
  async renderFrame(options: TiledRenderOptions): Promise<HTMLCanvasElement> {
    const {
      width,
      height,
      viewBounds,
      fractalType,
      juliaConstant,
      equationId,
      maxIterations,
      paletteId,
      colorTemperature,
      customPalettes,
      antiAlias = 3, // 9x AA by default for CPU
    } = options;

    // Ensure output canvas is ready
    this.ensureOutputCanvas(width, height);

    if (!this.outputCanvas || !this.outputCtx) {
      throw new Error('CPUFrameRenderer output canvas not initialized');
    }

    // Get palette for CPU rendering (flat array of RGB values 0-1)
    const paletteColors = getPaletteColors(paletteId, customPalettes);
    const adjustedPalette = applyTemperatureToPalette(paletteColors, colorTemperature);
    const flatPalette: number[] = [];
    for (const color of adjustedPalette) {
      flatPalette.push(color.r / 255, color.g / 255, color.b / 255);
    }

    // Use worker pool for CPU rendering
    const pool = getWorkerPool();

    // CPU rendering only supports mandelbrot and julia
    const cpuFractalType = fractalType === 'heatmap' ? 'julia' :
                           fractalType === 'mandelbulb' ? 'mandelbrot' :
                           fractalType;

    const imageData = await pool.render({
      width,
      height,
      bounds: viewBounds,
      maxIterations,
      fractalType: cpuFractalType,
      juliaC: juliaConstant,
      equationId,
      palette: flatPalette,
      colorOffset: 0,
      antiAlias,
    });

    // Draw the image data to the output canvas
    this.outputCtx.putImageData(imageData, 0, 0);

    return this.outputCanvas;
  }

  /**
   * Dispose of all resources.
   */
  dispose(): void {
    this.outputCanvas = null;
    this.outputCtx = null;
    this.currentWidth = 0;
    this.currentHeight = 0;
  }
}

/**
 * Calculate the zoom level from view bounds.
 * Returns the zoom factor (1x = default view, higher = more zoomed in)
 */
export function calculateZoomLevel(viewBounds: ViewBounds): number {
  const range = Math.min(
    viewBounds.maxReal - viewBounds.minReal,
    viewBounds.maxImag - viewBounds.minImag
  );
  // Default Mandelbrot view is about 3 units wide
  return 3 / range;
}

/**
 * Check if a frame needs high precision (CPU) rendering based on zoom level.
 * WebGL float32 starts losing precision around 12,500x zoom.
 */
export function needsHighPrecision(viewBounds: ViewBounds, threshold: number = 12500): boolean {
  return calculateZoomLevel(viewBounds) > threshold;
}

/**
 * Render a single frame using tiled rendering at full resolution.
 * This is the same approach used by the image exporter for high-quality output.
 * Returns a canvas with the fully rendered frame.
 *
 * NOTE: For video export, use TiledFrameRenderer class instead to avoid memory leaks.
 */
export async function renderTiledFrame(options: TiledRenderOptions): Promise<HTMLCanvasElement> {
  const renderer = new TiledFrameRenderer();
  try {
    return renderer.renderFrame(options);
  } finally {
    renderer.dispose();
  }
}

/**
 * Create TiledRenderOptions from an InterpolatedState
 */
export function createTiledRenderOptionsFromState(
  state: InterpolatedState,
  width: number,
  height: number,
  customPalettes: { id: string; name: string; colors: RGB[] }[],
  antiAlias: number = 4 // Default to 16x AA (Ultra quality)
): TiledRenderOptions {
  return {
    width,
    height,
    viewBounds: state.viewBounds,
    fractalType: state.fractalType,
    juliaConstant: state.juliaConstant,
    equationId: state.equationId,
    maxIterations: state.maxIterations,
    paletteId: state.currentPaletteId,
    colorTemperature: state.colorTemperature,
    customPalettes,
    antiAlias,
  };
}

export interface FrameRendererConfig {
  keyframes: AnimationKeyframe[];
  settings: VideoExportSettings;
  onFrame: (state: InterpolatedState, frameIndex: number) => Promise<void>;
  onProgress: (progress: VideoExportProgress) => void;
  abortSignal: AbortSignal;
}

export interface FrameRenderResult {
  success: boolean;
  totalFrames: number;
  error?: string;
}

// Get resolution dimensions from settings
export function getResolutionDimensions(
  settings: VideoExportSettings,
  canvasWidth: number,
  canvasHeight: number
): { width: number; height: number } {
  switch (settings.resolution) {
    case '720p':
      return { width: 1280, height: 720 };
    case '1080p':
      return { width: 1920, height: 1080 };
    case '4k':
      return { width: 3840, height: 2160 };
    case 'custom':
      return {
        width: settings.customWidth || 1920,
        height: settings.customHeight || 1080,
      };
    case 'canvas':
    default:
      return { width: canvasWidth, height: canvasHeight };
  }
}

// Calculate total frames for the animation
export function calculateTotalFrames(keyframes: AnimationKeyframe[], fps: number): number {
  const totalDuration = calculateTotalDuration(keyframes);
  return Math.ceil(totalDuration / 1000 * fps);
}

// Calculate frame time in milliseconds
export function getFrameTime(frameIndex: number, fps: number): number {
  return (frameIndex / fps) * 1000;
}

// Get anti-aliasing value for quality mode
export function getAntiAliasForQuality(quality: VideoRenderQuality): number {
  switch (quality) {
    case 'ultra':
      return 4; // 16x AA (4x4 samples) - highest quality, slowest
    case 'high':
      return 3; // 9x AA (3x3 samples) - medium
    case 'standard':
    default:
      return 2; // 4x AA (2x2 samples) - fastest
  }
}

// Main frame rendering function
// This orchestrates rendering all frames of the animation
export async function renderAllFrames(config: FrameRendererConfig): Promise<FrameRenderResult> {
  const { keyframes, settings, onFrame, onProgress, abortSignal } = config;

  if (keyframes.length < 2) {
    return { success: false, totalFrames: 0, error: 'Need at least 2 keyframes' };
  }

  const totalFrames = calculateTotalFrames(keyframes, settings.fps);

  onProgress({
    phase: 'preparing',
    currentFrame: 0,
    totalFrames,
    percent: 0,
  });

  try {
    for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
      // Check for abort
      if (abortSignal.aborted) {
        return { success: false, totalFrames: frameIndex, error: 'Export cancelled' };
      }

      const timeMs = getFrameTime(frameIndex, settings.fps);
      const state = getStateAtTime(keyframes, timeMs);

      if (!state) {
        console.warn(`No state at time ${timeMs}ms, skipping frame ${frameIndex}`);
        continue;
      }

      // Update progress
      onProgress({
        phase: 'rendering',
        currentFrame: frameIndex + 1,
        totalFrames,
        percent: ((frameIndex + 1) / totalFrames) * 100,
      });

      // Render the frame
      await onFrame(state, frameIndex);

      // Small delay to allow UI updates and prevent blocking
      if (frameIndex % 10 === 0) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }

    onProgress({
      phase: 'encoding',
      currentFrame: totalFrames,
      totalFrames,
      percent: 100,
    });

    return { success: true, totalFrames };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, totalFrames: 0, error: errorMessage };
  }
}

// Estimate export duration based on settings
export function estimateExportDuration(
  keyframes: AnimationKeyframe[],
  settings: VideoExportSettings
): { minSeconds: number; maxSeconds: number } {
  const totalFrames = calculateTotalFrames(keyframes, settings.fps);

  // Rough estimates based on quality mode
  let msPerFrame: { min: number; max: number };
  switch (settings.renderQuality) {
    case 'ultra':
      // CPU rendering is slow
      msPerFrame = { min: 500, max: 2000 };
      break;
    case 'high':
      // GPU with high AA
      msPerFrame = { min: 50, max: 200 };
      break;
    case 'standard':
    default:
      // Fast GPU rendering
      msPerFrame = { min: 20, max: 100 };
      break;
  }

  // Adjust for resolution
  const { width, height } = getResolutionDimensions(settings, 1920, 1080);
  const resolutionFactor = (width * height) / (1920 * 1080);

  return {
    minSeconds: Math.ceil((totalFrames * msPerFrame.min * resolutionFactor) / 1000),
    maxSeconds: Math.ceil((totalFrames * msPerFrame.max * resolutionFactor) / 1000),
  };
}

// Estimate file size based on settings
export function estimateFileSize(
  keyframes: AnimationKeyframe[],
  settings: VideoExportSettings
): { minMB: number; maxMB: number } {
  const totalDuration = calculateTotalDuration(keyframes) / 1000; // seconds
  const { width, height } = getResolutionDimensions(settings, 1920, 1080);

  // Base bitrate estimation (bits per second)
  // VP9 is generally more efficient than VP8
  const pixelCount = width * height;
  const baseBitrate = pixelCount * settings.fps * 0.05; // Very rough estimate

  // Adjust for quality
  const qualityMultiplier = settings.quality;

  // Codec efficiency factor (VP9 is more efficient)
  const codecFactor = settings.codec === 'vp9' ? 0.7 : 1.0;

  const bitsPerSecond = baseBitrate * qualityMultiplier * codecFactor;
  const bytes = (bitsPerSecond * totalDuration) / 8;

  // Add some variance
  const minBytes = bytes * 0.5;
  const maxBytes = bytes * 1.5;

  return {
    minMB: Math.max(0.1, minBytes / (1024 * 1024)),
    maxMB: maxBytes / (1024 * 1024),
  };
}
