import { useRef, useEffect, useCallback, useState, useMemo, useLayoutEffect } from 'react';
import { useFractalStore } from '../../store/fractalStore';
import { WebGLRenderer, checkWebGLSupport } from '../../webgl/renderer';
import { PRESET_PALETTES, generateShaderPalette, applyTemperatureToPalette } from '../../lib/colors';
import { useTouchGestures } from '../../hooks/useTouchGestures';

export function Mandelbulb3D() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<WebGLRenderer | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const {
    maxIterations,
    setRenderMode,
    camera3D,
    mandelbulbParams,
    lightingParams,
    renderQuality,
    colorFactors3D,
    equation3dId,
    rotateCamera3D,
    zoomCamera3D,
    currentPaletteId,
    colorTemperature,
    customPalettes,
    setHighPrecisionActive,
  } = useFractalStore();

  // Compute the shader palette based on current selection and temperature
  const shaderPalette = useMemo(() => {
    // Find the palette
    let palette = PRESET_PALETTES.find(p => p.id === currentPaletteId);
    if (!palette) {
      const custom = customPalettes.find(p => p.id === currentPaletteId);
      if (custom) {
        palette = { ...custom, isCustom: true };
      }
    }
    if (!palette) {
      palette = PRESET_PALETTES[0]; // Default fallback
    }

    // Apply temperature and generate shader data
    const tempAdjusted = applyTemperatureToPalette(palette.colors, colorTemperature);
    return generateShaderPalette(tempAdjusted);
  }, [currentPaletteId, colorTemperature, customPalettes]);

  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [contextLost, setContextLost] = useState(false);
  const [renderKey, setRenderKey] = useState(0); // Used to trigger re-renders after context restoration
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

  // RAF-based render throttling - batches rapid updates to one render per frame
  const rafIdRef = useRef<number | null>(null);

  // 3D always uses WebGL, so clear the high precision flag
  useEffect(() => {
    setHighPrecisionActive(false);
  }, [setHighPrecisionActive]);

  // Initialize WebGL
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const detectedMode = checkWebGLSupport();
    setRenderMode(detectedMode);

    if (detectedMode === 'webgl') {
      rendererRef.current = new WebGLRenderer(canvas);

      // Set up context loss/restoration callbacks
      rendererRef.current.setContextLostCallback(() => {
        console.warn('Mandelbulb3D: WebGL context lost');
        setContextLost(true);
      });

      rendererRef.current.setContextRestoredCallback(() => {
        console.log('Mandelbulb3D: WebGL context restored');
        setContextLost(false);
        // Trigger a re-render by incrementing the key
        setRenderKey(prev => prev + 1);
      });

      if (!rendererRef.current.isAvailable()) {
        setRenderMode('canvas2d');
        rendererRef.current = null;
      }
    }

    return () => {
      rendererRef.current?.dispose();
      rendererRef.current = null;
    };
  }, [setRenderMode]);

  // Handle resize using ResizeObserver to catch sidebar/panel changes
  useLayoutEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const updateSize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = container.getBoundingClientRect();
      const width = Math.floor(rect.width * dpr);
      const height = Math.floor(rect.height * dpr);

      if (width > 0 && height > 0) {
        canvas.width = width;
        canvas.height = height;
        canvas.style.width = `${rect.width}px`;
        canvas.style.height = `${rect.height}px`;

        rendererRef.current?.resize(width, height);
        setCanvasSize({ width, height });
      }
    };

    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(container);
    updateSize();

    return () => resizeObserver.disconnect();
  }, []);

  // Render the 3D fractal with RAF throttling
  // This batches rapid slider updates so slow devices don't queue up dozens of renders
  useEffect(() => {
    const canvas = canvasRef.current;
    const renderer = rendererRef.current;
    if (!canvas || !renderer || contextLost) return;

    // Cancel any pending RAF to avoid stale renders
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
    }

    // Schedule render on next animation frame
    // This coalesces multiple rapid state updates into a single render
    rafIdRef.current = requestAnimationFrame(() => {
      rafIdRef.current = null;
      renderer.setFractalType('mandelbulb');
      renderer.setPalette(shaderPalette);
      renderer.render3D(
        camera3D,
        mandelbulbParams,
        lightingParams,
        renderQuality,
        maxIterations,
        0,
        equation3dId,
        colorFactors3D
      );
    });

    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [camera3D, mandelbulbParams, lightingParams, renderQuality, colorFactors3D, maxIterations, shaderPalette, contextLost, renderKey, canvasSize, equation3dId]);

  const getCanvasCoords = useCallback((e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0) {
      const coords = getCanvasCoords(e);
      setIsDragging(true);
      setDragStart(coords);
    }
  }, [getCanvasCoords]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging && dragStart) {
      const coords = getCanvasCoords(e);
      const deltaX = coords.x - dragStart.x;
      const deltaY = coords.y - dragStart.y;

      rotateCamera3D(deltaX, deltaY);
      setDragStart(coords);
    }
  }, [isDragging, dragStart, getCanvasCoords, rotateCamera3D]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setDragStart(null);
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    zoomCamera3D(e.deltaY);
  }, [zoomCamera3D]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (isDragging) {
      setIsDragging(false);
      setDragStart(null);
    }
  }, [isDragging]);

  // Touch gesture handlers for 3D
  const handleTouchPanMove = useCallback((_x: number, _y: number, deltaX: number, deltaY: number) => {
    // Rotate camera based on drag
    rotateCamera3D(deltaX, deltaY);
  }, [rotateCamera3D]);

  const handleTouchPinchMove = useCallback((_centerX: number, _centerY: number, scale: number) => {
    // Scale < 1 means fingers apart (zoom in), scale > 1 means fingers together (zoom out)
    // Convert to a delta similar to wheel - negative zooms in, positive zooms out
    const delta = (1 - scale) * 500; // Scale factor for sensitivity
    zoomCamera3D(delta);
  }, [zoomCamera3D]);

  // Apply touch gestures to container
  useTouchGestures(containerRef as React.RefObject<HTMLElement>, {
    onPanMove: handleTouchPanMove,
    onPinchMove: handleTouchPinchMove,
  });

  return (
    <div ref={containerRef} className="w-full h-full relative">
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onWheel={handleWheel}
        onContextMenu={handleContextMenu}
      />
      {/* Context lost overlay */}
      {contextLost && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-10">
          <div className="text-center text-white p-6">
            <svg className="w-12 h-12 mx-auto mb-4 text-yellow-500 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <div className="text-lg font-medium mb-2">WebGL Context Lost</div>
            <div className="text-sm text-gray-400">
              The GPU ran out of resources. Attempting to recover...
            </div>
            <div className="text-xs text-gray-500 mt-2">
              Try reducing quality settings if this persists.
            </div>
          </div>
        </div>
      )}
      <div className="absolute bottom-4 left-4 bg-black/60 text-white text-xs px-2 py-1 rounded pointer-events-none">
        Drag to rotate, scroll to zoom
      </div>
    </div>
  );
}
