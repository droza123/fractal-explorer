import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { FractalStore, ViewBounds, FractalType, Complex, HistoryEntry, SavedJulia, Camera3D, MandelbulbParams, LightingParams, RenderQuality, RenderQuality2D, SuggestedPoint, ExportSettings, ExportProgress, AnimationKeyframe, Animation, AnimationPlaybackState, VideoExportSettings, VideoExportProgress } from '../types';
import { addPoint, deletePoint, updatePoint, getAllPoints, getAllCustomPalettes, addCustomPalette as dbAddCustomPalette, updateCustomPalette as dbUpdateCustomPalette, deleteCustomPalette as dbDeleteCustomPalette } from '../db/database';
import { getAllAnimations, addAnimation as dbAddAnimation, updateAnimation as dbUpdateAnimation, deleteAnimation as dbDeleteAnimation } from '../db/animations';
import { PRESET_PALETTES, type RGB } from '../lib/colors';
import { getSuggestions } from '../lib/suggestions';
import { calculateTotalDuration } from '../lib/animation/interpolation';
import { generateKeyframeThumbnail } from '../lib/animation/thumbnailGenerator';
import { ViewBoundsAnimator } from '../lib/animation/viewBoundsAnimator';
import { encodeStateToHash, decodeHashToState, copyToClipboard, type ShareableState } from '../lib/urlState';
import { getEquation3D } from '../lib/equations3d';

// Global zoom animator instance (not stored in state to avoid serialization issues)
let zoomAnimator: ViewBoundsAnimator | null = null;

// Calculate responsive default toolbar width based on screen size
// Linear scale based on: 1432px screen → 390px toolbar, 2040px screen → 460px toolbar
// Formula: toolbarWidth = 0.115 * screenWidth + 225, clamped to 275-500px
function getResponsiveToolbarWidth(): number {
  if (typeof window === 'undefined') return 300; // SSR fallback
  const screenWidth = window.innerWidth;
  const calculatedWidth = Math.round(0.115 * screenWidth + 225);
  return Math.max(275, Math.min(500, calculatedWidth));
}

const DEFAULT_CAMERA_3D: Camera3D = {
  distance: 4.0,
  rotationX: 0.3,      // Pitch: slight elevation angle
  rotationY: 0.4,      // Yaw: slight horizontal rotation for better initial view
  fov: 60,
};

const DEFAULT_MANDELBULB_PARAMS: MandelbulbParams = {
  power: 8,
  bailout: 2.0,
  scale: 2.0,       // For Mandelbox, Kaleidoscopic IFS
  minRadius: 0.5,   // For Mandelbox sphere fold
};

const DEFAULT_LIGHTING_PARAMS: LightingParams = {
  ambient: 0.15,
  diffuse: 0.8,
  specular: 0.5,
  shininess: 32,
  lightAngleX: 0.5,    // Horizontal angle
  lightAngleY: 0.8,    // Vertical angle (elevation)
};

const DEFAULT_RENDER_QUALITY: RenderQuality = {
  maxSteps: 256,
  shadowSteps: 32,
  aoSamples: 5,
  detailLevel: 0.3,  // Higher detail default for solid Mandelbox rendering
};

// Detail levels shifted: old "High" (0.3) is now "Low", allows finer detail
const QUALITY_PRESETS: Record<'low' | 'medium' | 'high' | 'ultra', RenderQuality> = {
  low: { maxSteps: 64, shadowSteps: 0, aoSamples: 0, detailLevel: 0.4 },
  medium: { maxSteps: 256, shadowSteps: 32, aoSamples: 5, detailLevel: 0.3 },
  high: { maxSteps: 512, shadowSteps: 64, aoSamples: 8, detailLevel: 0.2 },
  ultra: { maxSteps: 1024, shadowSteps: 128, aoSamples: 12, detailLevel: 0.1 },
};

const DEFAULT_RENDER_QUALITY_2D: RenderQuality2D = {
  antiAlias: 4,  // 16x AA by default for GPU (fast)
  antiAliasCPU: 1,  // Off by default for CPU (slow)
  precisionMode: 'auto',  // Auto-detect when high precision is needed
  precisionSwitchZoom: 12500,  // Zoom level to switch to CPU rendering in auto mode
};

// Load export settings from localStorage or use defaults
function loadExportSettings(): ExportSettings {
  try {
    const stored = localStorage.getItem('fractal-export-settings');
    if (stored) {
      return { ...DEFAULT_EXPORT_SETTINGS, ...JSON.parse(stored) };
    }
  } catch (e) {
    console.warn('Failed to load export settings from localStorage:', e);
  }
  return { ...DEFAULT_EXPORT_SETTINGS };
}

function saveExportSettings(settings: ExportSettings): void {
  try {
    localStorage.setItem('fractal-export-settings', JSON.stringify(settings));
  } catch (e) {
    console.warn('Failed to save export settings to localStorage:', e);
  }
}

const DEFAULT_EXPORT_SETTINGS: ExportSettings = {
  width: 1920,
  height: 1080,
  format: 'png',
  quality: 0.92,
  aspectLocked: true,
};

const DEFAULT_VIDEO_EXPORT_SETTINGS: VideoExportSettings = {
  format: 'webm',
  fps: 30,
  resolution: '1080p',
  quality: 0.8,
  codec: 'vp9',
  renderQuality: 'standard',
  renderPrecision: 'auto',
  showZoomLevel: true,
  zoomLevelPosition: 'top-right',
};

const DEFAULT_ANIMATION_PLAYBACK: AnimationPlaybackState = {
  isPlaying: false,
  isPreviewing: false,
  currentTime: 0,
  playbackSpeed: 1,
};

// Load video export settings from localStorage or use defaults
function loadVideoExportSettings(): VideoExportSettings {
  try {
    const stored = localStorage.getItem('fractal-video-export-settings');
    if (stored) {
      return { ...DEFAULT_VIDEO_EXPORT_SETTINGS, ...JSON.parse(stored) };
    }
  } catch (e) {
    console.warn('Failed to load video export settings from localStorage:', e);
  }
  return { ...DEFAULT_VIDEO_EXPORT_SETTINGS };
}

function saveVideoExportSettings(settings: VideoExportSettings): void {
  try {
    localStorage.setItem('fractal-video-export-settings', JSON.stringify(settings));
  } catch (e) {
    console.warn('Failed to save video export settings to localStorage:', e);
  }
}

const DEFAULT_MANDELBROT_BOUNDS: ViewBounds = {
  minReal: -2.5,
  maxReal: 1.0,
  minImag: -1.25,
  maxImag: 1.25,
};

const DEFAULT_JULIA_CONSTANT: Complex = {
  real: -0.7,
  imag: 0.27015,
};

function getJuliaBounds(zoomFactor: number): ViewBounds {
  const scale = 2.0 / zoomFactor;
  return {
    minReal: -scale,
    maxReal: scale,
    minImag: -scale * 0.75,
    maxImag: scale * 0.75,
  };
}

function getZoomFactorFromBounds(bounds: ViewBounds, fractalType: FractalType): number {
  const realRange = bounds.maxReal - bounds.minReal;
  // Julia default range is 4.0 at 1x, Mandelbrot default range is 3.5 at 1x
  const baseRange = fractalType === 'julia' ? 4.0 : 3.5;
  return baseRange / realRange;
}

function createHistoryEntry(state: {
  viewBounds: ViewBounds;
  fractalType: FractalType;
  juliaConstant: Complex;
  equationId: number;
  juliaZoomFactor: number;
  maxIterations: number;
}): HistoryEntry {
  return {
    viewBounds: { ...state.viewBounds },
    fractalType: state.fractalType,
    juliaConstant: { ...state.juliaConstant },
    equationId: state.equationId,
    juliaZoomFactor: state.juliaZoomFactor,
    maxIterations: state.maxIterations,
  };
}

const initialState = {
  viewBounds: { ...DEFAULT_MANDELBROT_BOUNDS },
  fractalType: 'mandelbrot' as FractalType,
  juliaConstant: { ...DEFAULT_JULIA_CONSTANT },
  equationId: 1,
  juliaZoomFactor: 1.0,
  maxIterations: 256,
};

export const useFractalStore = create<FractalStore>()(
  persist(
    (set, get) => ({
  viewBounds: initialState.viewBounds,
  maxIterations: 256,
  renderMode: 'webgl',
  isRendering: false,
  selection: null,
  history: [createHistoryEntry(initialState)],
  historyIndex: 0,
  fractalType: initialState.fractalType,
  juliaConstant: initialState.juliaConstant,
  equationId: initialState.equationId,
  juliaZoomFactor: initialState.juliaZoomFactor,
  showEquationSelector: false,
  // Heat map mode state
  heatmapPreviewConstant: null,
  savedJulias: [],
  cursorPosition: null,
  thumbnailCanvas: null,
  showSaveIndicator: false,
  // Color system state
  currentPaletteId: 'classic',
  colorTemperature: 0,
  customPalettes: [],
  showColorSelector: false,
  // 3D Mandelbulb state
  camera3D: { ...DEFAULT_CAMERA_3D },
  mandelbulbParams: { ...DEFAULT_MANDELBULB_PARAMS },
  lightingParams: { ...DEFAULT_LIGHTING_PARAMS },
  renderQuality: { ...DEFAULT_RENDER_QUALITY },
  equation3dId: 1, // Default to Mandelbulb
  showEquation3DSelector: false,
  renderQuality2D: { ...DEFAULT_RENDER_QUALITY_2D },
  isHighPrecisionActive: false,
  // AI Suggestions
  suggestions: [],
  isLoadingSuggestions: false,
  showSuggestionsPanel: true,
  highlightedSuggestion: null,
  // Image Export
  showExportDialog: false,
  isExporting: false,
  exportProgress: null,
  exportSettings: loadExportSettings(),
  exportAbortController: null,
  // UI Collapsed States (default to expanded)
  toolbarCollapsed: false,
  toolbarWidth: getResponsiveToolbarWidth(),  // Responsive default based on screen size
  qualityCollapsed: false,
  savedJuliasCollapsed: false,
  infoCollapsed: false,
  // Animation System
  keyframes: [] as AnimationKeyframe[],
  selectedKeyframeId: null as string | null,
  savedAnimations: [] as Animation[],
  currentAnimationId: null as number | null,
  animationPlayback: { ...DEFAULT_ANIMATION_PLAYBACK },
  // Video Export
  showVideoExportDialog: false,
  isExportingVideo: false,
  videoExportProgress: null as VideoExportProgress | null,
  videoExportSettings: loadVideoExportSettings(),
  videoExportAbortController: null as AbortController | null,
  // Animation UI
  animationPanelCollapsed: true,
  // Saved items dialogs
  showSavedAnimationsDialog: false,
  showSavedJuliasDialog: false,
  // Help dialog
  showHelpDialog: false,
  // URL Sharing
  showShareToast: false,
  shareToastMessage: '',

  setViewBounds: (bounds) => set({ viewBounds: bounds }),

  setViewBoundsWithZoom: (bounds, commit = false) => {
    const { fractalType, pushHistory } = get();
    const newZoomFactor = getZoomFactorFromBounds(bounds, fractalType);
    if (commit) {
      pushHistory({ viewBounds: bounds, juliaZoomFactor: newZoomFactor });
    } else {
      set({ viewBounds: bounds, juliaZoomFactor: newZoomFactor });
    }
  },

  setMaxIterations: (iterations) => {
    const { pushHistory } = get();
    pushHistory({ maxIterations: iterations });
  },

  setRenderMode: (mode) => set({ renderMode: mode }),

  setIsRendering: (rendering) => set({ isRendering: rendering }),

  setSelection: (selection) => set({ selection }),

  pushHistory: (changes) => {
    const state = get();
    const newEntry = createHistoryEntry({
      viewBounds: changes?.viewBounds ?? state.viewBounds,
      fractalType: changes?.fractalType ?? state.fractalType,
      juliaConstant: changes?.juliaConstant ?? state.juliaConstant,
      equationId: changes?.equationId ?? state.equationId,
      juliaZoomFactor: changes?.juliaZoomFactor ?? state.juliaZoomFactor,
      maxIterations: changes?.maxIterations ?? state.maxIterations,
    });

    const newHistory = state.history.slice(0, state.historyIndex + 1);
    newHistory.push(newEntry);

    set({
      history: newHistory,
      historyIndex: newHistory.length - 1,
      viewBounds: newEntry.viewBounds,
      fractalType: newEntry.fractalType,
      juliaConstant: newEntry.juliaConstant,
      equationId: newEntry.equationId,
      juliaZoomFactor: newEntry.juliaZoomFactor,
      maxIterations: newEntry.maxIterations,
    });
  },

  goBack: () => {
    const { history, historyIndex } = get();
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      const entry = history[newIndex];
      set({
        historyIndex: newIndex,
        viewBounds: entry.viewBounds,
        fractalType: entry.fractalType,
        juliaConstant: entry.juliaConstant,
        equationId: entry.equationId,
        juliaZoomFactor: entry.juliaZoomFactor,
        maxIterations: entry.maxIterations,
      });
      return true;
    }
    return false;
  },

  goForward: () => {
    const { history, historyIndex } = get();
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      const entry = history[newIndex];
      set({
        historyIndex: newIndex,
        viewBounds: entry.viewBounds,
        fractalType: entry.fractalType,
        juliaConstant: entry.juliaConstant,
        equationId: entry.equationId,
        juliaZoomFactor: entry.juliaZoomFactor,
        maxIterations: entry.maxIterations,
      });
      return true;
    }
    return false;
  },

  canGoBack: () => get().historyIndex > 0,

  canGoForward: () => {
    const { history, historyIndex } = get();
    return historyIndex < history.length - 1;
  },

  zoomToSelection: (canvasWidth, canvasHeight) => {
    const { selection, viewBounds, fractalType, pushHistory } = get();
    if (!selection) return;

    const { startX, startY, endX, endY } = selection;
    const x1 = Math.min(startX, endX);
    const x2 = Math.max(startX, endX);
    const y1 = Math.min(startY, endY);
    const y2 = Math.max(startY, endY);

    const realRange = viewBounds.maxReal - viewBounds.minReal;
    const imagRange = viewBounds.maxImag - viewBounds.minImag;

    // Calculate the center of the selection in complex coordinates
    const centerX = (x1 + x2) / 2;
    const centerY = (y1 + y2) / 2;
    const centerReal = viewBounds.minReal + (centerX / canvasWidth) * realRange;
    const centerImag = viewBounds.maxImag - (centerY / canvasHeight) * imagRange;

    // Calculate the selection dimensions in complex coordinates
    const selectionRealRange = ((x2 - x1) / canvasWidth) * realRange;
    const selectionImagRange = ((y2 - y1) / canvasHeight) * imagRange;

    // Calculate canvas aspect ratio (real/imag)
    const canvasAspect = (canvasWidth / canvasHeight) * (imagRange / realRange);

    // Determine new dimensions that maintain canvas aspect ratio
    // Expand to fit the larger relative dimension
    let newRealRange: number;
    let newImagRange: number;

    const selectionAspect = selectionRealRange / selectionImagRange;

    if (selectionAspect > canvasAspect) {
      // Selection is wider - use selection width, expand height
      newRealRange = selectionRealRange;
      newImagRange = selectionRealRange / canvasAspect;
    } else {
      // Selection is taller - use selection height, expand width
      newImagRange = selectionImagRange;
      newRealRange = selectionImagRange * canvasAspect;
    }

    const newBounds: ViewBounds = {
      minReal: centerReal - newRealRange / 2,
      maxReal: centerReal + newRealRange / 2,
      minImag: centerImag - newImagRange / 2,
      maxImag: centerImag + newImagRange / 2,
    };

    // Calculate the new zoom factor from the bounds
    const newZoomFactor = getZoomFactorFromBounds(newBounds, fractalType);
    pushHistory({ viewBounds: newBounds, juliaZoomFactor: newZoomFactor });
    set({ selection: null });
  },

  zoomAtPoint: (x, y, factor, canvasWidth, canvasHeight) => {
    const { viewBounds, fractalType, pushHistory } = get();

    const realRange = viewBounds.maxReal - viewBounds.minReal;
    const imagRange = viewBounds.maxImag - viewBounds.minImag;

    const pointReal = viewBounds.minReal + (x / canvasWidth) * realRange;
    const pointImag = viewBounds.maxImag - (y / canvasHeight) * imagRange;

    const newRealRange = realRange * factor;
    const newImagRange = imagRange * factor;

    const newBounds: ViewBounds = {
      minReal: pointReal - (x / canvasWidth) * newRealRange,
      maxReal: pointReal + ((canvasWidth - x) / canvasWidth) * newRealRange,
      minImag: pointImag - ((canvasHeight - y) / canvasHeight) * newImagRange,
      maxImag: pointImag + (y / canvasHeight) * newImagRange,
    };

    // Calculate the new zoom factor from the bounds
    const newZoomFactor = getZoomFactorFromBounds(newBounds, fractalType);
    pushHistory({ viewBounds: newBounds, juliaZoomFactor: newZoomFactor });
  },

  zoomAtPointAnimated: (x, y, factor, canvasWidth, canvasHeight) => {
    const { viewBounds, pushHistory } = get();

    const realRange = viewBounds.maxReal - viewBounds.minReal;
    const imagRange = viewBounds.maxImag - viewBounds.minImag;

    const pointReal = viewBounds.minReal + (x / canvasWidth) * realRange;
    const pointImag = viewBounds.maxImag - (y / canvasHeight) * imagRange;

    const newRealRange = realRange * factor;
    const newImagRange = imagRange * factor;

    const targetBounds: ViewBounds = {
      minReal: pointReal - (x / canvasWidth) * newRealRange,
      maxReal: pointReal + ((canvasWidth - x) / canvasWidth) * newRealRange,
      minImag: pointImag - ((canvasHeight - y) / canvasHeight) * newImagRange,
      maxImag: pointImag + (y / canvasHeight) * newImagRange,
    };

    // Initialize animator if needed
    if (!zoomAnimator) {
      zoomAnimator = new ViewBoundsAnimator({
        onUpdate: (bounds) => {
          // Update view without pushing to history
          set({ viewBounds: bounds });
        },
        onComplete: (bounds) => {
          // Push to history when animation completes
          const currentFractalType = get().fractalType;
          const finalZoomFactor = getZoomFactorFromBounds(bounds, currentFractalType);
          pushHistory({ viewBounds: bounds, juliaZoomFactor: finalZoomFactor });
        },
        duration: 150,
        easing: 'ease-out',
      });
    }

    // If already animating, update target (accumulate rapid scrolls)
    if (zoomAnimator.getIsAnimating()) {
      // Calculate new target relative to current target
      const currentTarget = zoomAnimator.getTargetBounds();
      if (currentTarget) {
        const targetRealRange = currentTarget.maxReal - currentTarget.minReal;
        const targetImagRange = currentTarget.maxImag - currentTarget.minImag;

        const targetPointReal = currentTarget.minReal + (x / canvasWidth) * targetRealRange;
        const targetPointImag = currentTarget.maxImag - (y / canvasHeight) * targetImagRange;

        const accumulatedRealRange = targetRealRange * factor;
        const accumulatedImagRange = targetImagRange * factor;

        const accumulatedBounds: ViewBounds = {
          minReal: targetPointReal - (x / canvasWidth) * accumulatedRealRange,
          maxReal: targetPointReal + ((canvasWidth - x) / canvasWidth) * accumulatedRealRange,
          minImag: targetPointImag - ((canvasHeight - y) / canvasHeight) * accumulatedImagRange,
          maxImag: targetPointImag + (y / canvasHeight) * accumulatedImagRange,
        };

        zoomAnimator.updateTarget(accumulatedBounds);
        return;
      }
    }

    // Start new animation
    zoomAnimator.animateTo(viewBounds, targetBounds);
  },

  resetView: () => {
    const { pushHistory } = get();
    // Full reset to initial state
    pushHistory({
      viewBounds: { ...DEFAULT_MANDELBROT_BOUNDS },
      fractalType: 'mandelbrot',
      juliaZoomFactor: 1.0,
      maxIterations: 256,
      equationId: 1,
      juliaConstant: { ...DEFAULT_JULIA_CONSTANT },
    });
  },

  setFractalType: (type: FractalType) => set({ fractalType: type }),

  setJuliaConstant: (c: Complex) => set({ juliaConstant: c }),

  resetJuliaConstant: () => set({ juliaConstant: { ...DEFAULT_JULIA_CONSTANT } }),

  setEquationId: (id: number) => {
    const { fractalType, juliaZoomFactor, pushHistory } = get();
    if (fractalType === 'heatmap') {
      // In heatmap mode, just change equation without resetting view
      pushHistory({ equationId: id });
    } else {
      // In Julia mode, reset view bounds when changing equation
      const bounds = getJuliaBounds(juliaZoomFactor);
      pushHistory({ equationId: id, viewBounds: bounds });
    }
  },

  setJuliaZoomFactor: (factor: number, commit: boolean = true) => {
    const { fractalType, viewBounds, pushHistory } = get();

    // Calculate the center of the current view
    const centerReal = (viewBounds.minReal + viewBounds.maxReal) / 2;
    const centerImag = (viewBounds.minImag + viewBounds.maxImag) / 2;

    // Calculate new bounds centered on current view center
    // Julia base range is 4.0, Mandelbrot/Heatmap base range is 3.5
    const baseHalfRange = fractalType === 'julia' ? 2.0 : 1.75;
    const aspectRatio = fractalType === 'julia' ? 0.75 : (2.5 / 3.5);

    const halfRealRange = baseHalfRange / factor;
    const halfImagRange = halfRealRange * aspectRatio;

    const newBounds: ViewBounds = {
      minReal: centerReal - halfRealRange,
      maxReal: centerReal + halfRealRange,
      minImag: centerImag - halfImagRange,
      maxImag: centerImag + halfImagRange,
    };

    if (commit) {
      pushHistory({ juliaZoomFactor: factor, viewBounds: newBounds });
    } else {
      // Preview mode: update state without pushing to history
      set({ juliaZoomFactor: factor, viewBounds: newBounds });
    }
  },

  setShowEquationSelector: (show: boolean) => set({ showEquationSelector: show }),

  switchToJulia: (c: Complex) => {
    const { pushHistory } = get();
    // Reset to default zoom (1.0) when switching to Julia to avoid unexpected CPU mode
    const bounds = getJuliaBounds(1.0);
    pushHistory({
      fractalType: 'julia',
      juliaConstant: c,
      viewBounds: bounds,
      juliaZoomFactor: 1.0,
    });
  },

  switchToMandelbrot: () => {
    const { pushHistory } = get();
    // Reset to default view when switching to Mandelbrot
    pushHistory({
      fractalType: 'mandelbrot',
      viewBounds: { ...DEFAULT_MANDELBROT_BOUNDS },
      juliaZoomFactor: 1.0,
    });
  },

  // Heat map mode actions
  switchToHeatmap: () => {
    const { pushHistory } = get();
    // Reset to default view when switching to Heatmap
    pushHistory({
      fractalType: 'heatmap',
      viewBounds: { ...DEFAULT_MANDELBROT_BOUNDS },
      juliaZoomFactor: 1.0,
    });
  },

  setHeatmapPreviewConstant: (c) => set({ heatmapPreviewConstant: c }),

  setCursorPosition: (pos) => set({ cursorPosition: pos }),

  saveCurrentJulia: async (name?: string) => {
    const {
      juliaConstant,
      equationId,
      savedJulias,
      thumbnailCanvas,
      viewBounds,
      maxIterations,
      juliaZoomFactor,
      currentPaletteId,
      colorTemperature,
      customPalettes,
    } = get();

    // Generate thumbnail from canvas if available
    let thumbnail: string | null = null;
    if (thumbnailCanvas) {
      // Create a smaller canvas for the thumbnail
      const thumbCanvas = document.createElement('canvas');
      const thumbSize = 120;
      thumbCanvas.width = thumbSize;
      thumbCanvas.height = thumbSize * (9 / 16); // 16:9 aspect ratio
      const ctx = thumbCanvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(thumbnailCanvas, 0, 0, thumbCanvas.width, thumbCanvas.height);
        thumbnail = thumbCanvas.toDataURL('image/jpeg', 0.7);
      }
    }

    // Get the current palette colors for fallback
    let paletteColors: { r: number; g: number; b: number }[] | undefined;
    const presetPalette = PRESET_PALETTES.find(p => p.id === currentPaletteId);
    if (presetPalette) {
      paletteColors = presetPalette.colors;
    } else {
      const customPalette = customPalettes.find(p => p.id === currentPaletteId);
      if (customPalette) {
        paletteColors = customPalette.colors;
      }
    }

    const pointName = name || `Point ${savedJulias.length + 1}`;

    // Save to IndexedDB with full state
    const id = await addPoint({
      equationId,
      real: juliaConstant.real,
      imag: juliaConstant.imag,
      name: pointName,
      thumbnail,
      viewBounds: { ...viewBounds },
      maxIterations,
      juliaZoomFactor,
      currentPaletteId,
      colorTemperature,
      paletteColors,
    });

    // Update local state and show save indicator
    const newSaved: SavedJulia = {
      id,
      constant: { ...juliaConstant },
      equationId,
      name: pointName,
      thumbnail,
      viewBounds: { ...viewBounds },
      maxIterations,
      juliaZoomFactor,
      currentPaletteId,
      colorTemperature,
      paletteColors,
    };
    set({ savedJulias: [...savedJulias, newSaved], showSaveIndicator: true });

    // Auto-hide the save indicator after 1.5 seconds
    setTimeout(() => {
      set({ showSaveIndicator: false });
    }, 1500);
  },

  removeSavedJulia: async (id) => {
    const { savedJulias } = get();
    await deletePoint(id);
    set({ savedJulias: savedJulias.filter((s) => s.id !== id) });
  },

  loadSavedJulia: (id) => {
    const { savedJulias, juliaZoomFactor, customPalettes, currentPaletteId: userCurrentPalette, pushHistory } = get();
    const saved = savedJulias.find((s) => s.id === id);
    if (saved) {
      // Use saved view bounds if available, otherwise calculate from zoom factor
      const bounds = saved.viewBounds || getJuliaBounds(saved.juliaZoomFactor ?? juliaZoomFactor);

      // Determine which palette to use
      let paletteId = saved.currentPaletteId || userCurrentPalette;

      // Check if the saved palette exists
      if (saved.currentPaletteId) {
        const presetExists = PRESET_PALETTES.some(p => p.id === saved.currentPaletteId);
        const customExists = customPalettes.some(p => p.id === saved.currentPaletteId);

        if (!presetExists && !customExists && saved.paletteColors) {
          // Palette doesn't exist but we have fallback colors - create temporary custom palette
          const tempPaletteId = `saved-julia-${id}`;
          const existingTemp = customPalettes.find(p => p.id === tempPaletteId);
          if (!existingTemp) {
            // Add the palette colors as a temporary custom palette
            set({
              customPalettes: [...customPalettes, {
                id: tempPaletteId,
                name: `${saved.name} Palette`,
                colors: saved.paletteColors,
              }],
            });
          }
          paletteId = tempPaletteId;
        } else if (!presetExists && !customExists) {
          // Palette doesn't exist and no fallback - use user's current palette
          paletteId = userCurrentPalette;
        }
      }

      pushHistory({
        fractalType: 'julia',
        juliaConstant: saved.constant,
        equationId: saved.equationId,
        viewBounds: bounds,
        juliaZoomFactor: saved.juliaZoomFactor ?? juliaZoomFactor,
        maxIterations: saved.maxIterations,
      });

      // Set color state separately (not part of history)
      set({
        currentPaletteId: paletteId,
        colorTemperature: saved.colorTemperature ?? 0,
      });
    }
  },

  updateSavedJulia: async (id, updates) => {
    const { savedJulias } = get();

    // Update in database
    const dbUpdates: Record<string, unknown> = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.constant !== undefined) {
      dbUpdates.real = updates.constant.real;
      dbUpdates.imag = updates.constant.imag;
    }
    if (updates.equationId !== undefined) dbUpdates.equationId = updates.equationId;
    if (updates.thumbnail !== undefined) dbUpdates.thumbnail = updates.thumbnail;

    await updatePoint(id, dbUpdates);

    // Update local state
    set({
      savedJulias: savedJulias.map((s) =>
        s.id === id ? { ...s, ...updates } : s
      ),
    });
  },

  loadSavedJuliasFromDb: async () => {
    const points = await getAllPoints();
    const savedJulias: SavedJulia[] = points.map((p) => ({
      id: p.id,
      constant: { real: p.real, imag: p.imag },
      equationId: p.equationId,
      name: p.name,
      thumbnail: p.thumbnail,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      // Extended state (may be undefined for old saves)
      viewBounds: p.viewBounds,
      maxIterations: p.maxIterations,
      juliaZoomFactor: p.juliaZoomFactor,
      currentPaletteId: p.currentPaletteId,
      colorTemperature: p.colorTemperature,
      paletteColors: p.paletteColors,
    }));
    set({ savedJulias });
  },

  setThumbnailCanvas: (canvas) => set({ thumbnailCanvas: canvas }),

  // Color system actions
  setCurrentPaletteId: (id: string) => set({ currentPaletteId: id }),

  setColorTemperature: (temp: number) => set({ colorTemperature: temp }),

  addCustomPalette: async (palette: { id: string; name: string; colors: RGB[] }) => {
    const { customPalettes } = get();
    // Save to database
    await dbAddCustomPalette({
      paletteId: palette.id,
      name: palette.name,
      colors: palette.colors,
    });
    // Update local state
    set({ customPalettes: [...customPalettes, palette] });
  },

  removeCustomPalette: async (id: string) => {
    const { customPalettes, currentPaletteId } = get();
    await dbDeleteCustomPalette(id);
    const newPalettes = customPalettes.filter((p) => p.id !== id);
    // If removing the currently selected palette, switch to default
    const updates: Partial<{ customPalettes: typeof customPalettes; currentPaletteId: string }> = {
      customPalettes: newPalettes,
    };
    if (currentPaletteId === id) {
      updates.currentPaletteId = 'default';
    }
    set(updates);
  },

  updateCustomPalette: async (id: string, updates: Partial<{ name: string; colors: RGB[] }>) => {
    const { customPalettes } = get();
    await dbUpdateCustomPalette(id, updates);
    set({
      customPalettes: customPalettes.map((p) =>
        p.id === id ? { ...p, ...updates } : p
      ),
    });
  },

  setShowColorSelector: (show: boolean) => set({ showColorSelector: show }),

  loadCustomPalettesFromDb: async () => {
    const palettes = await getAllCustomPalettes();
    const customPalettes = palettes.map((p) => ({
      id: p.paletteId,
      name: p.name,
      colors: p.colors,
    }));
    set({ customPalettes });
  },

  // 3D Mandelbulb actions
  switchToMandelbulb: () => {
    set({
      fractalType: 'mandelbulb',
      camera3D: { ...DEFAULT_CAMERA_3D },
    });
  },

  setCamera3D: (camera) => {
    const { camera3D } = get();
    set({ camera3D: { ...camera3D, ...camera } });
  },

  rotateCamera3D: (deltaX, deltaY) => {
    const { camera3D } = get();
    const sensitivity = 0.005;

    const pitch = camera3D.rotationX;
    const yaw = camera3D.rotationY;

    const cosPitch = Math.cos(pitch);
    const sinPitch = Math.sin(pitch);
    const cosYaw = Math.cos(yaw);
    const sinYaw = Math.sin(yaw);

    // Current camera direction (from origin to camera, normalized)
    let camDir = [cosPitch * sinYaw, sinPitch, cosPitch * cosYaw];

    // Camera's right axis (always horizontal)
    const right = [cosYaw, 0, -sinYaw];

    // Rodrigues' rotation formula: rotate vector v around axis by angle
    const rotateVector = (v: number[], axis: number[], angle: number): number[] => {
      const c = Math.cos(angle);
      const s = Math.sin(angle);
      const dot = v[0] * axis[0] + v[1] * axis[1] + v[2] * axis[2];
      const cross = [
        axis[1] * v[2] - axis[2] * v[1],
        axis[2] * v[0] - axis[0] * v[2],
        axis[0] * v[1] - axis[1] * v[0],
      ];
      return [
        v[0] * c + cross[0] * s + axis[0] * dot * (1 - c),
        v[1] * c + cross[1] * s + axis[1] * dot * (1 - c),
        v[2] * c + cross[2] * s + axis[2] * dot * (1 - c),
      ];
    };

    // Vertical drag: rotate around camera's right axis
    const pitchAngle = -deltaY * sensitivity;
    camDir = rotateVector(camDir, right, pitchAngle);

    // Horizontal drag: rotate around world Y (turntable mode)
    const yawAngle = -deltaX * sensitivity;
    camDir = rotateVector(camDir, [0, 1, 0], yawAngle);

    // Extract new pitch and yaw from camera direction
    let newPitch = Math.asin(Math.max(-1, Math.min(1, camDir[1])));
    let newYaw = Math.atan2(camDir[0], camDir[2]);

    // Clamp pitch to prevent going past ±90° (avoids gimbal lock)
    const maxPitch = Math.PI / 2 - 0.01;
    newPitch = Math.max(-maxPitch, Math.min(maxPitch, newPitch));

    set({
      camera3D: {
        ...camera3D,
        rotationX: newPitch,
        rotationY: newYaw,
      },
    });
  },

  zoomCamera3D: (delta) => {
    const { camera3D } = get();
    const zoomFactor = 1.1;
    const newDistance = delta > 0
      ? camera3D.distance * zoomFactor
      : camera3D.distance / zoomFactor;
    set({
      camera3D: {
        ...camera3D,
        distance: Math.max(0.5, Math.min(20, newDistance)),
      },
    });
  },

  resetCamera3D: () => {
    set({ camera3D: { ...DEFAULT_CAMERA_3D } });
  },

  setMandelbulbPower: (power) => {
    const { mandelbulbParams } = get();
    set({ mandelbulbParams: { ...mandelbulbParams, power } });
  },

  setFov: (fov) => {
    const { camera3D } = get();
    set({ camera3D: { ...camera3D, fov: Math.max(20, Math.min(120, fov)) } });
  },

  setLightingParams: (params) => {
    const { lightingParams } = get();
    set({ lightingParams: { ...lightingParams, ...params } });
  },

  resetLighting: () => {
    set({ lightingParams: { ...DEFAULT_LIGHTING_PARAMS } });
  },

  setRenderQuality: (quality) => {
    const { renderQuality } = get();
    set({ renderQuality: { ...renderQuality, ...quality } });
  },

  setQualityPreset: (preset) => {
    set({ renderQuality: { ...QUALITY_PRESETS[preset] } });
  },

  setEquation3DId: (id) => {
    const equation = getEquation3D(id);
    if (equation) {
      const { mandelbulbParams, camera3D } = get();
      const updates: Partial<{
        equation3dId: number;
        mandelbulbParams: typeof mandelbulbParams;
        camera3D: typeof camera3D;
      }> = {
        equation3dId: id,
      };
      // Update default power/scale if the equation has different defaults
      if (equation.defaultPower !== undefined) {
        updates.mandelbulbParams = { ...mandelbulbParams, power: equation.defaultPower };
      }
      if (equation.defaultScale !== undefined) {
        updates.mandelbulbParams = { ...(updates.mandelbulbParams || mandelbulbParams), scale: equation.defaultScale };
      }
      // Update camera defaults if specified
      if (equation.defaultDistance !== undefined || equation.defaultFov !== undefined) {
        updates.camera3D = { ...camera3D };
        if (equation.defaultDistance !== undefined) {
          updates.camera3D.distance = equation.defaultDistance;
        }
        if (equation.defaultFov !== undefined) {
          updates.camera3D.fov = equation.defaultFov;
        }
      }
      set(updates);
    } else {
      set({ equation3dId: id });
    }
  },

  setShowEquation3DSelector: (show) => set({ showEquation3DSelector: show }),

  setRenderQuality2D: (quality) => {
    const { renderQuality2D } = get();
    set({ renderQuality2D: { ...renderQuality2D, ...quality } });
  },

  setHighPrecisionActive: (active) => set({ isHighPrecisionActive: active }),

  // AI Suggestions actions
  generateSuggestions: () => {
    const { viewBounds, maxIterations, fractalType, equationId } = get();

    // Only generate suggestions in heatmap mode
    if (fractalType !== 'heatmap') return;

    set({ isLoadingSuggestions: true });

    // Most equations other than z²+c need reduced parameters to avoid hanging
    // Equation 1 is fast, everything else needs care
    const isSimpleEquation = equationId === 1;
    const adjustedMaxIter = isSimpleEquation ? Math.min(maxIterations, 100) : Math.min(maxIterations, 30);

    // Run suggestion generation with timeout protection
    const timeoutId = setTimeout(() => {
      // If still loading after 5 seconds, give up
      const state = get();
      if (state.isLoadingSuggestions) {
        console.warn('Suggestion generation timed out for equation', equationId);
        set({ suggestions: [], isLoadingSuggestions: false });
      }
    }, 5000);

    setTimeout(() => {
      try {
        const suggestions = getSuggestions(viewBounds, adjustedMaxIter, true, equationId, !isSimpleEquation);
        clearTimeout(timeoutId);
        set({ suggestions, isLoadingSuggestions: false });
      } catch (e) {
        console.error('Error generating suggestions:', e);
        clearTimeout(timeoutId);
        set({ suggestions: [], isLoadingSuggestions: false });
      }
    }, 0);
  },

  clearSuggestions: () => set({ suggestions: [], highlightedSuggestion: null }),

  setShowSuggestionsPanel: (show) => set({ showSuggestionsPanel: show }),

  setHighlightedSuggestion: (id) => set({ highlightedSuggestion: id }),

  applySuggestion: (suggestion: SuggestedPoint) => {
    const { switchToJulia } = get();
    switchToJulia(suggestion.point);
  },

  // Image Export actions
  setShowExportDialog: (show) => set({ showExportDialog: show }),

  setExportSettings: (settings) => {
    const { exportSettings } = get();
    const newSettings = { ...exportSettings, ...settings };
    saveExportSettings(newSettings);
    set({ exportSettings: newSettings });
  },

  setExportProgress: (progress) => set({ exportProgress: progress }),

  startExport: async () => {
    // Import dynamically to avoid circular dependencies
    const { exportImage } = await import('../lib/imageExporter');
    const state = get();

    const abortController = new AbortController();
    set({ isExporting: true, exportAbortController: abortController });

    try {
      await exportImage({
        fractalType: state.fractalType,
        viewBounds: state.viewBounds,
        juliaConstant: state.juliaConstant,
        equationId: state.equationId,
        maxIterations: state.maxIterations,
        paletteId: state.currentPaletteId,
        colorTemperature: state.colorTemperature,
        customPalettes: state.customPalettes,
        exportSettings: state.exportSettings,
        camera3D: state.camera3D,
        mandelbulbParams: state.mandelbulbParams,
        lightingParams: state.lightingParams,
        renderQuality: state.renderQuality,
        onProgress: (progress: ExportProgress) => {
          set({ exportProgress: progress });
        },
        abortSignal: abortController.signal,
      });
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') {
        console.log('Export cancelled');
      } else {
        console.error('Export failed:', e);
        throw e;
      }
    } finally {
      set({ isExporting: false, exportProgress: null, exportAbortController: null });
    }
  },

  cancelExport: () => {
    const { exportAbortController } = get();
    if (exportAbortController) {
      exportAbortController.abort();
    }
  },

  // UI Collapsed State actions
  setToolbarCollapsed: (collapsed) => set({ toolbarCollapsed: collapsed }),
  setToolbarWidth: (width) => set({ toolbarWidth: Math.max(275, Math.min(500, width)) }),  // Clamp between 275-500px
  setQualityCollapsed: (collapsed) => set({ qualityCollapsed: collapsed }),
  setSavedJuliasCollapsed: (collapsed) => set({ savedJuliasCollapsed: collapsed }),
  setInfoCollapsed: (collapsed) => set({ infoCollapsed: collapsed }),

  // Animation System actions
  setAnimationPanelCollapsed: (collapsed) => set({ animationPanelCollapsed: collapsed }),

  // Saved items dialogs
  setShowSavedAnimationsDialog: (show) => set({ showSavedAnimationsDialog: show }),
  setShowSavedJuliasDialog: (show) => set({ showSavedJuliasDialog: show }),
  // Help dialog
  setShowHelpDialog: (show) => set({ showHelpDialog: show }),

  // URL Sharing
  setShowShareToast: (show, message = '') => set({
    showShareToast: show,
    shareToastMessage: message
  }),

  shareCurrentView: async () => {
    const state = get();
    const shareableState: ShareableState = {
      version: 1,
      fractalType: state.fractalType,
      viewBounds: state.viewBounds,
      equationId: state.equationId,
      juliaConstant: state.juliaConstant,
      juliaZoomFactor: state.juliaZoomFactor,
      maxIterations: state.maxIterations,
      currentPaletteId: state.currentPaletteId,
      colorTemperature: state.colorTemperature,
      camera3D: state.fractalType === 'mandelbulb' ? state.camera3D : undefined,
      mandelbulbParams: state.fractalType === 'mandelbulb' ? state.mandelbulbParams : undefined,
      equation3dId: state.fractalType === 'mandelbulb' ? state.equation3dId : undefined,
    };

    const hash = encodeStateToHash(shareableState);
    const url = `${window.location.origin}${window.location.pathname}#${hash}`;
    const success = await copyToClipboard(url);

    set({
      showShareToast: true,
      shareToastMessage: success ? 'Link copied to clipboard!' : 'Failed to copy link'
    });

    // Auto-hide after 2 seconds
    setTimeout(() => {
      set({ showShareToast: false });
    }, 2000);
  },

  loadFromUrlHash: () => {
    const hash = window.location.hash;
    const urlState = decodeHashToState(hash);

    if (urlState) {
      const { customPalettes, currentPaletteId: userCurrentPalette } = get();
      const updates: Partial<typeof urlState> = {};

      if (urlState.fractalType) updates.fractalType = urlState.fractalType;
      if (urlState.viewBounds) updates.viewBounds = urlState.viewBounds;
      if (urlState.equationId) updates.equationId = urlState.equationId;
      if (urlState.juliaConstant) updates.juliaConstant = urlState.juliaConstant;
      if (urlState.juliaZoomFactor) updates.juliaZoomFactor = urlState.juliaZoomFactor;
      if (urlState.maxIterations) updates.maxIterations = urlState.maxIterations;

      // Handle palette - check if it exists, fall back to user's current palette if not
      if (urlState.currentPaletteId) {
        const presetExists = PRESET_PALETTES.some(p => p.id === urlState.currentPaletteId);
        const customExists = customPalettes.some(p => p.id === urlState.currentPaletteId);
        updates.currentPaletteId = (presetExists || customExists) ? urlState.currentPaletteId : userCurrentPalette;
      }

      if (urlState.colorTemperature !== undefined) updates.colorTemperature = urlState.colorTemperature;
      if (urlState.camera3D) updates.camera3D = urlState.camera3D;
      if (urlState.mandelbulbParams) updates.mandelbulbParams = urlState.mandelbulbParams;
      if (urlState.equation3dId) updates.equation3dId = urlState.equation3dId;

      // Apply the state from URL
      set(updates as Partial<FractalStore>);

      // Push to history so user can navigate back
      const { pushHistory } = get();
      pushHistory();

      // Clear the hash to avoid re-loading on manual refresh
      // Use replaceState to not add to browser history
      window.history.replaceState(null, '', window.location.pathname);
    }
  },

  addKeyframe: () => {
    const state = get();
    // Only allow adding keyframes for 2D fractals (mandelbrot, julia)
    if (state.fractalType !== 'mandelbrot' && state.fractalType !== 'julia') {
      console.warn('Animation only supports Mandelbrot and Julia fractals');
      return;
    }

    // Generate thumbnail from current canvas
    const thumbnail = generateKeyframeThumbnail(state.thumbnailCanvas);

    const newKeyframe: AnimationKeyframe = {
      id: crypto.randomUUID(),
      timestamp: calculateTotalDuration(state.keyframes),
      duration: 5000, // Default 5 second transition
      easing: 'linear',
      viewBounds: { ...state.viewBounds },
      fractalType: state.fractalType,
      juliaConstant: { ...state.juliaConstant },
      equationId: state.equationId,
      juliaZoomFactor: state.juliaZoomFactor,
      maxIterations: state.maxIterations,
      currentPaletteId: state.currentPaletteId,
      colorTemperature: state.colorTemperature,
      thumbnail,
    };

    // If a keyframe is selected, insert after it; otherwise append to end
    let newKeyframes: AnimationKeyframe[];
    if (state.selectedKeyframeId) {
      const selectedIndex = state.keyframes.findIndex(kf => kf.id === state.selectedKeyframeId);
      if (selectedIndex !== -1) {
        newKeyframes = [
          ...state.keyframes.slice(0, selectedIndex + 1),
          newKeyframe,
          ...state.keyframes.slice(selectedIndex + 1),
        ];
      } else {
        newKeyframes = [...state.keyframes, newKeyframe];
      }
    } else {
      newKeyframes = [...state.keyframes, newKeyframe];
    }

    set({ keyframes: newKeyframes, selectedKeyframeId: newKeyframe.id });
  },

  removeKeyframe: (id) => {
    const { keyframes } = get();
    const newKeyframes = keyframes.filter((kf) => kf.id !== id);
    set({
      keyframes: newKeyframes,
      selectedKeyframeId: get().selectedKeyframeId === id ? null : get().selectedKeyframeId,
    });
  },

  updateKeyframe: (id, updates) => {
    const { keyframes } = get();
    set({
      keyframes: keyframes.map((kf) =>
        kf.id === id ? { ...kf, ...updates } : kf
      ),
    });
  },

  reorderKeyframes: (fromIndex, toIndex) => {
    const { keyframes } = get();
    const newKeyframes = [...keyframes];
    const [removed] = newKeyframes.splice(fromIndex, 1);
    newKeyframes.splice(toIndex, 0, removed);
    // Recalculate timestamps
    let timestamp = 0;
    const updatedKeyframes = newKeyframes.map((kf, index) => {
      const updated = { ...kf, timestamp };
      if (index < newKeyframes.length - 1) {
        timestamp += kf.duration;
      }
      return updated;
    });
    set({ keyframes: updatedKeyframes });
  },

  selectKeyframe: (id) => set({ selectedKeyframeId: id }),

  applyKeyframe: (id) => {
    const { keyframes } = get();
    const keyframe = keyframes.find((kf) => kf.id === id);
    if (keyframe) {
      set({
        viewBounds: { ...keyframe.viewBounds },
        fractalType: keyframe.fractalType,
        juliaConstant: { ...keyframe.juliaConstant },
        equationId: keyframe.equationId,
        juliaZoomFactor: keyframe.juliaZoomFactor,
        maxIterations: keyframe.maxIterations,
        currentPaletteId: keyframe.currentPaletteId,
        colorTemperature: keyframe.colorTemperature,
      });
    }
  },

  clearKeyframes: () => set({
    keyframes: [],
    selectedKeyframeId: null,
    currentAnimationId: null,
    animationPlayback: { ...DEFAULT_ANIMATION_PLAYBACK },
  }),

  // Animation playback
  setAnimationPlayback: (playback) => {
    const { animationPlayback } = get();
    set({ animationPlayback: { ...animationPlayback, ...playback } });
  },

  // Apply animation state directly without side effects (for playback/export)
  applyAnimationState: (state) => {
    set({
      viewBounds: { ...state.viewBounds },
      fractalType: state.fractalType,
      juliaConstant: { ...state.juliaConstant },
      equationId: state.equationId,
      juliaZoomFactor: state.juliaZoomFactor,
      maxIterations: state.maxIterations,
      currentPaletteId: state.currentPaletteId,
      colorTemperature: state.colorTemperature,
    });
  },

  // Saved animations
  saveAnimation: async (name) => {
    const { keyframes } = get();
    if (keyframes.length === 0) return;

    const totalDuration = calculateTotalDuration(keyframes);
    const id = await dbAddAnimation({
      name,
      keyframes,
      totalDuration,
    });

    // Reload from database
    const animations = await getAllAnimations();
    set({ savedAnimations: animations, currentAnimationId: id });
    return id;
  },

  loadAnimation: async (id) => {
    const { savedAnimations } = get();
    const animation = savedAnimations.find((a) => a.id === id);
    if (animation) {
      set({
        keyframes: animation.keyframes,
        currentAnimationId: id,
        selectedKeyframeId: null,
        animationPlayback: { ...DEFAULT_ANIMATION_PLAYBACK },
      });
    }
  },

  deleteAnimation: async (id) => {
    await dbDeleteAnimation(id);
    const { currentAnimationId } = get();
    const animations = await getAllAnimations();
    set({
      savedAnimations: animations,
      currentAnimationId: currentAnimationId === id ? null : currentAnimationId,
    });
  },

  loadAnimationsFromDb: async () => {
    const animations = await getAllAnimations();
    set({ savedAnimations: animations });
  },

  updateSavedAnimation: async (id, updates) => {
    await dbUpdateAnimation(id, updates);
    const animations = await getAllAnimations();
    set({ savedAnimations: animations });
  },

  // Video Export actions
  setShowVideoExportDialog: (show) => set({ showVideoExportDialog: show }),

  setVideoExportSettings: (settings) => {
    const { videoExportSettings } = get();
    const newSettings = { ...videoExportSettings, ...settings };
    saveVideoExportSettings(newSettings);
    set({ videoExportSettings: newSettings });
  },

  setVideoExportProgress: (progress) => set({ videoExportProgress: progress }),

  setIsExportingVideo: (exporting) => set({ isExportingVideo: exporting }),

  setVideoExportAbortController: (controller) => set({ videoExportAbortController: controller }),

  cancelVideoExport: () => {
    const { videoExportAbortController } = get();
    if (videoExportAbortController) {
      videoExportAbortController.abort();
    }
    set({
      isExportingVideo: false,
      videoExportProgress: null,
      videoExportAbortController: null,
    });
  },
}),
    {
      name: 'fractal-settings',
      version: 1,
      partialize: (state) => ({
        // Persist user preferences (not transient exploration state)
        maxIterations: state.maxIterations,
        currentPaletteId: state.currentPaletteId,
        colorTemperature: state.colorTemperature,
        customPalettes: state.customPalettes,
        renderQuality2D: state.renderQuality2D,
        renderQuality: state.renderQuality,
        lightingParams: state.lightingParams,
        // UI collapsed states
        toolbarCollapsed: state.toolbarCollapsed,
        toolbarWidth: state.toolbarWidth,
        qualityCollapsed: state.qualityCollapsed,
        savedJuliasCollapsed: state.savedJuliasCollapsed,
        infoCollapsed: state.infoCollapsed,
        animationPanelCollapsed: state.animationPanelCollapsed,
        // Persist current keyframes as working draft (thumbnails are ~3KB each, acceptable for localStorage)
        keyframes: state.keyframes,
      }),
    }
  )
);
