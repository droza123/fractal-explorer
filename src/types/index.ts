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
}

export interface FractalActions {
  setViewBounds: (bounds: ViewBounds) => void;
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
  resetView: () => void;
  setFractalType: (type: FractalType) => void;
  setJuliaConstant: (c: Complex) => void;
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
}

export type FractalStore = FractalState & FractalActions;
