# Fractal Voyager

A modern, GPU-accelerated fractal exploration app built with React and WebGL. This web application is a reimagining of an original Windows WPF application, bringing the beauty of mathematical fractals to the browser with enhanced features and cross-platform compatibility.

## Features

### Fractal Types
- **Mandelbrot Set** - The classic fractal with infinite zoom capability
- **Julia Sets** - Explore the parameter space of Julia sets with 57 different equations
- **Heatmap Explorer** - Visualize Julia set parameter space as an interactive heatmap
- **3D Mandelbulb** - Ray-marched 3D fractal visualization

### Rendering
- **GPU Rendering** - WebGL 2.0 shaders for real-time exploration
- **High-Precision CPU Rendering** - Automatically switches to CPU at deep zoom levels for arbitrary precision
- **Parallel CPU Workers** - Web Workers distribute CPU rendering across multiple cores
- **Anti-aliasing** - Configurable supersampling for both GPU and CPU modes

### Animation & Export
- **Keyframe Animation** - Create smooth zoom animations with customizable timing
- **Video Export** - Export animations as MP4 video using WebCodecs (works offline)
- **High-Resolution Image Export** - Tiled rendering for images up to 8K resolution
- **Save/Load** - Persist Julia set points and animations to browser storage

### Customization
- **57 Fractal Equations** - From classic z^2+c to exotic formulas
- **Color Palettes** - Multiple built-in palettes with temperature adjustment
- **Custom Palettes** - Create and save your own color schemes
- **AI Suggestions** - Get equation-specific parameter recommendations

## Technology Stack

- **React 19** - UI framework
- **TypeScript** - Type-safe development
- **WebGL 2.0** - GPU-accelerated rendering with double-float emulation
- **WebCodecs API** - Browser-native video encoding
- **Zustand** - State management with persistence
- **Dexie.js** - IndexedDB wrapper for data storage
- **Tailwind CSS 4** - Styling
- **Vite** - Build tool with PWA support

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn

### Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Open http://localhost:5173 in your browser
```

### Building

```bash
# Type check and build for production
npm run build

# Preview production build
npm run preview
```

## Usage

### Navigation
- **Mouse wheel** - Zoom in/out
- **Click and drag** - Pan the view
- **Double-click** - Center on point

### Keyboard Shortcuts
- **Space** - Save current Julia set (in Julia mode)
- **Escape** - Close dialogs
- **Arrow keys** - Fine-tune position

### Animation
1. Navigate to your first keyframe position
2. Click "Add Keyframe" in the Animation panel
3. Navigate to your next position
4. Add more keyframes
5. Adjust timing between keyframes
6. Preview with play button
7. Export as video

## Deployment

### Netlify (Recommended)

The app includes a `netlify.toml` configuration file. Simply:

1. Push to GitHub
2. Connect your repo to Netlify
3. Deploy automatically on push

The required CORS headers for video export are pre-configured.

### Other Platforms

Ensure your hosting platform sets these headers for video export to work:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

## PWA Support

Fractal Voyager is a Progressive Web App that can be installed on desktop and mobile devices. All features, including video export, work offline after installation.

## License

Copyright (c) 2025. All Rights Reserved.

See [LICENSE](LICENSE) for details.

## Acknowledgments

This project is a modern reimagining of an original Windows WPF fractal explorer application. Special thanks to the original author for the inspiration and mathematical foundations that made this project possible.
