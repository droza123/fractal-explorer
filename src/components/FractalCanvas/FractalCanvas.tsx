import { useRef, useEffect, useCallback, useState, useMemo, useLayoutEffect } from 'react';
import { useFractalStore } from '../../store/fractalStore';
import { WebGLRenderer, checkWebGLSupport } from '../../webgl/renderer';
import { renderCanvas2DParallel } from '../../lib/canvas2dRenderer';
import { PRESET_PALETTES, generateShaderPalette, applyTemperatureToPalette } from '../../lib/colors';
import type { SelectionRect } from '../../types';

export function FractalCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvas2DRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<WebGLRenderer | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [usingCanvas2D, setUsingCanvas2D] = useState(false);
  const [showCanvas2D, setShowCanvas2D] = useState(false); // Only show CPU canvas after render completes
  const [renderProgress, setRenderProgress] = useState(0);
  const [isRendering, setIsRendering] = useState(false);
  const currentRenderIdRef = useRef(0); // Track current render to avoid stale callbacks
  const [contextLost, setContextLost] = useState(false);
  const [renderKey, setRenderKey] = useState(0); // Used to trigger re-renders after context restoration
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

  const {
    viewBounds,
    setViewBounds,
    maxIterations,
    renderMode,
    selection,
    setSelection,
    setRenderMode,
    zoomToSelection,
    zoomAtPoint,
    fractalType,
    juliaConstant,
    equationId,
    switchToJulia,
    pushHistory,
    saveCurrentJulia,
    setThumbnailCanvas,
    currentPaletteId,
    colorTemperature,
    customPalettes,
    renderQuality2D,
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
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number } | null>(null);
  const [panStartBounds, setPanStartBounds] = useState<typeof viewBounds | null>(null);
  const renderDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const detectedMode = checkWebGLSupport();
    setRenderMode(detectedMode);

    if (detectedMode === 'webgl') {
      rendererRef.current = new WebGLRenderer(canvas);

      // Set up context loss/restoration callbacks
      rendererRef.current.setContextLostCallback(() => {
        console.warn('FractalCanvas: WebGL context lost');
        setContextLost(true);
      });

      rendererRef.current.setContextRestoredCallback(() => {
        console.log('FractalCanvas: WebGL context restored');
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
    const canvas2D = canvas2DRef.current;
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

        // Also resize the 2D canvas if it exists
        if (canvas2D) {
          canvas2D.width = width;
          canvas2D.height = height;
          canvas2D.style.width = `${rect.width}px`;
          canvas2D.style.height = `${rect.height}px`;
        }

        rendererRef.current?.resize(width, height);
        setCanvasSize({ width, height });
      }
    };

    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(container);
    updateSize();

    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const canvas2D = canvas2DRef.current;
    if (!canvas) return;

    // Check if high precision is needed
    const range = Math.min(
      viewBounds.maxReal - viewBounds.minReal,
      viewBounds.maxImag - viewBounds.minImag
    );
    // Calculate threshold from zoom level setting (range = 3 / zoom)
    const rangeThreshold = 3 / renderQuality2D.precisionSwitchZoom;
    const needsHighPrecision = renderQuality2D.precisionMode === 'high' ||
      (renderQuality2D.precisionMode === 'auto' && range < rangeThreshold);

    // Use Canvas 2D for high precision (JavaScript float64 has better precision than WebGL float32)
    // Only for 2D fractals (mandelbrot/julia), not for mandelbulb
    // Also force Canvas 2D if WebGL context is lost
    const shouldUseCanvas2D = (renderMode === 'canvas2d' || contextLost ||
      (needsHighPrecision && (fractalType === 'mandelbrot' || fractalType === 'julia'))) &&
      fractalType !== 'mandelbulb';

    setUsingCanvas2D(shouldUseCanvas2D);
    setHighPrecisionActive(shouldUseCanvas2D);

    // Clear any pending debounced render
    if (renderDebounceRef.current) {
      clearTimeout(renderDebounceRef.current);
      renderDebounceRef.current = null;
    }

    if (!shouldUseCanvas2D && renderMode === 'webgl' && rendererRef.current) {
      // WebGL rendering - immediate (fast enough)
      // Hide CPU canvas when switching to WebGL
      setShowCanvas2D(false);
      rendererRef.current.setFractalType(fractalType);
      rendererRef.current.setPalette(shaderPalette);
      rendererRef.current.render(
        viewBounds,
        maxIterations,
        0,
        juliaConstant,
        equationId,
        renderQuality2D.antiAlias,
        renderQuality2D.precisionMode
      );
    } else if (shouldUseCanvas2D && canvas2D) {
      // Canvas 2D parallel rendering - debounced to avoid rendering intermediate zoom levels
      const ctx = canvas2D.getContext('2d');
      if (ctx) {
        // Debounce by 100ms to let scroll wheel settle
        // Don't show progress until after debounce completes
        renderDebounceRef.current = setTimeout(() => {
          // Increment render ID to track this specific render
          const renderId = ++currentRenderIdRef.current;

          setIsRendering(true);
          setRenderProgress(0);
          renderCanvas2DParallel(
            ctx,
            viewBounds,
            maxIterations,
            0,
            fractalType,
            juliaConstant,
            equationId,
            (progress) => {
              // Only update progress if this is still the current render
              if (renderId === currentRenderIdRef.current) {
                setRenderProgress(progress);
              }
            },
            shaderPalette,
            renderQuality2D.antiAliasCPU
          ).then(() => {
            // Only update state if this is still the current render
            if (renderId === currentRenderIdRef.current) {
              setShowCanvas2D(true);
            }
          }).finally(() => {
            // Only update state if this is still the current render
            if (renderId === currentRenderIdRef.current) {
              setIsRendering(false);
              setRenderProgress(1);
            }
          });
        }, 100);
      }
    }

    // Cleanup debounce timer on unmount or dependency change
    return () => {
      if (renderDebounceRef.current) {
        clearTimeout(renderDebounceRef.current);
      }
    };
  }, [viewBounds, maxIterations, renderMode, fractalType, juliaConstant, equationId, shaderPalette, renderQuality2D, contextLost, renderKey, canvasSize]);

  const getCanvasCoords = useCallback((e: React.MouseEvent) => {
    const canvas = showCanvas2D ? canvas2DRef.current : canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    return {
      x: (e.clientX - rect.left) * dpr,
      y: (e.clientY - rect.top) * dpr,
    };
  }, [showCanvas2D]);

  const getComplexCoords = useCallback((x: number, y: number) => {
    const canvas = showCanvas2D ? canvas2DRef.current : canvasRef.current;
    if (!canvas) return { real: 0, imag: 0 };

    const realRange = viewBounds.maxReal - viewBounds.minReal;
    const imagRange = viewBounds.maxImag - viewBounds.minImag;

    return {
      real: viewBounds.minReal + (x / canvas.width) * realRange,
      imag: viewBounds.maxImag - (y / canvas.height) * imagRange,
    };
  }, [viewBounds, showCanvas2D]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const coords = getCanvasCoords(e);

    if (e.button === 0) {
      // Left click - start selection
      setIsDragging(true);
      setDragStart(coords);
      setSelection({
        startX: coords.x,
        startY: coords.y,
        endX: coords.x,
        endY: coords.y,
      });
    } else if (e.button === 2) {
      // Right click - start panning
      setIsPanning(true);
      setPanStart(coords);
      setPanStartBounds({ ...viewBounds });
    }
  }, [getCanvasCoords, setSelection, viewBounds]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const coords = getCanvasCoords(e);
    const canvas = canvasRef.current;

    if (isPanning && panStart && canvas) {
      // Calculate pan delta in complex coordinates
      const realRange = viewBounds.maxReal - viewBounds.minReal;
      const imagRange = viewBounds.maxImag - viewBounds.minImag;

      const deltaReal = ((panStart.x - coords.x) / canvas.width) * realRange;
      const deltaImag = ((coords.y - panStart.y) / canvas.height) * imagRange;

      setViewBounds({
        minReal: viewBounds.minReal + deltaReal,
        maxReal: viewBounds.maxReal + deltaReal,
        minImag: viewBounds.minImag + deltaImag,
        maxImag: viewBounds.maxImag + deltaImag,
      });

      setPanStart(coords);
    } else if (isDragging && dragStart) {
      setSelection({
        startX: dragStart.x,
        startY: dragStart.y,
        endX: coords.x,
        endY: coords.y,
      });
    }
  }, [isDragging, dragStart, isPanning, panStart, getCanvasCoords, setSelection, viewBounds, setViewBounds]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (e.button === 2 && isPanning) {
      // Right click release - end panning, commit to history
      if (panStartBounds) {
        pushHistory({ viewBounds });
      }
      setIsPanning(false);
      setPanStart(null);
      setPanStartBounds(null);
      return;
    }

    if (!isDragging || !selection) {
      setIsDragging(false);
      setDragStart(null);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const width = Math.abs(selection.endX - selection.startX);
    const height = Math.abs(selection.endY - selection.startY);

    if (width > 10 && height > 10) {
      zoomToSelection(canvas.width, canvas.height);
    } else {
      setSelection(null);
    }

    setIsDragging(false);
    setDragStart(null);
  }, [isDragging, isPanning, selection, panStartBounds, viewBounds, zoomToSelection, setSelection, pushHistory]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();

    const canvas = canvasRef.current;
    if (!canvas) return;

    const coords = getCanvasCoords(e);
    const zoomFactor = e.deltaY > 0 ? 1.2 : 0.8;

    zoomAtPoint(coords.x, coords.y, zoomFactor, canvas.width, canvas.height);
  }, [getCanvasCoords, zoomAtPoint]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    if (fractalType !== 'mandelbrot') return;

    const coords = getCanvasCoords(e);
    const complex = getComplexCoords(coords.x, coords.y);

    switchToJulia(complex);
  }, [fractalType, getCanvasCoords, getComplexCoords, switchToJulia]);

  const handleMouseLeave = useCallback(() => {
    if (isDragging) {
      setIsDragging(false);
      setDragStart(null);
      setSelection(null);
    }
    if (isPanning) {
      // Cancel panning, revert to start bounds
      if (panStartBounds) {
        setViewBounds(panStartBounds);
      }
      setIsPanning(false);
      setPanStart(null);
      setPanStartBounds(null);
    }
  }, [isDragging, isPanning, panStartBounds, setSelection, setViewBounds]);

  // Register canvas for thumbnail generation in Julia mode
  useEffect(() => {
    if (fractalType === 'julia' && canvasRef.current) {
      setThumbnailCanvas(canvasRef.current);
    }
    return () => {
      if (fractalType === 'julia') {
        setThumbnailCanvas(null);
      }
    };
  }, [fractalType, setThumbnailCanvas]);

  // Handle spacebar for quick save in Julia mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input field
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }
      if (e.code === 'Space' && fractalType === 'julia') {
        e.preventDefault();
        saveCurrentJulia();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [fractalType, saveCurrentJulia]);

  return (
    <div ref={containerRef} className="w-full h-full relative">
      {/* WebGL canvas - hidden only when CPU canvas has finished rendering */}
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 ${isPanning ? 'cursor-grabbing' : 'cursor-crosshair'} ${showCanvas2D ? 'hidden' : ''}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onWheel={handleWheel}
        onContextMenu={handleContextMenu}
        onDoubleClick={handleDoubleClick}
      />
      {/* Canvas 2D for high-precision rendering - shown only after render completes */}
      <canvas
        ref={canvas2DRef}
        className={`absolute inset-0 ${isPanning ? 'cursor-grabbing' : 'cursor-crosshair'} ${showCanvas2D ? '' : 'hidden'}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onWheel={handleWheel}
        onContextMenu={handleContextMenu}
        onDoubleClick={handleDoubleClick}
      />
      {selection && <SelectionOverlay selection={selection} />}
      {/* High precision indicator with progress bar */}
      {usingCanvas2D && (
        <div className="absolute top-2 right-2 bg-purple-600/80 text-white text-xs px-2 py-1 rounded min-w-[140px]">
          <div className="flex items-center justify-between gap-2">
            <span>High Precision</span>
            {isRendering && (
              <span className="text-purple-200">{Math.round(renderProgress * 100)}%</span>
            )}
          </div>
          {isRendering && (
            <div className="mt-1 h-1 bg-purple-900 rounded-full overflow-hidden">
              <div
                className="h-full bg-purple-300 transition-all duration-100"
                style={{ width: `${renderProgress * 100}%` }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SelectionOverlay({ selection }: { selection: SelectionRect }) {
  const dpr = window.devicePixelRatio || 1;

  const x1 = Math.min(selection.startX, selection.endX) / dpr;
  const y1 = Math.min(selection.startY, selection.endY) / dpr;
  const x2 = Math.max(selection.startX, selection.endX) / dpr;
  const y2 = Math.max(selection.startY, selection.endY) / dpr;

  const width = x2 - x1;
  const height = y2 - y1;

  if (width < 2 || height < 2) return null;

  return (
    <div
      className="absolute pointer-events-none border-2 border-white/80 bg-white/10"
      style={{
        left: x1,
        top: y1,
        width,
        height,
      }}
    />
  );
}
