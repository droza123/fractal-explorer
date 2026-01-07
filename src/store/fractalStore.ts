import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { FractalStore, ViewBounds, FractalType, Complex, HistoryEntry, SavedJulia, Camera3D, MandelbulbParams, LightingParams, RenderQuality, RenderQuality2D, SuggestedPoint, ExportSettings, ExportProgress, AnimationKeyframe, Animation, AnimationPlaybackState, VideoExportSettings, VideoExportProgress } from '../types';
import { addPoint, deletePoint, updatePoint, getAllPoints, getAllCustomPalettes, addCustomPalette as dbAddCustomPalette, updateCustomPalette as dbUpdateCustomPalette, deleteCustomPalette as dbDeleteCustomPalette } from '../db/database';
import { getAllAnimations, addAnimation as dbAddAnimation, updateAnimation as dbUpdateAnimation, deleteAnimation as dbDeleteAnimation } from '../db/animations';
import type { RGB } from '../lib/colors';
import { getSuggestions } from '../lib/suggestions';
import { calculateTotalDuration } from '../lib/animation/interpolation';
import { generateKeyframeThumbnail } from '../lib/animation/thumbnailGenerator';
import { ViewBoundsAnimator } from '../lib/animation/viewBoundsAnimator';

// Global zoom animator instance (not stored in state to avoid serialization issues)
let zoomAnimator: ViewBoundsAnimator | null = null;

const DEFAULT_CAMERA_3D: Camera3D = {
  distance: 2.5,
  rotationX: 0.3,      // Pitch: slight elevation angle
  rotationY: 0.4,      // Yaw: slight horizontal rotation for better initial view
  fov: 60,
};

const DEFAULT_MANDELBULB_PARAMS: MandelbulbParams = {
  power: 8,
  bailout: 2.0,
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
  detailLevel: 0.8,
};

const QUALITY_PRESETS: Record<'low' | 'medium' | 'high' | 'ultra', RenderQuality> = {
  low: { maxSteps: 64, shadowSteps: 0, aoSamples: 0, detailLevel: 1.0 },
  medium: { maxSteps: 256, shadowSteps: 32, aoSamples: 5, detailLevel: 0.8 },
  high: { maxSteps: 512, shadowSteps: 64, aoSamples: 8, detailLevel: 0.6 },
  ultra: { maxSteps: 1024, shadowSteps: 128, aoSamples: 12, detailLevel: 0.4 },
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
    const { juliaConstant, equationId, savedJulias, thumbnailCanvas } = get();

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

    const pointName = name || `Point ${savedJulias.length + 1}`;

    // Save to IndexedDB
    const id = await addPoint({
      equationId,
      real: juliaConstant.real,
      imag: juliaConstant.imag,
      name: pointName,
      thumbnail,
    });

    // Update local state and show save indicator
    const newSaved: SavedJulia = {
      id,
      constant: { ...juliaConstant },
      equationId,
      name: pointName,
      thumbnail,
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
    const { savedJulias, juliaZoomFactor, pushHistory } = get();
    const saved = savedJulias.find((s) => s.id === id);
    if (saved) {
      const bounds = getJuliaBounds(juliaZoomFactor);
      pushHistory({
        fractalType: 'julia',
        juliaConstant: saved.constant,
        equationId: saved.equationId,
        viewBounds: bounds,
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
    set({
      camera3D: {
        ...camera3D,
        rotationY: camera3D.rotationY - deltaX * sensitivity,
        rotationX: camera3D.rotationX + deltaY * sensitivity,
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
  setQualityCollapsed: (collapsed) => set({ qualityCollapsed: collapsed }),
  setSavedJuliasCollapsed: (collapsed) => set({ savedJuliasCollapsed: collapsed }),
  setInfoCollapsed: (collapsed) => set({ infoCollapsed: collapsed }),

  // Animation System actions
  setAnimationPanelCollapsed: (collapsed) => set({ animationPanelCollapsed: collapsed }),

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
      duration: 2000, // Default 2 second transition
      easing: 'ease-in-out',
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

    set({ keyframes: [...state.keyframes, newKeyframe] });
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
        qualityCollapsed: state.qualityCollapsed,
        savedJuliasCollapsed: state.savedJuliasCollapsed,
        infoCollapsed: state.infoCollapsed,
        animationPanelCollapsed: state.animationPanelCollapsed,
      }),
    }
  )
);
