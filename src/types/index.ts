export interface ViewBounds {
  minReal: number;
  maxReal: number;
  minImag: number;
  maxImag: number;
}

export interface Complex {
  real: number;
  imag: number;
}

export interface SelectionRect {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

export type RenderMode = 'webgl' | 'canvas2d';
export type FractalType = 'mandelbrot' | 'julia' | 'heatmap' | 'mandelbulb';

// 3D Camera for Mandelbulb
export interface Camera3D {
  distance: number;      // Distance from origin
  rotationX: number;     // Vertical rotation (pitch) in radians
  rotationY: number;     // Horizontal rotation (yaw) in radians
  fov: number;           // Field of view in degrees
}

// Mandelbulb parameters
export interface MandelbulbParams {
  power: number;         // Power parameter (classic is 8)
  bailout: number;       // Escape radius
}

// Lighting parameters for 3D rendering
export interface LightingParams {
  ambient: number;       // Ambient light intensity (0-1)
  diffuse: number;       // Diffuse light intensity (0-1)
  specular: number;      // Specular highlight intensity (0-1)
  shininess: number;     // Specular shininess (1-128)
  lightAngleX: number;   // Light direction horizontal angle
  lightAngleY: number;   // Light direction vertical angle
}

// Render quality parameters for 3D
export interface RenderQuality {
  maxSteps: number;      // Ray march steps (64-512)
  shadowSteps: number;   // Shadow ray steps (0=off, 16-64)
  aoSamples: number;     // Ambient occlusion samples (0=off, 3-8)
  detailLevel: number;   // Step size multiplier (0.5=high detail, 1.0=fast)
}

// Precision mode for deep zoom
export type PrecisionMode = 'auto' | 'standard' | 'high';

// Render quality parameters for 2D
export interface RenderQuality2D {
  antiAlias: number;     // Anti-aliasing samples per axis for GPU (1=off, 2=4x, 3=9x, 4=16x)
  antiAliasCPU: number;  // Anti-aliasing samples per axis for CPU (1=off, 2=4x, 3=9x)
  precisionMode: PrecisionMode;  // Precision mode for deep zoom
  precisionSwitchZoom: number;   // Zoom level at which to switch to CPU (in auto mode)
}

export interface HistoryEntry {
  viewBounds: ViewBounds;
  fractalType: FractalType;
  juliaConstant: Complex;
  equationId: number;
  juliaZoomFactor: number;
  maxIterations: number;
}

export interface SavedJulia {
  id?: number;
  constant: Complex;
  equationId: number;
  name: string;
  thumbnail: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CursorPosition {
  x: number;
  y: number;
  real: number;
  imag: number;
}

// AI Suggestions
export type SuggestionCategory =
  | 'boundary'
  | 'classic'
  | 'high-variance';

export interface SuggestedPoint {
  id: string;
  point: Complex;
  score: number;
  category: SuggestionCategory;
  description: string;
}

export interface FractalState {
  viewBounds: ViewBounds;
  maxIterations: number;
  renderMode: RenderMode;
  isRendering: boolean;
  selection: SelectionRect | null;
  history: HistoryEntry[];
  historyIndex: number;
  fractalType: FractalType;
  juliaConstant: Complex;
  equationId: number;
  juliaZoomFactor: number;
  showEquationSelector: boolean;
  // Heat map mode state
  heatmapPreviewConstant: Complex | null;
  savedJulias: SavedJulia[];
  cursorPosition: CursorPosition | null;
  // Thumbnail generation
  thumbnailCanvas: HTMLCanvasElement | null;
  // Save indicator
  showSaveIndicator: boolean;
  // Color system
  currentPaletteId: string;
  colorTemperature: number; // -1 (cooler) to 1 (warmer)
  customPalettes: { id: string; name: string; colors: { r: number; g: number; b: number }[] }[];
  showColorSelector: boolean;
  // 3D Mandelbulb state
  camera3D: Camera3D;
  mandelbulbParams: MandelbulbParams;
  lightingParams: LightingParams;
  renderQuality: RenderQuality;
  // 2D quality settings
  renderQuality2D: RenderQuality2D;
  // High precision rendering active (using CPU Canvas 2D)
  isHighPrecisionActive: boolean;
  // AI Suggestions
  suggestions: SuggestedPoint[];
  isLoadingSuggestions: boolean;
  showSuggestionsPanel: boolean;
  highlightedSuggestion: string | null;
  // Image Export
  showExportDialog: boolean;
  isExporting: boolean;
  exportProgress: ExportProgress | null;
  exportSettings: ExportSettings;
  exportAbortController: AbortController | null;
  // UI Collapsed States
  qualityCollapsed: boolean;
  savedJuliasCollapsed: boolean;
  infoCollapsed: boolean;
  // Animation System
  keyframes: AnimationKeyframe[];
  selectedKeyframeId: string | null;
  savedAnimations: Animation[];
  currentAnimationId: number | null;
  animationPlayback: AnimationPlaybackState;
  // Video Export
  showVideoExportDialog: boolean;
  isExportingVideo: boolean;
  videoExportProgress: VideoExportProgress | null;
  videoExportSettings: VideoExportSettings;
  videoExportAbortController: AbortController | null;
  // Animation UI
  animationPanelCollapsed: boolean;
  // Saved items dialogs
  showSavedAnimationsDialog: boolean;
  showSavedJuliasDialog: boolean;
}

// Image Export
export interface ExportSettings {
  width: number;
  height: number;
  format: 'png' | 'jpeg' | 'webp';
  quality: number; // 0.1-1.0 for JPEG/WebP
  aspectLocked: boolean;
}

export interface ExportProgress {
  phase: 'preparing' | 'rendering' | 'assembling' | 'encoding' | 'complete';
  currentTile: number;
  totalTiles: number;
  percent: number;
}

export interface FractalActions {
  setViewBounds: (bounds: ViewBounds) => void;
  setViewBoundsWithZoom: (bounds: ViewBounds, commit?: boolean) => void;
  setMaxIterations: (iterations: number) => void;
  setRenderMode: (mode: RenderMode) => void;
  setIsRendering: (rendering: boolean) => void;
  setSelection: (selection: SelectionRect | null) => void;
  pushHistory: (entry?: Partial<HistoryEntry>) => void;
  goBack: () => boolean;
  goForward: () => boolean;
  canGoBack: () => boolean;
  canGoForward: () => boolean;
  zoomToSelection: (canvasWidth: number, canvasHeight: number) => void;
  zoomAtPoint: (x: number, y: number, factor: number, canvasWidth: number, canvasHeight: number) => void;
  zoomAtPointAnimated: (x: number, y: number, factor: number, canvasWidth: number, canvasHeight: number) => void;
  resetView: () => void;
  setFractalType: (type: FractalType) => void;
  setJuliaConstant: (c: Complex) => void;
  resetJuliaConstant: () => void;
  setEquationId: (id: number) => void;
  setJuliaZoomFactor: (factor: number, commit?: boolean) => void;
  setShowEquationSelector: (show: boolean) => void;
  switchToJulia: (c: Complex) => void;
  switchToMandelbrot: () => void;
  // Heat map mode actions
  switchToHeatmap: () => void;
  setHeatmapPreviewConstant: (c: Complex | null) => void;
  setCursorPosition: (pos: CursorPosition | null) => void;
  saveCurrentJulia: (name?: string) => Promise<void>;
  removeSavedJulia: (id: number) => Promise<void>;
  loadSavedJulia: (id: number) => void;
  updateSavedJulia: (id: number, updates: Partial<SavedJulia>) => Promise<void>;
  loadSavedJuliasFromDb: () => Promise<void>;
  // For generating thumbnails
  setThumbnailCanvas: (canvas: HTMLCanvasElement | null) => void;
  // Color system actions
  setCurrentPaletteId: (id: string) => void;
  setColorTemperature: (temp: number) => void;
  addCustomPalette: (palette: { id: string; name: string; colors: { r: number; g: number; b: number }[] }) => Promise<void>;
  removeCustomPalette: (id: string) => Promise<void>;
  updateCustomPalette: (id: string, updates: Partial<{ name: string; colors: { r: number; g: number; b: number }[] }>) => Promise<void>;
  setShowColorSelector: (show: boolean) => void;
  loadCustomPalettesFromDb: () => Promise<void>;
  // 3D Mandelbulb actions
  switchToMandelbulb: () => void;
  setCamera3D: (camera: Partial<Camera3D>) => void;
  rotateCamera3D: (deltaX: number, deltaY: number) => void;
  zoomCamera3D: (delta: number) => void;
  resetCamera3D: () => void;
  setMandelbulbPower: (power: number) => void;
  setFov: (fov: number) => void;
  setLightingParams: (params: Partial<LightingParams>) => void;
  resetLighting: () => void;
  setRenderQuality: (quality: Partial<RenderQuality>) => void;
  setQualityPreset: (preset: 'low' | 'medium' | 'high' | 'ultra') => void;
  // 2D quality actions
  setRenderQuality2D: (quality: Partial<RenderQuality2D>) => void;
  setHighPrecisionActive: (active: boolean) => void;
  // AI Suggestions actions
  generateSuggestions: () => void;
  clearSuggestions: () => void;
  setShowSuggestionsPanel: (show: boolean) => void;
  setHighlightedSuggestion: (id: string | null) => void;
  applySuggestion: (suggestion: SuggestedPoint) => void;
  // Image Export actions
  setShowExportDialog: (show: boolean) => void;
  setExportSettings: (settings: Partial<ExportSettings>) => void;
  startExport: () => Promise<void>;
  cancelExport: () => void;
  setExportProgress: (progress: ExportProgress | null) => void;
  // UI Collapsed State actions
  setQualityCollapsed: (collapsed: boolean) => void;
  setSavedJuliasCollapsed: (collapsed: boolean) => void;
  setInfoCollapsed: (collapsed: boolean) => void;
  // Animation System actions
  setAnimationPanelCollapsed: (collapsed: boolean) => void;
  addKeyframe: () => void;
  removeKeyframe: (id: string) => void;
  updateKeyframe: (id: string, updates: Partial<AnimationKeyframe>) => void;
  reorderKeyframes: (fromIndex: number, toIndex: number) => void;
  selectKeyframe: (id: string | null) => void;
  applyKeyframe: (id: string) => void;
  clearKeyframes: () => void;
  // Animation playback
  setAnimationPlayback: (playback: Partial<AnimationPlaybackState>) => void;
  applyAnimationState: (state: {
    viewBounds: ViewBounds;
    fractalType: 'mandelbrot' | 'julia';
    juliaConstant: Complex;
    equationId: number;
    juliaZoomFactor: number;
    maxIterations: number;
    currentPaletteId: string;
    colorTemperature: number;
  }) => void;
  // Saved animations
  saveAnimation: (name: string) => Promise<number | undefined>;
  loadAnimation: (id: number) => Promise<void>;
  deleteAnimation: (id: number) => Promise<void>;
  loadAnimationsFromDb: () => Promise<void>;
  updateSavedAnimation: (id: number, updates: Partial<Animation>) => Promise<void>;
  // Video Export actions
  setShowVideoExportDialog: (show: boolean) => void;
  setVideoExportSettings: (settings: Partial<VideoExportSettings>) => void;
  setVideoExportProgress: (progress: VideoExportProgress | null) => void;
  setIsExportingVideo: (exporting: boolean) => void;
  setVideoExportAbortController: (controller: AbortController | null) => void;
  cancelVideoExport: () => void;
  // Saved items dialogs
  setShowSavedAnimationsDialog: (show: boolean) => void;
  setShowSavedJuliasDialog: (show: boolean) => void;
}

export type FractalStore = FractalState & FractalActions;

// Animation System Types
export type EasingFunction = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';

export interface AnimationKeyframe {
  id: string;
  timestamp: number;           // Position in timeline (ms from start)
  duration: number;            // Time to next keyframe (ms)
  easing: EasingFunction;
  // Captured fractal state
  viewBounds: ViewBounds;
  fractalType: 'mandelbrot' | 'julia';
  juliaConstant: Complex;
  equationId: number;
  juliaZoomFactor: number;
  maxIterations: number;
  currentPaletteId: string;
  colorTemperature: number;
  // Metadata
  thumbnail: string | null;
  name?: string;
}

export interface Animation {
  id?: number;
  name: string;
  keyframes: AnimationKeyframe[];
  totalDuration: number;
  createdAt: Date;
  updatedAt: Date;
}

export type VideoRenderQuality = 'standard' | 'high' | 'ultra';

// Precision mode for video export rendering
export type VideoRenderPrecision = 'auto' | 'gpu' | 'cpu';

export interface VideoExportSettings {
  format: 'webm' | 'mp4';
  fps: 30 | 60;
  resolution: '720p' | '1080p' | '4k' | '8k' | 'custom';
  customWidth?: number;
  customHeight?: number;
  quality: number;                // Bitrate quality 0.1-1.0
  codec: 'vp9' | 'vp8' | 'h264';
  renderQuality: VideoRenderQuality;
  renderPrecision: VideoRenderPrecision;  // GPU (fast) vs CPU (high precision for deep zooms)
}

export interface AnimationPlaybackState {
  isPlaying: boolean;
  isPreviewing: boolean;
  currentTime: number;           // Current position in ms
  playbackSpeed: number;         // 0.25, 0.5, 1, 2
}

export interface VideoExportProgress {
  phase: 'loading' | 'preparing' | 'rendering' | 'writing' | 'encoding' | 'finalizing' | 'complete';
  currentFrame: number;
  totalFrames: number;
  percent: number;
}

// File System Access API types (for browsers that support it)
declare global {
  interface Window {
    showDirectoryPicker?: (options?: {
      mode?: 'read' | 'readwrite';
      startIn?: 'desktop' | 'documents' | 'downloads' | 'music' | 'pictures' | 'videos';
    }) => Promise<FileSystemDirectoryHandle>;
  }
}
