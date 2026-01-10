import { useRef, useEffect, useCallback, useState, useMemo, useLayoutEffect } from 'react';
import { useFractalStore } from '../../store/fractalStore';
import { WebGLRenderer, checkWebGLSupport } from '../../webgl/renderer';
import { renderCanvas2DParallel } from '../../lib/canvas2dRenderer';
import { PRESET_PALETTES, generateShaderPalette, applyTemperatureToPalette } from '../../lib/colors';
import { useTouchGestures } from '../../hooks/useTouchGestures';
import type { SelectionRect, ViewBounds } from '../../types';

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
    setViewBoundsWithZoom,
    maxIterations,
    renderMode,
    selection,
    setSelection,
    setRenderMode,
    zoomToSelection,
    zoomAtPointAnimated,
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

  // RAF-based throttling for WebGL rendering - batches rapid updates to one render per frame
  const webglRafIdRef = useRef<number | null>(null);
  const pendingWebGLRenderRef = useRef<{
    viewBounds: ViewBounds;
    maxIterations: number;
    fractalType: string;
    juliaConstant: { real: number; imag: number };
    equationId: number;
    antiAlias: number;
    precisionMode: 'auto' | 'standard' | 'high';
    shaderPalette: ReturnType<typeof generateShaderPalette>;
  } | null>(null);

  // Touch gesture state
  const touchPanStartBoundsRef = useRef<ViewBounds | null>(null);
  const touchPinchStartBoundsRef = useRef<ViewBounds | null>(null);

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
      // WebGL rendering with RAF throttling
      // Hide CPU canvas when switching to WebGL
      setShowCanvas2D(false);

      // Store the latest render params
      pendingWebGLRenderRef.current = {
        viewBounds,
        maxIterations,
        fractalType,
        juliaConstant,
        equationId,
        antiAlias: renderQuality2D.antiAlias,
        precisionMode: renderQuality2D.precisionMode,
        shaderPalette,
      };

      // If we already have a RAF scheduled, it will use the updated params
      if (webglRafIdRef.current === null) {
        // Schedule render on next animation frame
        webglRafIdRef.current = requestAnimationFrame(() => {
          webglRafIdRef.current = null;
          const params = pendingWebGLRenderRef.current;
          const renderer = rendererRef.current;
          if (params && renderer) {
            renderer.setFractalType(params.fractalType as 'mandelbrot' | 'julia' | 'heatmap' | 'mandelbulb');
            renderer.setPalette(params.shaderPalette);
            renderer.render(
              params.viewBounds,
              params.maxIterations,
              0,
              params.juliaConstant,
              params.equationId,
              params.antiAlias,
              params.precisionMode
            );
          }
        });
      }
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

    // Cleanup timers on unmount or dependency change
    return () => {
      if (renderDebounceRef.current) {
        clearTimeout(renderDebounceRef.current);
      }
      if (webglRafIdRef.current !== null) {
        cancelAnimationFrame(webglRafIdRef.current);
        webglRafIdRef.current = null;
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

    zoomAtPointAnimated(coords.x, coords.y, zoomFactor, canvas.width, canvas.height);
  }, [getCanvasCoords, zoomAtPointAnimated]);

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

  // Register canvas for thumbnail generation in 2D modes (Julia and Mandelbrot)
  // Use the currently visible canvas (WebGL or CPU based on showCanvas2D)
  useEffect(() => {
    const is2DMode = fractalType === 'julia' || fractalType === 'mandelbrot';
    const activeCanvas = showCanvas2D ? canvas2DRef.current : canvasRef.current;
    if (is2DMode && activeCanvas) {
      setThumbnailCanvas(activeCanvas);
    }
    return () => {
      if (is2DMode) {
        setThumbnailCanvas(null);
      }
    };
  }, [fractalType, showCanvas2D, setThumbnailCanvas]);

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

  // Touch gesture handlers
  const handleTouchPanStart = useCallback(() => {
    touchPanStartBoundsRef.current = { ...viewBounds };
  }, [viewBounds]);

  const handleTouchPanMove = useCallback((_x: number, _y: number, deltaX: number, deltaY: number) => {
    const canvas = showCanvas2D ? canvas2DRef.current : canvasRef.current;
    if (!canvas) return;

    const realRange = viewBounds.maxReal - viewBounds.minReal;
    const imagRange = viewBounds.maxImag - viewBounds.minImag;

    // Convert pixel delta to complex plane delta
    const deltaReal = (-deltaX / canvas.width) * realRange;
    const deltaImag = (deltaY / canvas.height) * imagRange;

    setViewBounds({
      minReal: viewBounds.minReal + deltaReal,
      maxReal: viewBounds.maxReal + deltaReal,
      minImag: viewBounds.minImag + deltaImag,
      maxImag: viewBounds.maxImag + deltaImag,
    });
  }, [viewBounds, setViewBounds, showCanvas2D]);

  const handleTouchPanEnd = useCallback(() => {
    if (touchPanStartBoundsRef.current) {
      pushHistory({ viewBounds });
    }
    touchPanStartBoundsRef.current = null;
  }, [viewBounds, pushHistory]);

  const handleTouchPinchStart = useCallback(() => {
    touchPinchStartBoundsRef.current = { ...viewBounds };
  }, [viewBounds]);

  const handleTouchPinchMove = useCallback((centerX: number, centerY: number, scale: number) => {
    const canvas = showCanvas2D ? canvas2DRef.current : canvasRef.current;
    if (!canvas || !touchPinchStartBoundsRef.current) return;

    // Scale < 1 means fingers moving apart (zoom in)
    // Scale > 1 means fingers moving together (zoom out)
    const zoomFactor = 1 / scale;

    // Get the complex coordinates at the pinch center
    const bounds = touchPinchStartBoundsRef.current;
    const realRange = bounds.maxReal - bounds.minReal;
    const imagRange = bounds.maxImag - bounds.minImag;

    const centerReal = bounds.minReal + (centerX / canvas.width) * realRange;
    const centerImag = bounds.maxImag - (centerY / canvas.height) * imagRange;

    // Calculate new range
    const newRealRange = realRange * zoomFactor;
    const newImagRange = imagRange * zoomFactor;

    // Calculate ratio of center point in the view
    const ratioX = centerX / canvas.width;
    const ratioY = centerY / canvas.height;

    const newBounds: ViewBounds = {
      minReal: centerReal - ratioX * newRealRange,
      maxReal: centerReal + (1 - ratioX) * newRealRange,
      minImag: centerImag - (1 - ratioY) * newImagRange,
      maxImag: centerImag + ratioY * newImagRange,
    };

    // Update bounds and zoom factor (without committing to history)
    setViewBoundsWithZoom(newBounds, false);

    // Update start bounds for continuous pinching (use the NEW bounds, not stale viewBounds)
    touchPinchStartBoundsRef.current = newBounds;
  }, [setViewBoundsWithZoom, showCanvas2D]);

  const handleTouchPinchEnd = useCallback(() => {
    if (touchPinchStartBoundsRef.current) {
      // Commit the final bounds to history
      setViewBoundsWithZoom(touchPinchStartBoundsRef.current, true);
    }
    touchPinchStartBoundsRef.current = null;
  }, [setViewBoundsWithZoom]);

  const handleTouchDoubleTap = useCallback((x: number, y: number) => {
    const canvas = showCanvas2D ? canvas2DRef.current : canvasRef.current;
    if (!canvas) return;

    if (fractalType === 'mandelbrot') {
      // Switch to Julia set at this point
      const realRange = viewBounds.maxReal - viewBounds.minReal;
      const imagRange = viewBounds.maxImag - viewBounds.minImag;
      const complex = {
        real: viewBounds.minReal + (x / canvas.width) * realRange,
        imag: viewBounds.maxImag - (y / canvas.height) * imagRange,
      };
      switchToJulia(complex);
    } else {
      // Zoom in at this point
      zoomAtPointAnimated(x, y, 0.5, canvas.width, canvas.height);
    }
  }, [fractalType, viewBounds, switchToJulia, zoomAtPointAnimated, showCanvas2D]);

  // Apply touch gestures to container
  useTouchGestures(containerRef as React.RefObject<HTMLElement>, {
    onPanStart: handleTouchPanStart,
    onPanMove: handleTouchPanMove,
    onPanEnd: handleTouchPanEnd,
    onPinchStart: handleTouchPinchStart,
    onPinchMove: handleTouchPinchMove,
    onPinchEnd: handleTouchPinchEnd,
    onDoubleTap: handleTouchDoubleTap,
  });

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
      {/* FAB for saving Julia */}
      {fractalType === 'julia' && (
        <button
          onClick={() => saveCurrentJulia()}
          className="absolute w-14 h-14 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white rounded-full shadow-lg flex items-center justify-center transition-colors z-10 group"
          style={{ bottom: '15px', right: '15px' }}
          aria-label="Save Julia"
        >
          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          {/* Tooltip */}
          <span className="absolute right-full mr-3 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            Save Julia (Space)
          </span>
        </button>
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
