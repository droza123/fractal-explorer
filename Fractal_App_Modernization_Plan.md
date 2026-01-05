# Fractal Explorer Modernization Plan

## Overview

This document outlines a plan to modernize a legacy Windows fractal exploration application (originally written in WPF/C#) into a modern web application with WebGL-accelerated rendering and an improved user interface while preserving all original functionality.

**Target Platform**: Web application (React + TypeScript + WebGL)  
**Original Source**: WPF/.NET 4.5 (decompiled via ILSpy)

### Recovered Source Code

The following classes were successfully decompiled and documented:

| Class | Purpose | Key Insights |
|-------|---------|--------------|
| `FractalClass.cs` | Core iteration logic | All 57 Julia equations, Mandelbrot implementation |
| `HeatMap.cs` | Heat map generation | Iteration diversity algorithm, adaptive max iterations |
| `ColorsForFractals.cs` | Color palette system | RGB cube sampling, angle-based sorting, warmer/cooler rotation |
| `JuliaEquations.cs` | Equation selector UI | Button grid layout (labels in XAML) |

---

## Original Application Features (to preserve)

### Core Visualization
- **Mandelbrot Set Exploration**: Standard z² + c iteration with zooming
- **Julia Set Exploration**: Multiple equations (60+ formulas visible in screenshots)
- **Heat Map Mode**: Shows which points in complex plane produce interesting Julia sets
  - Upper window: main view with mouse tracking
  - Lower window: zoomed preview of current mouse position
  - Right-click: preview Julia set at cursor location
  - Spacebar: quick-save Julia point without losing position

### Navigation
- **Click-and-drag rectangular selection** for zooming (draw rectangle, then render zoomed view)
- Back button for navigation history (zoom stack)
- Adjustable "Julia zooming" factor (slider, default 1.0)
- **NEW: Mouse wheel zoom** (centered on cursor position)
- **NEW: Pinch-to-zoom** on touch devices

### Data Management
- Save Julia points (complex coordinates) per equation
- Delete saved Julia points
- Enter custom Julia points manually
- Points stored per equation number

### Image Export
- Print/save fractal images
- Selectable resolution
- Multiple file format options

### Color System
- Three preset color patterns
- Warmer/cooler adjustment slider
- Custom palette builder:
  - Add colors to create gradient
  - Remove colors
  - Interactive color circle/picker

### Performance
- Multi-core computation support
- Progress indicator for long calculations

---

## Technology Stack

```
Frontend Framework:  React 18+ with TypeScript
Build Tool:          Vite
Rendering:           WebGL 2.0 (primary), Canvas 2D (fallback)
State Management:    Zustand
Styling:             Tailwind CSS
Storage:             IndexedDB (via Dexie.js)
Video Export:        MediaRecorder API + WebCodecs
```

### Why WebGL?

WebGL provides GPU-accelerated rendering, which is essential for smooth fractal exploration:

- **10-100x faster** than CPU-based Canvas rendering
- **Real-time zooming** becomes possible
- **Higher iteration counts** for deeper detail
- **Smooth animations** for zoom transitions and video recording

The fractal iteration loop runs entirely on the GPU via GLSL shaders, freeing the CPU for UI responsiveness.

### Fallback Strategy

For older browsers or devices without WebGL 2.0 support:
1. Detect WebGL availability on load
2. Fall back to Canvas 2D + Web Workers
3. Show warning about reduced performance

---

## Application Architecture

```
fractal-explorer/
├── src/
│   ├── components/
│   │   ├── MainMenu/           # Landing screen with mode selection
│   │   ├── FractalCanvas/      # WebGL rendering component
│   │   ├── HeatMapView/        # Dual-pane heat map explorer
│   │   ├── JuliaViewer/        # Single Julia set viewer
│   │   ├── MandelbrotViewer/   # Mandelbrot explorer
│   │   ├── ColorPalette/       # Color picker and palette editor
│   │   ├── EquationSelector/   # Grid of Julia equations
│   │   ├── PointManager/       # Save/load/delete Julia points
│   │   ├── ExportDialog/       # Image export options
│   │   ├── AnimationEditor/    # Keyframe timeline (future)
│   │   └── ShareDialog/        # URL generation (future)
│   │
│   ├── webgl/
│   │   ├── shaders/
│   │   │   ├── mandelbrot.frag     # Mandelbrot fragment shader
│   │   │   ├── julia.frag          # Julia fragment shader
│   │   │   ├── heatmap.frag        # Heat map shader
│   │   │   └── colormap.glsl       # Shared color utilities
│   │   ├── renderer.ts             # WebGL context management
│   │   ├── shaderProgram.ts        # Shader compilation utilities
│   │   └── equations.ts            # Generate equation-specific shaders
│   │
│   ├── workers/
│   │   ├── mandelbrot.worker.ts    # CPU fallback for Mandelbrot
│   │   ├── julia.worker.ts         # CPU fallback for Julia sets
│   │   ├── heatmap.worker.ts       # CPU fallback for heat map
│   │   └── export.worker.ts        # High-res export rendering
│   │
│   ├── lib/
│   │   ├── complex.ts          # Complex number operations (CPU)
│   │   ├── equations.ts        # Equation definitions
│   │   ├── colorMaps.ts        # Color palette utilities
│   │   ├── storage.ts          # IndexedDB via Dexie.js
│   │   ├── export.ts           # Image export utilities
│   │   ├── share.ts            # URL encoding/decoding (future)
│   │   └── animation.ts        # Keyframe interpolation (future)
│   │
│   ├── hooks/
│   │   ├── useZoomHistory.ts   # Navigation history management
│   │   ├── useFractalRenderer.ts
│   │   ├── useColorPalette.ts
│   │   └── useWebGL.ts         # WebGL context hook
│   │
│   └── types/
│       └── index.ts            # TypeScript type definitions
│
├── public/
└── package.json
```

---

## Implementation Phases

### Phase 1: Core Infrastructure + WebGL Renderer (Week 1-2)
1. Set up project with Vite + React + TypeScript + Tailwind
2. Implement WebGL 2.0 context management
3. Create Mandelbrot fragment shader
4. Implement zoom-by-rectangle selection with preview overlay
5. Mouse wheel zoom (centered on cursor)
6. Basic navigation history (back/forward)
7. Canvas 2D + Web Worker fallback for non-WebGL browsers

**Deliverable**: Working Mandelbrot viewer with smooth zooming

### Phase 2: Julia Sets + Equation System (Week 3)
1. Create Julia set fragment shader (parameterized by c)
2. Port all ~60 equations from VB source to GLSL
3. Implement equation selector grid UI (modal)
4. Shader hot-swapping when equation changes
5. "Julia zooming" factor control

**Deliverable**: Julia set viewer with all equations working

### Phase 3: Heat Map Mode (Week 4)
1. Implement heat map shader (color = Julia set "interestingness")
2. Create dual-pane layout component
3. Mouse tracking with magnified preview pane
4. Right-click Julia preview (renders in popup or side panel)
5. Spacebar quick-save functionality
6. Coordinate display at cursor

**Deliverable**: Full heat map exploration mode

### Phase 4: Data Persistence + Point Management (Week 5)
1. Set up IndexedDB schema with Dexie.js
2. Save/load Julia points per equation
3. Point list UI with thumbnails
4. Manual point entry dialog
5. Delete/edit point functionality
6. Import/export points as JSON (bonus)

**Deliverable**: Complete point management system

### Phase 5: Color System (Week 6)
1. Implement color palette as shader uniform array
2. Three preset palettes matching original app
3. Warmer/cooler interpolation slider
4. Custom palette builder UI
5. Save custom palettes to storage

**Deliverable**: Full color customization

### Phase 6: Export, Polish & Touch Support (Week 7)
1. High-resolution image export (tiled rendering)
2. Format options (PNG, JPEG, WebP)
3. Touch gesture support (pinch zoom, pan)
4. Keyboard shortcuts
5. Responsive design for tablets
6. Loading states and progress indicators
7. Error handling and WebGL fallback messaging

**Deliverable**: Production-ready application

---

### Post-MVP Phases (Future)

#### Phase 7: Sharing
- URL state encoding/decoding
- Short URL generation
- Open Graph meta tags for previews

#### Phase 8: Animation & Video
- Keyframe editor UI
- Smooth zoom path interpolation
- MediaRecorder integration
- Export progress and quality options

#### Phase 9: 3D Fractals
- Ray-marching shader for Mandelbulb
- 3D camera controls
- Lighting system

#### Phase 10: AI Suggestions
- Heuristic-based "interesting point" detection
- Integration with heat map analysis

---

## Key UI/UX Improvements

### Visual Design
- **Dark theme** with high-contrast controls (fractals look better on dark backgrounds)
- **Glassmorphism** or subtle gradients for panels
- **Smooth animations** for zoom transitions (WebGL enables this)
- **Modern typography** (Inter, JetBrains Mono for coordinates)

### Layout Improvements
- **Floating toolbar** instead of side panel (more canvas space)
- **Collapsible panels** for equation selector and point list
- **Full-screen mode** for immersive exploration
- **Touch-optimized** controls for tablet use

### Interaction Model
- **Rectangle selection zoom**: Click and drag to select area, release to render zoomed view
- **Mouse wheel zoom**: Zoom in/out centered on cursor position (NEW)
- **Pinch-to-zoom**: Two-finger gesture on touch devices (NEW)
- **Pan**: Click and drag (when not in selection mode) or two-finger drag
- **Coordinate display**: Show complex coordinates at cursor position
- **Undo/redo navigation**: Full history, not just linear "back"

### Heat Map Mode Specifics
- **Dual-pane layout**: Main view (top/left) + magnified preview (bottom/right)
- **Mouse tracking**: Preview pane shows zoomed area around cursor
- **Right-click**: Instantly preview Julia set at that point
- **Spacebar**: Quick-save current point without moving mouse

---

## Julia Equations to Implement

Based on the screenshot, there are approximately 60 equations to port. The original Visual Basic source code should be referenced to ensure exact mathematical accuracy.

### Porting from C#/.NET

When porting equations, the decompiled C# source provides exact implementations. The `System.Numerics.Complex` class maps directly to our implementations:

**Example C# to TypeScript/GLSL conversion:**

```csharp
// C# original (from FractalClass.cs)
complex = complex * complex + c;
```

```typescript
// TypeScript (CPU fallback)
z = z.mul(z).add(c);
```

```glsl
// GLSL shader (GPU)
vec2 complexMul(vec2 a, vec2 b) {
    return vec2(a.x*b.x - a.y*b.y, a.x*b.y + a.y*b.x);
}
z = complexMul(z, z) + c;
```

### Complete Equation List (57 equations)

The following table shows the button labels from XAML alongside the actual C# implementation. Note: A few labels don't exactly match the code—the **code is the ground truth** for behavior.

| # | Button Label (XAML) | Actual Code (C#) | Notes |
|---|---------------------|------------------|-------|
| 1 | Z^2 * C | `z*z + c` | Label says multiply, code adds |
| 2 | Z^3 * C | `z*z*z + c` | Label says multiply, code adds |
| 3 | Z^4 * C | `z^4 + c` | Label says multiply, code adds |
| 4 | Z^5 * C | `z^5 + c` | Label says multiply, code adds |
| 5 | (Z^2 + C) / (Z - C) | `(z*z + c) / (z - c)` | ✓ Match |
| 6 | Z^2 - Z + C | `z*z - (z + c)` | Code is z² - z - c |
| 7 | Z^3 - Z^2 + Z + C | `z³ - z² + z + c` | ✓ Match |
| 8 | (1 + C)Z - CZ^2 | `(1+c)*z - c*z²` | ✓ Match |
| 9 | Z^3 / (1 + CZ^2) | `z³ / (1 + c*z²)` | ✓ Match |
| 10 | (Z-1)(Z+.5)(Z^2-1)+C | `(z-1)(z+0.5)(z²-1) + c` | ✓ Match |
| 11 | (Z^2+1+C)/(Z^2-1-C) | `(z²+1+c)/(z²-1-c)` | ✓ Match |
| 12 | Z^1.5 + C | `z^1.5 + c` | ✓ Match |
| 13 | exp(Z)-C | `exp(z) - c` | ✓ Match |
| 14 | Z^3-0.5+C*exp(-Z) | `z³ - 0.5 + c*exp(-z)` | ✓ Match |
| 15 | C*Z-1+C*exp(-Z) | `c*z - 1 + c*exp(-z)` | ✓ Match |
| 16 | (4Z^5+C)/5Z^4 | `(4*z⁵ + c) / (5*z⁴)` | ✓ Match |
| 17 | Z^5-Z^3+Z+C | `z⁵ - z³ + z + c` | ✓ Match |
| 18 | Z^2*exp(-Z)+C | `z³ + z + c` | **Mismatch** |
| 19 | Z^2sin(ReZ)+CZcos(ImZ)+C | `2z*sin(Re) + cz*cos(Im) + c` | Uses components |
| 20 | Z*exp(-Z)+C | `z*exp(-z) + c` | ✓ Match |
| 21 | C*exp(-Z)+Z^2 | `c*exp(-z) + z²` | ✓ Match |
| 22 | (Z^2+C)^2+Z+C | `(z²+c)² + z + c` | ✓ Match |
| 23 | (Z+sin(Z))^2+C | `(z + sin(z))² + c` | ✓ Match |
| 24 | Z^2+C^3 | `z² + c³` | ✓ Match |
| 25 | Z^2+C/Z^2-1-C | `(z²+c)/(z²-1-c)` | ✓ Match |
| 26 | Z^2cos(ImZ)+CZsin(ReZ)+C | `z²*cos(Im) + cz*sin(Re) + c` | Uses components |
| 27 | Z^2cos(ReZ)+CZsin(ImZ)+C | `z²*cos(Re) + cz*sin(Im) + c` | Uses components |
| 28 | Z^2sin(MagZ)+CZcos(MagZ)+C | `z²*cos(Mag) + cz*sin(Mag) + c` | Uses magnitude |
| 29 | sinZ^2+tanZ^2+C | `sin(z²)*tan(z²) + c` | ✓ Match |
| 30 | CZ^2+ZC^2 | `c*z² + z*c²` | ✓ Match |
| 31 | exp(cos(CZ)) | `exp(sin(c*z))` | Label says cos, code uses sin |
| 32 | C(sinZ+cosZ) | `c*(sin(z) + cos(z))` | ✓ Match |
| 33 | ((Z^2+C)^2)/(Z-C) | `(z²+c)² / (z-c)` | ✓ Match |
| 34 | (Z+sinZ)^2+Z^-.5+C | `c*(sin(z)+cos(z))*(z³+z+c)` | **Mismatch** |
| 35 | Cexp(Z)*exp(cosCZ) | `c*exp(z)*cos(c*z)` | ✓ Close match |
| 36 | (Z^3+Z+C)*C*(sinZ+cosZ) | `(z³+z+c)*c*(sin(z)+cos(z))` | ✓ Match |
| 37 | 1-z^2+z^4/(2+4z)+c | `1 - z² + z⁴/(2+4z) + c` | ✓ Match |
| 38 | Z^2+Z^1.5+C | `z² + z^1.5 + c` | ✓ Match |
| 39 | 1-z^2+z^5/(2+4z)+c | `1 - z² + z⁵/(2+4z) + c` | ✓ Match |
| 40 | Z^2+ZexpZ+C | `z³*exp(z) + c` | Code is z³exp(z)+c |
| 41 | (Z+sinZ)^2+Cexp(-Z)+Z^2+C | `(z+sin(z))² + c*exp(-z) + z² + c` | ✓ Match |
| 42 | ((Z^3)/(1+CZ^2))+expZ-C | `z³/(1+c*z²) + exp(z) - c` | ✓ Match |
| 43 | (Z+sinZ)^2+Cexp(Z)+C | `(z+sin(z))² + c*exp(z) + c` | ✓ Match |
| 44 | (Z^3+C)/Z^2 | `(z³+c)/z²` | ✓ Match |
| 45 | (Z^3+C)/Z | `(z³+c)/z` | ✓ Match |
| 46 | (Z-sqrt(Z))^2+C | `(z - √z)² + c` | ✓ Match |
| 47 | (Z+C)^2+(Z+C) | `(z+c)² + (z+c)` | ✓ Match |
| 48 | (Z+C)^3-(Z+C)^2 | `(z+c)³ - (z+c)²` | ✓ Match |
| 49 | (Z^3-Z^2)^2+C | `(z³-z²)² + c` | ✓ Match |
| 50 | (Z^2-Z)^2+C | `(z²-z)² + c` | ✓ Match |
| 51 | (Z-sqrt(Z))^2+C | `(z - √z)² + c` | Duplicate of 46 |
| 52 | (Z^2+sqrt(Z))^2+C | `(z² + √z)² + c` | ✓ Match |
| 53 | Z^2exp(Z)-Zexp(Z)+C | `z²*exp(z) - z*exp(z) + c` | ✓ Match |
| 54 | (exp(CZ)+C)^2 | `(exp(c*z) + c)²` | ✓ Match |
| 55 | Z^5+CZ^3+C | `z⁵ + c*z³ + c` | ✓ Match |
| 56 | exp(Z^2+C) | `exp(z² + c)` | ✓ Match |
| 57 | Z^8+C | `z⁸ + c` | ✓ Match |

### Implementation Decision

For the modernization, we have two options:

**Option A: Match the code (preserve behavior)**
- Implement what the code actually does
- Users who saved favorite points will see the same fractals
- Update labels to match actual formulas

**Option B: Match the labels (fix behavior)**  
- Implement what the labels describe
- Saved points may produce different results
- Labels stay as-is

**Recommendation**: Option A—preserve the actual behavior since users may have saved Julia points they like. Update the labels to accurately reflect the formulas.

### Original C# Implementation Reference

The decompiled source shows the exact iteration logic:

### Original C# Implementation Reference

The decompiled source shows the exact iteration logic:

```csharp
// From FractalClass.cs - the core Julia iteration
public static int Julia(Complex c, double Y, double X, int MxItr)
{
    int i = 0;
    Complex complex = new Complex(Y, X);  // Note: Y,X order (imaginary, real)
    for (; i < MxItr; i++)
    {
        if (!(complex.Magnitude <= 2.0))
            break;
        
        switch (MyData.JuliaEqNumber)
        {
            case 1: complex = complex * complex + c; break;
            case 2: complex = complex * complex * complex + c; break;
            // ... etc for all 57 equations
        }
    }
    return i;
}
```

**Important implementation notes from the source:**
- Escape radius is 2.0 (standard)
- The `Complex` class from `System.Numerics` handles all complex operations
- Some equations use `complex.Real`, `complex.Imaginary`, and `complex.Magnitude` separately
- The coordinate system has Y and X swapped in the constructor (may need to verify orientation)

---

## Heat Map Algorithm (from decompiled HeatMap.cs)

The heat map's "interestingness" calculation is more sophisticated than simple escape time—it measures **iteration diversity** in a sampling region around each point.

### Core Algorithm: `DetermineMxItrBox()`

```typescript
// Pseudocode translation of the heat map algorithm
function calculateInterestingness(
  realPart: number, 
  imagPart: number, 
  boxWidth: number, 
  boxHeight: number,
  maxIterations: number
): number {
  // Sample at 5 specific Y positions within the box
  const yPositions = [0.25, 0.45, 0.5, 0.55, 0.667];
  
  // Track which iteration counts we've seen
  const iterationCounts = new Set<number>();
  
  for (const yFactor of yPositions) {
    const sampleY = boxStartY - heightY * yFactor;
    
    // Sample across the full width of the box
    for (let xIndex = 0; xIndex < boxWidth; xIndex++) {
      const sampleX = boxStartX + widthX * xIndex / boxWidth;
      
      // Run Julia iteration at this sample point
      const iterations = juliaIteration(
        { real: realPart, imag: imagPart },  // Julia constant c
        { real: sampleX, imag: sampleY },     // Starting point z
        maxIterations
      );
      
      iterationCounts.add(iterations);
    }
  }
  
  // Interestingness = number of UNIQUE iteration values found
  return iterationCounts.size;
}
```

### Why This Works

Points on the boundary of the Mandelbrot set produce the most visually interesting Julia sets. These boundary points have **high iteration diversity** because:
- Nearby points in the complex plane escape at vastly different rates
- The Julia set structure is most complex at these locations
- Interior points (low diversity) produce filled/boring Julia sets
- Exterior points (low diversity) produce sparse/boring Julia sets

### Additional Heat Map Details

- **Adaptive iterations**: 250 max iterations normally, 1000 when zoomed in (ZoomFactor > 16)
- **Box size**: 35×35 pixels by default, adjusted for aspect ratio
- **Top 10 highlighting**: The 10 points with highest interestingness are rendered white
- **Background processing**: Uses BackgroundWorker for non-blocking rendering

---

## Color System (from decompiled ColorsForFractals.cs)

The color palette system generates colors in a 3D RGB cube and sorts them by angle around a color wheel.

### Core Concepts

```typescript
interface ColorPoint {
  r: number;      // Red (0-255)
  g: number;      // Green (0-255)  
  b: number;      // Blue (0-255)
  angle: number;  // Position on color wheel (0 to 2π radians)
  distance: number; // Distance from origin in color space
}

// Colors are sorted by angle for smooth gradients
function generatePalette(
  lowerPlane: number,    // Z-slice lower bound in RGB cube
  upperPlane: number,    // Z-slice upper bound in RGB cube
  angleOffset: number,   // Warmer/cooler rotation (radians)
  angleStart: number,    // Start of color range
  angleEnd: number,      // End of color range
  reverse: boolean       // Flip color order
): ColorPoint[] {
  const colors: ColorPoint[] = [];
  
  // Sample colors from the RGB cube surface (not interior)
  for (let z = lowerPlane; z <= upperPlane; z++) {
    for (let y = 0; y <= 255; y++) {
      for (let x = 0; x <= 255; x++) {
        // Only include points on the surface of the sampling region
        if (isOnSurface(x, y, z)) {
          const angle = Math.atan2(y - 128, x - 128);  // Angle from center
          const normalizedAngle = angle < 0 ? angle + 2 * Math.PI : angle;
          
          colors.push({
            r: x, g: y, b: z,
            angle: normalizedAngle,
            distance: Math.sqrt((x-128)**2 + (y-128)**2)
          });
        }
      }
    }
  }
  
  // Apply angle offset (warmer/cooler)
  if (angleOffset > 0) {
    colors.forEach(c => {
      c.angle = (c.angle + angleOffset) % (2 * Math.PI);
    });
  }
  
  // Filter to angle range if specified
  let filtered = colors;
  if (angleEnd > angleStart) {
    filtered = colors.filter(c => c.angle >= angleStart && c.angle <= angleEnd);
  }
  
  // Sort by angle for smooth gradient
  filtered.sort((a, b) => a.angle - b.angle);
  
  // Reverse if requested
  if (reverse) {
    filtered.reverse();
  }
  
  // Add dark "buffer" colors at start for points that don't escape
  const buffer = Array(filtered.length > 249 ? 5 : 3).fill({ r: 23, g: 23, b: 39 });
  
  return [...buffer, ...filtered];
}
```

### Warmer/Cooler Slider

The `angleOffset` parameter rotates the entire color wheel:
- **Offset = 0**: Default colors
- **Positive offset**: Shifts toward warmer (red/orange) tones
- **Negative offset**: Shifts toward cooler (blue/purple) tones

### Three Preset Palettes

The original app likely uses different combinations of:
- `lowerPlane` / `upperPlane` (which Z-slices of the RGB cube to use)
- `angleStart` / `angleEnd` (which portion of the color wheel)
- `reverse` flag

We can recreate these by experimenting or by extracting the XAML resources.
```

---

## Data Storage Schema

```typescript
interface JuliaPoint {
  id: string;
  equationId: number;
  real: number;
  imaginary: number;
  createdAt: Date;
  label?: string;  // Optional user label (new feature)
  thumbnail?: string;  // Base64 preview (new feature)
}

interface AppState {
  currentMode: 'mandelbrot' | 'julia' | 'heatmap';
  selectedEquation: number;
  juliaConstant: Complex | null;
  viewBounds: {
    minReal: number;
    maxReal: number;
    minImag: number;
    maxImag: number;
  };
  zoomHistory: ViewBounds[];
  colorPalette: ColorPalette;
  savedPoints: JuliaPoint[];
}
```

---

## Performance Architecture

### WebGL Rendering Pipeline (Primary)

The core rendering uses GLSL fragment shaders for maximum performance:

```glsl
// Simplified Mandelbrot shader example
precision highp float;
uniform vec2 u_center;
uniform float u_scale;
uniform int u_maxIterations;

void main() {
    vec2 c = u_center + (gl_FragCoord.xy - u_resolution/2.0) * u_scale;
    vec2 z = vec2(0.0);
    int iterations = 0;
    
    for (int i = 0; i < 1000; i++) {
        if (i >= u_maxIterations) break;
        if (dot(z, z) > 4.0) break;
        z = vec2(z.x*z.x - z.y*z.y, 2.0*z.x*z.y) + c;
        iterations++;
    }
    
    // Color based on iteration count
    gl_FragColor = palette(float(iterations) / float(u_maxIterations));
}
```

### Benefits of GPU Rendering
- **Parallel computation**: Millions of pixels calculated simultaneously
- **Real-time interaction**: Smooth mouse wheel zooming
- **High iteration counts**: Can push to 10,000+ iterations without lag
- **Animation-ready**: 60fps zoom animations possible

### Web Worker Fallback
For Canvas 2D fallback mode:
- Tile-based rendering in Web Workers
- Progressive quality (low-res first, then refine)
- Multiple workers for multi-core utilization

### Memory Management
- Reuse WebGL textures and framebuffers
- Implement view frustum for heat map (only render visible tiles)
- Lazy-load equation shaders (compile on first use)

### High-Resolution Export
For print-quality exports (e.g., 8000x8000):
1. Render in tiles to avoid GPU memory limits
2. Use OffscreenCanvas in Worker for non-blocking
3. Stitch tiles together
4. Show progress indicator

---

## Claude Code Prompts

When working with Claude Code, you can use these prompts for each phase. Share the relevant VB source code when porting equations.

### Phase 1 Prompt
```
Create a React + TypeScript + Vite project for a fractal explorer with WebGL rendering.

Implement:
1. WebGL 2.0 context setup with error handling and Canvas 2D fallback
2. A Mandelbrot fragment shader with configurable max iterations and color palette
3. Zoom-by-rectangle selection: click-drag draws a rectangle overlay, release triggers re-render at new bounds
4. Mouse wheel zoom centered on cursor position
5. Navigation history (back/forward through zoom states)
6. Dark theme UI with Tailwind CSS

The main view should be a full-screen canvas with a floating toolbar.
```

### Phase 2 Prompt (include C# equation source)
```
Add Julia set support to the fractal explorer.

The original C# code for the equations can be found in the file FractalClass.md.

Implement:
1. A Julia set fragment shader parameterized by complex constant c
2. Convert all 57 equations from the C# source to GLSL functions
3. An equation selector modal showing a 3-column grid of equation names
4. Shader program switching when equation is selected
5. A "Julia zooming" factor slider

Each equation should be its own GLSL function that can be called from the main iteration loop.
Note: Equations 19, 26, 27, 28 use z.Real, z.Imaginary, z.Magnitude separately.
```

### Phase 3 Prompt
```
Add Heat Map mode to the fractal explorer.

The heat map shows which points in the complex plane produce "interesting" Julia sets.
Use the ITERATION DIVERSITY algorithm from the original app:

Algorithm (DetermineMxItrBox):
1. For each pixel in the heat map, define a small sampling box around it
2. Sample at 5 Y positions: 25%, 45%, 50%, 55%, 67% of box height
3. For each Y position, sample across the full box width
4. Run Julia iteration at each sample point
5. Count how many UNIQUE iteration values appear
6. More unique values = more interesting = brighter color

Implement:
1. A heat map shader/worker that implements this diversity algorithm
2. Dual-pane layout: main view (left/top) + magnified preview (right/bottom)
3. The preview pane shows a zoomed view around the current cursor position
4. Right-click on heat map: show Julia set preview in a modal/side panel
5. Spacebar: save current cursor position as a Julia point
6. Display complex coordinates at cursor position
7. Adaptive iterations: 250 normally, 1000 when zoomed (area < 1 square unit)
8. Highlight the top 10 most interesting points in white
```

### Phase 4 Prompt
```
Add data persistence for Julia points.

Use Dexie.js for IndexedDB storage.

Implement:
1. Schema: JuliaPoint { id, equationId, real, imaginary, createdAt, label?, thumbnail? }
2. Save Julia point (from heat map or manual entry)
3. List saved points for current equation (with small preview thumbnails)
4. Load a saved point (sets it as current Julia constant)
5. Delete a point (with confirmation)
6. Manual entry dialog: input fields for real and imaginary parts
7. Export all points as JSON file
```

### Phase 5 Prompt
```
Add color palette system based on the original algorithm.

The original generates colors in a 3D RGB cube sorted by angle:

Algorithm:
1. Sample colors from the surface of a region in RGB space
2. Convert each color to polar coordinates (angle from center)
3. Sort colors by angle for smooth gradients
4. Apply angleOffset to rotate the wheel (warmer/cooler slider)
5. Optionally filter to an angle range (angleStart to angleEnd)
6. Add dark buffer colors at the start for non-escaping points

Implement:
1. Pass color palette to shaders as a uniform array (up to 256 colors)
2. Three preset palettes with different RGB cube slices
3. Warmer/cooler slider that rotates hue (angleOffset in radians)
4. Custom palette builder:
   - Color picker (HSL circle + lightness slider)
   - Add color button (appends to palette)
   - Remove last color button
   - Preview gradient
   - Save custom palette
5. Apply palette changes immediately to current view
```

---

## Testing Checklist

- [ ] Mandelbrot renders correctly at various zoom levels
- [ ] All 60+ Julia equations render correctly
- [ ] Heat map accurately predicts interesting Julia sets
- [ ] Zoom history works correctly (back button)
- [ ] Points save and load correctly per equation
- [ ] Custom colors apply to all render modes
- [ ] Export produces correct resolution images
- [ ] Performance acceptable (no UI freezing)
- [ ] Works on Chrome, Firefox, Safari, Edge
- [ ] Responsive on tablet-sized screens

---

## Future Enhancements (Post-MVP, Prioritized)

### High Priority (Devin's interests)

#### 1. 3D Fractals (Mandelbulb/Mandelbox)
- Ray-marching renderer in WebGL
- Orbit controls for 3D navigation
- Cross-section slicing to see interior structure
- Lighting and material options

#### 2. Animation Mode with Video Recording
- Define keyframe zoom paths
- Smooth interpolation between keyframes
- Real-time preview at reduced quality
- Export to MP4/WebM using MediaRecorder API
- Option for high-quality offline rendering

#### 3. Sharing
- Generate shareable URLs with encoded state:
  - Current view bounds
  - Selected equation
  - Julia constant
  - Color palette
- Short URL service integration
- Social media preview cards (Open Graph)
- Optional: embed code for websites

#### 4. AI Suggestions for Interesting Julia Points
- Train a model on "interesting" vs "boring" Julia sets
- Suggest points based on heat map analysis
- "Explore similar" feature from saved points
- Could use simple heuristics initially:
  - Edge of Mandelbrot set (c values)
  - High color variance in preview
  - Spiral/dendrite detection

### Lower Priority
- Cloud sync (save points to user account)
- Collaboration (real-time shared exploration)
- VR mode (immersive fractal exploration)
- Audio reactive mode (modulate parameters with music)

---

## Summary

This modernization will transform your fractal explorer into a polished, professional application while preserving all the functionality that made the original useful. The phased approach allows for incremental progress and testing, and the web-based architecture ensures the widest possible accessibility.

The original application's strength was in its comprehensive Julia set exploration tools—particularly the heat map mode with preview windows. These features will be even more powerful with modern UI patterns and GPU acceleration.
