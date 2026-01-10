import type { ViewBounds, RenderMode, FractalType, Complex, Camera3D, MandelbulbParams, LightingParams, RenderQuality, PrecisionMode } from '../types';
import vertexShaderSource from './shaders/vertex.glsl?raw';
import mandelbrotShaderSource from './shaders/mandelbrot.glsl?raw';
import juliaShaderSource from './shaders/julia.glsl?raw';
import heatmapShaderSource from './shaders/heatmap.glsl?raw';
import mandelbulbShaderSource from './shaders/mandelbulb.glsl?raw';
import mandelbrotHPShaderSource from './shaders/mandelbrot-hp.glsl?raw';
import juliaHPShaderSource from './shaders/julia-hp.glsl?raw';

interface ShaderProgram {
  program: WebGLProgram;
  uniforms: {
    resolution: WebGLUniformLocation | null;
    boundsMin: WebGLUniformLocation | null;
    boundsMax: WebGLUniformLocation | null;
    bounds: WebGLUniformLocation | null; // vec4 for heatmap
    maxIterations: WebGLUniformLocation | null;
    colorOffset: WebGLUniformLocation | null;
    palette: WebGLUniformLocation | null;
    paletteSize: WebGLUniformLocation | null;
    antiAlias: WebGLUniformLocation | null;
    juliaC?: WebGLUniformLocation | null;
    equation?: WebGLUniformLocation | null;
  };
}

interface MandelbulbUniforms {
  resolution: WebGLUniformLocation | null;
  maxIterations: WebGLUniformLocation | null;
  power: WebGLUniformLocation | null;
  bailout: WebGLUniformLocation | null;
  // Equation selection
  equation: WebGLUniformLocation | null;
  scale: WebGLUniformLocation | null;
  minRadius: WebGLUniformLocation | null;
  // Camera
  cameraPos: WebGLUniformLocation | null;
  cameraRotation: WebGLUniformLocation | null;
  fov: WebGLUniformLocation | null;
  palette: WebGLUniformLocation | null;
  paletteSize: WebGLUniformLocation | null;
  colorOffset: WebGLUniformLocation | null;
  lightDir: WebGLUniformLocation | null;
  ambient: WebGLUniformLocation | null;
  diffuse: WebGLUniformLocation | null;
  specular: WebGLUniformLocation | null;
  shininess: WebGLUniformLocation | null;
  // Quality settings
  maxSteps: WebGLUniformLocation | null;
  shadowSteps: WebGLUniformLocation | null;
  aoSamples: WebGLUniformLocation | null;
  stepScale: WebGLUniformLocation | null;
}

interface MandelbulbProgram {
  program: WebGLProgram;
  uniforms: MandelbulbUniforms;
}

// High-precision shader program interface
interface HPShaderProgram {
  program: WebGLProgram;
  uniforms: {
    resolution: WebGLUniformLocation | null;
    boundsMinHi: WebGLUniformLocation | null;
    boundsMinLo: WebGLUniformLocation | null;
    boundsMaxHi: WebGLUniformLocation | null;
    boundsMaxLo: WebGLUniformLocation | null;
    maxIterations: WebGLUniformLocation | null;
    colorOffset: WebGLUniformLocation | null;
    palette: WebGLUniformLocation | null;
    paletteSize: WebGLUniformLocation | null;
    antiAlias: WebGLUniformLocation | null;
    debugMode: WebGLUniformLocation | null;
    juliaC?: WebGLUniformLocation | null;
  };
}

export class WebGLRenderer {
  private canvas: HTMLCanvasElement;
  private gl: WebGL2RenderingContext | null = null;
  private positionBuffer: WebGLBuffer | null = null;
  private vertexShader: WebGLShader | null = null;

  private mandelbrotProgram: ShaderProgram | null = null;
  private juliaProgram: ShaderProgram | null = null;
  private heatmapProgram: ShaderProgram | null = null;
  private mandelbulbProgram: MandelbulbProgram | null = null;
  private mandelbrotHPProgram: HPShaderProgram | null = null;
  private juliaHPProgram: HPShaderProgram | null = null;
  private currentProgram: ShaderProgram | null = null;
  private currentType: FractalType = 'mandelbrot';
  private useHighPrecision: boolean = false;

  // Color palette data (pre-interpolated for shader)
  private paletteData: Float32Array = new Float32Array(64 * 3);
  private paletteSize: number = 64;

  // Context loss handling
  private contextLost: boolean = false;
  private onContextLost: (() => void) | null = null;
  private onContextRestored: (() => void) | null = null;
  private boundHandleContextLost: (e: Event) => void;
  private boundHandleContextRestored: (e: Event) => void;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;

    // Bind context loss handlers
    this.boundHandleContextLost = this.handleContextLost.bind(this);
    this.boundHandleContextRestored = this.handleContextRestored.bind(this);

    // Listen for context loss/restoration events
    this.canvas.addEventListener('webglcontextlost', this.boundHandleContextLost, false);
    this.canvas.addEventListener('webglcontextrestored', this.boundHandleContextRestored, false);

    this.initWebGL();
    this.initDefaultPalette();
  }

  private handleContextLost(event: Event): void {
    event.preventDefault(); // Allow context restoration
    console.warn('WebGL context lost');
    this.contextLost = true;
    this.gl = null;
    this.onContextLost?.();
  }

  private handleContextRestored(_event: Event): void {
    console.log('WebGL context restored, reinitializing...');
    this.contextLost = false;

    // Reinitialize WebGL
    if (this.initWebGL()) {
      console.log('WebGL reinitialized successfully');
      this.onContextRestored?.();
    } else {
      console.error('Failed to reinitialize WebGL after context restoration');
    }
  }

  // Set callbacks for context loss/restoration
  public setContextLostCallback(callback: (() => void) | null): void {
    this.onContextLost = callback;
  }

  public setContextRestoredCallback(callback: (() => void) | null): void {
    this.onContextRestored = callback;
  }

  // Check if context is currently lost
  public isContextLost(): boolean {
    return this.contextLost;
  }

  private initDefaultPalette(): void {
    // Initialize with a default gradient (cyan -> purple -> red)
    for (let i = 0; i < 64; i++) {
      const t = i / 63;
      // Cyan to purple to red gradient
      const r = t < 0.5 ? t * 2 * 0.5 : 0.5 + (t - 0.5) * 2 * 0.5;
      const g = t < 0.5 ? 0.5 - t : 0;
      const b = t < 0.5 ? 0.5 : 0.5 - (t - 0.5);
      this.paletteData[i * 3] = r;
      this.paletteData[i * 3 + 1] = g;
      this.paletteData[i * 3 + 2] = b;
    }
  }

  // Set the color palette from an array of normalized RGB values
  // The array should be flat: [r1, g1, b1, r2, g2, b2, ...]
  public setPalette(colors: number[]): void {
    const size = Math.min(Math.floor(colors.length / 3), 64);
    this.paletteSize = size;
    for (let i = 0; i < size * 3; i++) {
      this.paletteData[i] = colors[i];
    }
  }

  private initWebGL(): boolean {
    const gl = this.canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      depth: false,
      preserveDrawingBuffer: true,
    });

    if (!gl) {
      console.warn('WebGL 2.0 not available');
      return false;
    }

    this.gl = gl;

    this.vertexShader = this.compileShader(gl.VERTEX_SHADER, vertexShaderSource);
    if (!this.vertexShader) {
      return false;
    }

    this.mandelbrotProgram = this.createShaderProgram(mandelbrotShaderSource, 'mandelbrot');
    this.juliaProgram = this.createShaderProgram(juliaShaderSource, 'julia');
    this.heatmapProgram = this.createShaderProgram(heatmapShaderSource, 'heatmap');
    this.mandelbulbProgram = this.createMandelbulbProgram();
    this.mandelbrotHPProgram = this.createHPShaderProgram(mandelbrotHPShaderSource, 'mandelbrot');
    this.juliaHPProgram = this.createHPShaderProgram(juliaHPShaderSource, 'julia');

    if (!this.mandelbrotProgram || !this.juliaProgram || !this.heatmapProgram || !this.mandelbulbProgram) {
      return false;
    }
    // HP programs are optional - continue if they fail (will fall back to standard precision)
    if (!this.mandelbrotHPProgram) {
      console.warn('High-precision Mandelbrot shader not available');
    }
    if (!this.juliaHPProgram) {
      console.warn('High-precision Julia shader not available');
    }

    this.setupGeometry();
    this.currentProgram = this.mandelbrotProgram;

    return true;
  }

  private compileShader(type: number, source: string): WebGLShader | null {
    if (!this.gl) return null;

    const shader = this.gl.createShader(type);
    if (!shader) return null;

    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);

    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      console.error('Shader compilation error:', this.gl.getShaderInfoLog(shader));
      this.gl.deleteShader(shader);
      return null;
    }

    return shader;
  }

  private createShaderProgram(fragmentSource: string, type: FractalType): ShaderProgram | null {
    if (!this.gl || !this.vertexShader) return null;

    const fragmentShader = this.compileShader(this.gl.FRAGMENT_SHADER, fragmentSource);
    if (!fragmentShader) return null;

    const program = this.gl.createProgram();
    if (!program) {
      this.gl.deleteShader(fragmentShader);
      return null;
    }

    this.gl.attachShader(program, this.vertexShader);
    this.gl.attachShader(program, fragmentShader);
    this.gl.linkProgram(program);

    if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
      console.error('Program linking error:', this.gl.getProgramInfoLog(program));
      this.gl.deleteProgram(program);
      this.gl.deleteShader(fragmentShader);
      return null;
    }

    this.gl.deleteShader(fragmentShader);

    const uniforms: ShaderProgram['uniforms'] = {
      resolution: this.gl.getUniformLocation(program, 'u_resolution'),
      boundsMin: this.gl.getUniformLocation(program, 'u_boundsMin'),
      boundsMax: this.gl.getUniformLocation(program, 'u_boundsMax'),
      bounds: this.gl.getUniformLocation(program, 'u_bounds'),
      maxIterations: this.gl.getUniformLocation(program, 'u_maxIterations'),
      colorOffset: this.gl.getUniformLocation(program, 'u_colorOffset'),
      palette: this.gl.getUniformLocation(program, 'u_palette'),
      paletteSize: this.gl.getUniformLocation(program, 'u_paletteSize'),
      antiAlias: this.gl.getUniformLocation(program, 'u_antiAlias'),
    };

    if (type === 'julia' || type === 'heatmap') {
      uniforms.equation = this.gl.getUniformLocation(program, 'u_equation');
    }
    if (type === 'julia') {
      uniforms.juliaC = this.gl.getUniformLocation(program, 'u_juliaC');
    }

    return { program, uniforms };
  }

  private createHPShaderProgram(fragmentSource: string, type: 'mandelbrot' | 'julia'): HPShaderProgram | null {
    if (!this.gl || !this.vertexShader) return null;

    const fragmentShader = this.compileShader(this.gl.FRAGMENT_SHADER, fragmentSource);
    if (!fragmentShader) return null;

    const program = this.gl.createProgram();
    if (!program) {
      this.gl.deleteShader(fragmentShader);
      return null;
    }

    this.gl.attachShader(program, this.vertexShader);
    this.gl.attachShader(program, fragmentShader);
    this.gl.linkProgram(program);

    if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
      console.error('HP Program linking error:', this.gl.getProgramInfoLog(program));
      this.gl.deleteProgram(program);
      this.gl.deleteShader(fragmentShader);
      return null;
    }

    this.gl.deleteShader(fragmentShader);

    const uniforms: HPShaderProgram['uniforms'] = {
      resolution: this.gl.getUniformLocation(program, 'u_resolution'),
      boundsMinHi: this.gl.getUniformLocation(program, 'u_boundsMinHi'),
      boundsMinLo: this.gl.getUniformLocation(program, 'u_boundsMinLo'),
      boundsMaxHi: this.gl.getUniformLocation(program, 'u_boundsMaxHi'),
      boundsMaxLo: this.gl.getUniformLocation(program, 'u_boundsMaxLo'),
      maxIterations: this.gl.getUniformLocation(program, 'u_maxIterations'),
      colorOffset: this.gl.getUniformLocation(program, 'u_colorOffset'),
      palette: this.gl.getUniformLocation(program, 'u_palette'),
      paletteSize: this.gl.getUniformLocation(program, 'u_paletteSize'),
      antiAlias: this.gl.getUniformLocation(program, 'u_antiAlias'),
      debugMode: this.gl.getUniformLocation(program, 'u_debugMode'),
    };

    if (type === 'julia') {
      uniforms.juliaC = this.gl.getUniformLocation(program, 'u_juliaC');
    }

    return { program, uniforms };
  }

  private createMandelbulbProgram(): MandelbulbProgram | null {
    if (!this.gl || !this.vertexShader) return null;

    const fragmentShader = this.compileShader(this.gl.FRAGMENT_SHADER, mandelbulbShaderSource);
    if (!fragmentShader) return null;

    const program = this.gl.createProgram();
    if (!program) {
      this.gl.deleteShader(fragmentShader);
      return null;
    }

    this.gl.attachShader(program, this.vertexShader);
    this.gl.attachShader(program, fragmentShader);
    this.gl.linkProgram(program);

    if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
      console.error('Mandelbulb program linking error:', this.gl.getProgramInfoLog(program));
      this.gl.deleteProgram(program);
      this.gl.deleteShader(fragmentShader);
      return null;
    }

    this.gl.deleteShader(fragmentShader);

    const uniforms: MandelbulbUniforms = {
      resolution: this.gl.getUniformLocation(program, 'u_resolution'),
      maxIterations: this.gl.getUniformLocation(program, 'u_maxIterations'),
      power: this.gl.getUniformLocation(program, 'u_power'),
      bailout: this.gl.getUniformLocation(program, 'u_bailout'),
      // Equation selection
      equation: this.gl.getUniformLocation(program, 'u_equation'),
      scale: this.gl.getUniformLocation(program, 'u_scale'),
      minRadius: this.gl.getUniformLocation(program, 'u_minRadius'),
      // Camera
      cameraPos: this.gl.getUniformLocation(program, 'u_cameraPos'),
      cameraRotation: this.gl.getUniformLocation(program, 'u_cameraRotation'),
      fov: this.gl.getUniformLocation(program, 'u_fov'),
      palette: this.gl.getUniformLocation(program, 'u_palette'),
      paletteSize: this.gl.getUniformLocation(program, 'u_paletteSize'),
      colorOffset: this.gl.getUniformLocation(program, 'u_colorOffset'),
      lightDir: this.gl.getUniformLocation(program, 'u_lightDir'),
      ambient: this.gl.getUniformLocation(program, 'u_ambient'),
      diffuse: this.gl.getUniformLocation(program, 'u_diffuse'),
      specular: this.gl.getUniformLocation(program, 'u_specular'),
      shininess: this.gl.getUniformLocation(program, 'u_shininess'),
      // Quality uniforms
      maxSteps: this.gl.getUniformLocation(program, 'u_maxSteps'),
      shadowSteps: this.gl.getUniformLocation(program, 'u_shadowSteps'),
      aoSamples: this.gl.getUniformLocation(program, 'u_aoSamples'),
      stepScale: this.gl.getUniformLocation(program, 'u_stepScale'),
    };

    return { program, uniforms };
  }

  private setupGeometry(): void {
    if (!this.gl) return;

    const positions = new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
       1,  1,
    ]);

    this.positionBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, positions, this.gl.STATIC_DRAW);
  }

  private setupVertexAttribs(program: WebGLProgram): void {
    if (!this.gl) return;

    const positionLocation = this.gl.getAttribLocation(program, 'a_position');
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
    this.gl.enableVertexAttribArray(positionLocation);
    this.gl.vertexAttribPointer(positionLocation, 2, this.gl.FLOAT, false, 0, 0);
  }

  public isAvailable(): boolean {
    return !this.contextLost &&
      this.gl !== null &&
      this.mandelbrotProgram !== null &&
      this.juliaProgram !== null &&
      this.heatmapProgram !== null &&
      this.mandelbulbProgram !== null;
  }

  public setFractalType(type: FractalType): void {
    if (type === this.currentType) return;

    this.currentType = type;
    switch (type) {
      case 'mandelbrot':
        this.currentProgram = this.mandelbrotProgram;
        break;
      case 'julia':
        this.currentProgram = this.juliaProgram;
        break;
      case 'heatmap':
        this.currentProgram = this.heatmapProgram;
        break;
      case 'mandelbulb':
        // Mandelbulb uses its own render method, currentProgram not used
        this.currentProgram = null;
        break;
    }
  }

  // Split a double-precision number into hi/lo float32 components
  // hi contains the float32 approximation, lo contains the remainder
  private static float32Temp = new Float32Array(1);
  private splitDouble(value: number): [number, number] {
    // Convert to float32 to get the high part (truncated precision)
    WebGLRenderer.float32Temp[0] = value;
    const hi = WebGLRenderer.float32Temp[0];
    // The low part is the difference (what was lost in float32 conversion)
    const lo = value - hi;
    return [hi, lo];
  }

  // Check if high precision is needed based on zoom level
  public needsHighPrecision(bounds: ViewBounds): boolean {
    const rangeReal = bounds.maxReal - bounds.minReal;
    const rangeImag = bounds.maxImag - bounds.minImag;
    const minRange = Math.min(rangeReal, rangeImag);
    // Float32 has ~7 decimal digits of precision
    // When the range is smaller than ~1e-6, we start losing precision
    return minRange < 1e-6;
  }

  // Check if currently using high precision
  public isUsingHighPrecision(): boolean {
    return this.useHighPrecision;
  }

  public render(
    bounds: ViewBounds,
    maxIterations: number,
    colorOffset: number = 0,
    juliaC?: Complex,
    equationId?: number,
    antiAlias: number = 1,
    precisionMode: PrecisionMode = 'auto'
  ): void {
    // Determine if we should use high precision
    const needsHP = precisionMode === 'high' ||
                    (precisionMode === 'auto' && this.needsHighPrecision(bounds));

    // Check if HP is available for this fractal type
    const hpAvailable = (this.currentType === 'mandelbrot' && !!this.mandelbrotHPProgram) ||
                        (this.currentType === 'julia' && !!this.juliaHPProgram);

    this.useHighPrecision = needsHP && hpAvailable;

    if (this.useHighPrecision) {
      console.log('Using HIGH PRECISION rendering', {
        range: Math.min(bounds.maxReal - bounds.minReal, bounds.maxImag - bounds.minImag),
        precisionMode,
        fractalType: this.currentType
      });
      this.renderHP(bounds, maxIterations, colorOffset, juliaC, antiAlias);
      return;
    }

    if (!this.gl || !this.currentProgram) return;

    const width = this.canvas.width;
    const height = this.canvas.height;

    this.gl.viewport(0, 0, width, height);
    this.gl.useProgram(this.currentProgram.program);
    this.setupVertexAttribs(this.currentProgram.program);

    const { uniforms } = this.currentProgram;

    this.gl.uniform2f(uniforms.resolution, width, height);
    this.gl.uniform1i(uniforms.maxIterations, maxIterations);
    this.gl.uniform1f(uniforms.colorOffset, colorOffset);
    this.gl.uniform1i(uniforms.antiAlias, antiAlias);

    // Set palette uniforms
    if (uniforms.palette) {
      this.gl.uniform3fv(uniforms.palette, this.paletteData);
    }
    if (uniforms.paletteSize) {
      this.gl.uniform1i(uniforms.paletteSize, this.paletteSize);
    }

    if (this.currentType === 'heatmap') {
      // Heatmap uses vec4 bounds uniform
      if (uniforms.bounds) {
        this.gl.uniform4f(uniforms.bounds, bounds.minReal, bounds.maxReal, bounds.minImag, bounds.maxImag);
      }
      if (uniforms.equation && equationId !== undefined) {
        this.gl.uniform1i(uniforms.equation, equationId);
      }
    } else {
      // Mandelbrot and Julia use separate boundsMin/boundsMax
      this.gl.uniform2f(uniforms.boundsMin, bounds.minReal, bounds.minImag);
      this.gl.uniform2f(uniforms.boundsMax, bounds.maxReal, bounds.maxImag);
    }

    if (this.currentType === 'julia' && juliaC !== undefined && equationId !== undefined) {
      if (uniforms.juliaC) {
        this.gl.uniform2f(uniforms.juliaC, juliaC.real, juliaC.imag);
      }
      if (uniforms.equation) {
        this.gl.uniform1i(uniforms.equation, equationId);
      }
    }

    this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
  }

  private renderHP(
    bounds: ViewBounds,
    maxIterations: number,
    colorOffset: number,
    juliaC?: Complex,
    antiAlias: number = 1
  ): void {
    if (!this.gl) return;

    const program = this.currentType === 'mandelbrot'
      ? this.mandelbrotHPProgram
      : this.juliaHPProgram;

    if (!program) return;

    const width = this.canvas.width;
    const height = this.canvas.height;

    this.gl.viewport(0, 0, width, height);
    this.gl.useProgram(program.program);
    this.setupVertexAttribs(program.program);

    const { uniforms } = program;

    // Split bounds into hi/lo components
    const [minRealHi, minRealLo] = this.splitDouble(bounds.minReal);
    const [minImagHi, minImagLo] = this.splitDouble(bounds.minImag);
    const [maxRealHi, maxRealLo] = this.splitDouble(bounds.maxReal);
    const [maxImagHi, maxImagLo] = this.splitDouble(bounds.maxImag);

    console.log('HP bounds split:', {
      minReal: { original: bounds.minReal, hi: minRealHi, lo: minRealLo },
      maxReal: { original: bounds.maxReal, hi: maxRealHi, lo: maxRealLo },
    });

    this.gl.uniform2f(uniforms.resolution, width, height);
    this.gl.uniform2f(uniforms.boundsMinHi, minRealHi, minImagHi);
    this.gl.uniform2f(uniforms.boundsMinLo, minRealLo, minImagLo);
    this.gl.uniform2f(uniforms.boundsMaxHi, maxRealHi, maxImagHi);
    this.gl.uniform2f(uniforms.boundsMaxLo, maxRealLo, maxImagLo);
    this.gl.uniform1i(uniforms.maxIterations, maxIterations);
    this.gl.uniform1f(uniforms.colorOffset, colorOffset);
    this.gl.uniform1i(uniforms.antiAlias, antiAlias);
    // Debug mode: set to 1 to visualize lo component variation
    this.gl.uniform1i(uniforms.debugMode, 0);

    // Set palette uniforms
    if (uniforms.palette) {
      this.gl.uniform3fv(uniforms.palette, this.paletteData);
    }
    if (uniforms.paletteSize) {
      this.gl.uniform1i(uniforms.paletteSize, this.paletteSize);
    }

    // Julia constant for Julia set
    if (this.currentType === 'julia' && juliaC !== undefined && uniforms.juliaC) {
      this.gl.uniform2f(uniforms.juliaC, juliaC.real, juliaC.imag);
    }

    this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
  }

  public render3D(
    camera: Camera3D,
    params: MandelbulbParams,
    lighting: LightingParams,
    quality: RenderQuality,
    maxIterations: number,
    colorOffset: number = 0,
    equation3dId: number = 1
  ): void {
    if (!this.gl || !this.mandelbulbProgram) return;

    const width = this.canvas.width;
    const height = this.canvas.height;

    this.gl.viewport(0, 0, width, height);
    this.gl.useProgram(this.mandelbulbProgram.program);
    this.setupVertexAttribs(this.mandelbulbProgram.program);

    const { uniforms } = this.mandelbulbProgram;

    // Resolution and iterations
    this.gl.uniform2f(uniforms.resolution, width, height);
    this.gl.uniform1i(uniforms.maxIterations, maxIterations);

    // Equation selection
    this.gl.uniform1i(uniforms.equation, equation3dId);

    // Fractal parameters
    this.gl.uniform1f(uniforms.power, params.power);
    this.gl.uniform1f(uniforms.bailout, params.bailout);
    this.gl.uniform1f(uniforms.scale, params.scale ?? 2.0);
    this.gl.uniform1f(uniforms.minRadius, params.minRadius ?? 0.5);

    // Camera position (spherical to cartesian)
    // rotationX = pitch (elevation angle), rotationY = yaw (horizontal angle)
    const pitch = camera.rotationX;
    const yaw = camera.rotationY;

    // Pre-compute trig values
    const cosPitch = Math.cos(pitch);
    const sinPitch = Math.sin(pitch);
    const cosYaw = Math.cos(yaw);
    const sinYaw = Math.sin(yaw);

    const camX = camera.distance * cosPitch * sinYaw;
    const camY = camera.distance * sinPitch;
    const camZ = camera.distance * cosPitch * cosYaw;
    this.gl.uniform3f(uniforms.cameraPos, camX, camY, camZ);

    // Calculate camera basis vectors directly from angles for smooth rotation
    // Forward points from camera to origin (normalized camera position, negated)
    const forward = [-cosPitch * sinYaw, -sinPitch, -cosPitch * cosYaw];

    // Right vector is always horizontal (perpendicular to Y axis)
    const right = [cosYaw, 0, -sinYaw];

    // Up vector completes the orthonormal basis
    // Calculated as right x forward for correct orientation
    const up = [
      right[1] * forward[2] - right[2] * forward[1],
      right[2] * forward[0] - right[0] * forward[2],
      right[0] * forward[1] - right[1] * forward[0],
    ];

    // Camera rotation matrix - column-major order for WebGL
    // This matrix transforms from camera space to world space
    // Columns are: right, up, -forward (camera looks down -Z in camera space)
    const rotationMatrix = new Float32Array([
      right[0], right[1], right[2],
      up[0], up[1], up[2],
      -forward[0], -forward[1], -forward[2],
    ]);
    this.gl.uniformMatrix3fv(uniforms.cameraRotation, false, rotationMatrix);

    // Field of view
    this.gl.uniform1f(uniforms.fov, camera.fov);

    // Color palette
    if (uniforms.palette) {
      this.gl.uniform3fv(uniforms.palette, this.paletteData);
    }
    if (uniforms.paletteSize) {
      this.gl.uniform1i(uniforms.paletteSize, this.paletteSize);
    }
    this.gl.uniform1f(uniforms.colorOffset, colorOffset);

    // Lighting parameters
    // Calculate light direction in camera/view space first
    const lightCamX = Math.cos(lighting.lightAngleY) * Math.sin(lighting.lightAngleX);
    const lightCamY = Math.sin(lighting.lightAngleY);
    const lightCamZ = Math.cos(lighting.lightAngleY) * Math.cos(lighting.lightAngleX);

    // Transform light direction from camera space to world space
    // This makes the light follow the camera view (like a headlamp)
    const lightX = right[0] * lightCamX + up[0] * lightCamY + (-forward[0]) * lightCamZ;
    const lightY = right[1] * lightCamX + up[1] * lightCamY + (-forward[1]) * lightCamZ;
    const lightZ = right[2] * lightCamX + up[2] * lightCamY + (-forward[2]) * lightCamZ;
    this.gl.uniform3f(uniforms.lightDir, lightX, lightY, lightZ);
    this.gl.uniform1f(uniforms.ambient, lighting.ambient);
    this.gl.uniform1f(uniforms.diffuse, lighting.diffuse);
    this.gl.uniform1f(uniforms.specular, lighting.specular);
    this.gl.uniform1f(uniforms.shininess, lighting.shininess);

    // Quality parameters
    this.gl.uniform1i(uniforms.maxSteps, quality.maxSteps);
    this.gl.uniform1i(uniforms.shadowSteps, quality.shadowSteps);
    this.gl.uniform1i(uniforms.aoSamples, quality.aoSamples);
    this.gl.uniform1f(uniforms.stepScale, quality.detailLevel);

    this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
  }

  public resize(width: number, height: number): void {
    this.canvas.width = width;
    this.canvas.height = height;
  }

  public dispose(): void {
    // Remove context loss event listeners
    this.canvas.removeEventListener('webglcontextlost', this.boundHandleContextLost);
    this.canvas.removeEventListener('webglcontextrestored', this.boundHandleContextRestored);

    if (!this.gl) return;

    if (this.mandelbrotProgram) {
      this.gl.deleteProgram(this.mandelbrotProgram.program);
      this.mandelbrotProgram = null;
    }

    if (this.juliaProgram) {
      this.gl.deleteProgram(this.juliaProgram.program);
      this.juliaProgram = null;
    }

    if (this.heatmapProgram) {
      this.gl.deleteProgram(this.heatmapProgram.program);
      this.heatmapProgram = null;
    }

    if (this.mandelbulbProgram) {
      this.gl.deleteProgram(this.mandelbulbProgram.program);
      this.mandelbulbProgram = null;
    }

    if (this.mandelbrotHPProgram) {
      this.gl.deleteProgram(this.mandelbrotHPProgram.program);
      this.mandelbrotHPProgram = null;
    }

    if (this.juliaHPProgram) {
      this.gl.deleteProgram(this.juliaHPProgram.program);
      this.juliaHPProgram = null;
    }

    if (this.vertexShader) {
      this.gl.deleteShader(this.vertexShader);
      this.vertexShader = null;
    }

    if (this.positionBuffer) {
      this.gl.deleteBuffer(this.positionBuffer);
      this.positionBuffer = null;
    }

    this.gl = null;
  }
}

export function checkWebGLSupport(): RenderMode {
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl2');
  return gl ? 'webgl' : 'canvas2d';
}
