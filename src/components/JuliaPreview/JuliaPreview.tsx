import { useRef, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { useFractalStore } from '../../store/fractalStore';
import { WebGLRenderer } from '../../webgl/renderer';
import { PRESET_PALETTES, generateShaderPalette, applyTemperatureToPalette } from '../../lib/colors';

export function JuliaPreview() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<WebGLRenderer | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [contextLost, setContextLost] = useState(false);
  const [renderKey, setRenderKey] = useState(0);

  const {
    heatmapPreviewConstant,
    equationId,
    maxIterations,
    setThumbnailCanvas,
    currentPaletteId,
    colorTemperature,
    customPalettes,
  } = useFractalStore();

  // Compute the shader palette based on current selection and temperature
  const shaderPalette = useMemo(() => {
    let palette = PRESET_PALETTES.find(p => p.id === currentPaletteId);
    if (!palette) {
      const custom = customPalettes.find(p => p.id === currentPaletteId);
      if (custom) {
        palette = { ...custom, isCustom: true };
      }
    }
    if (!palette) {
      palette = PRESET_PALETTES[0];
    }

    const tempAdjusted = applyTemperatureToPalette(palette.colors, colorTemperature);
    return generateShaderPalette(tempAdjusted);
  }, [currentPaletteId, colorTemperature, customPalettes]);

  // Initialize WebGL renderer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    rendererRef.current = new WebGLRenderer(canvas);

    // Set up context loss/restoration callbacks
    rendererRef.current.setContextLostCallback(() => {
      console.warn('JuliaPreview: WebGL context lost');
      setContextLost(true);
    });

    rendererRef.current.setContextRestoredCallback(() => {
      console.log('JuliaPreview: WebGL context restored');
      setContextLost(false);
      setRenderKey(prev => prev + 1);
    });

    if (!rendererRef.current.isAvailable()) {
      rendererRef.current = null;
    }

    return () => {
      rendererRef.current?.dispose();
      rendererRef.current = null;
    };
  }, []);

  // Handle resize - 16:9 aspect ratio
  useLayoutEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const updateSize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = container.getBoundingClientRect();
      const width = Math.floor(rect.width * dpr);
      const height = Math.floor(rect.width * (9 / 16) * dpr);

      if (width > 0 && height > 0) {
        canvas.width = width;
        canvas.height = height;
        canvas.style.width = `${rect.width}px`;
        canvas.style.height = `${rect.width * (9 / 16)}px`;
        rendererRef.current?.resize(width, height);
      }
    };

    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(container);
    updateSize();

    return () => resizeObserver.disconnect();
  }, []);

  // Render Julia preview with 16:9 bounds, centered at origin
  useEffect(() => {
    if (rendererRef.current && heatmapPreviewConstant && !contextLost) {
      rendererRef.current.setFractalType('julia');
      rendererRef.current.setPalette(shaderPalette);
      // 16:9 aspect ratio bounds centered at origin
      // Real range of 4 (-2 to 2), imag range = 4 * 9/16 = 2.25
      const halfReal = 2.0;
      const halfImag = halfReal * (9 / 16); // 1.125
      const previewBounds = {
        minReal: -halfReal,
        maxReal: halfReal,
        minImag: -halfImag,
        maxImag: halfImag,
      };
      rendererRef.current.render(
        previewBounds,
        Math.min(maxIterations, 256),
        0,
        heatmapPreviewConstant,
        equationId
      );
    }
  }, [heatmapPreviewConstant, equationId, maxIterations, shaderPalette, contextLost, renderKey]);

  // Register canvas for thumbnail capture when preview is active
  useEffect(() => {
    if (heatmapPreviewConstant && canvasRef.current) {
      setThumbnailCanvas(canvasRef.current);
    }
    return () => {
      // Only clear if we were the ones who set it
      if (heatmapPreviewConstant) {
        setThumbnailCanvas(null);
      }
    };
  }, [heatmapPreviewConstant, setThumbnailCanvas]);

  return (
    <div className="bg-gray-900/90 backdrop-blur-sm rounded-lg p-3 shadow-lg border border-gray-700/50">
      <div className="text-xs text-gray-300 font-medium mb-2">Julia Preview</div>
      <div
        ref={containerRef}
        className="w-full aspect-video relative bg-black rounded overflow-hidden"
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0"
        />
        {contextLost && (
          <div className="absolute inset-0 flex items-center justify-center text-yellow-500 text-xs text-center p-2 bg-black/80">
            GPU recovering...
          </div>
        )}
        {!heatmapPreviewConstant && !contextLost && (
          <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-xs text-center p-2">
            Hover over heatmap
          </div>
        )}
      </div>
      {heatmapPreviewConstant && (
        <div className="mt-2 space-y-1">
          <div className="text-xs text-gray-400 font-mono">
            c = {heatmapPreviewConstant.real.toFixed(4)}{heatmapPreviewConstant.imag >= 0 ? '+' : ''}{heatmapPreviewConstant.imag.toFixed(4)}i
          </div>
          <div className="text-xs text-gray-500">
            Double-click to open
          </div>
          <div className="text-xs text-gray-500">
            Space to save
          </div>
        </div>
      )}
    </div>
  );
}
