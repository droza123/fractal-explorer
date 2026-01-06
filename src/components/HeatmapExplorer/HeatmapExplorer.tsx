import { useRef, useEffect, useCallback, useState, useLayoutEffect, useMemo } from 'react';
import { useFractalStore } from '../../store/fractalStore';
import { WebGLRenderer } from '../../webgl/renderer';
import { PRESET_PALETTES, generateShaderPalette, applyTemperatureToPalette } from '../../lib/colors';
import { getCategoryColor } from '../../lib/suggestions';
import { SuggestionsPanel } from '../SuggestionsPanel';
import type { SelectionRect, Complex, SuggestedPoint } from '../../types';

export function HeatmapExplorer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<WebGLRenderer | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [webglUnavailable, setWebglUnavailable] = useState(false);
  const [renderKey, setRenderKey] = useState(0);
  const [canvasKey, setCanvasKey] = useState(0); // Used to force canvas recreation

  const {
    viewBounds,
    setViewBounds,
    maxIterations,
    selection,
    setSelection,
    zoomToSelection,
    zoomAtPoint,
    equationId,
    heatmapPreviewConstant,
    setHeatmapPreviewConstant,
    setCursorPosition,
    switchToJulia,
    saveCurrentJulia,
    setJuliaConstant,
    pushHistory,
    currentPaletteId,
    colorTemperature,
    customPalettes,
    renderQuality2D,
    setHighPrecisionActive,
    // AI Suggestions
    suggestions,
    highlightedSuggestion,
    showSuggestionsPanel,
    clearSuggestions,
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

  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number } | null>(null);
  const [panStartBounds, setPanStartBounds] = useState<typeof viewBounds | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

  // Heatmap always uses WebGL, so clear the high precision flag
  useEffect(() => {
    setHighPrecisionActive(false);
  }, [setHighPrecisionActive]);

  // Initialize WebGL renderer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Dispose existing renderer if any
    if (rendererRef.current) {
      rendererRef.current.dispose();
      rendererRef.current = null;
    }

    const renderer = new WebGLRenderer(canvas);

    // Set up context loss/restoration callbacks
    renderer.setContextLostCallback(() => {
      console.warn('HeatmapExplorer: WebGL context lost');
      setWebglUnavailable(true);
    });

    renderer.setContextRestoredCallback(() => {
      console.log('HeatmapExplorer: WebGL context restored');
      setWebglUnavailable(false);
      setRenderKey(prev => prev + 1);
    });

    if (!renderer.isAvailable()) {
      console.warn('HeatmapExplorer: WebGL not available on init');
      renderer.dispose();
      rendererRef.current = null;
      setWebglUnavailable(true);
      return;
    }

    rendererRef.current = renderer;
    setWebglUnavailable(false);
    setRenderKey(prev => prev + 1);

    return () => {
      renderer.dispose();
      rendererRef.current = null;
    };
  }, [canvasKey]); // Re-run when canvasKey changes (retry)

  // Retry GPU handler - forces canvas recreation
  const handleRetryGPU = useCallback(() => {
    console.log('Attempting to reinitialize WebGL with new canvas...');
    setCanvasKey(prev => prev + 1);
  }, []);

  // Handle resize using ResizeObserver
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
  }, [canvasKey]); // Re-run when canvas is recreated

  // Render heatmap
  useEffect(() => {
    if (rendererRef.current && canvasSize.width > 0 && canvasSize.height > 0 && !webglUnavailable) {
      rendererRef.current.setFractalType('heatmap');
      rendererRef.current.setPalette(shaderPalette);
      rendererRef.current.render(viewBounds, maxIterations, 0, undefined, equationId, renderQuality2D.antiAlias);
    }
  }, [viewBounds, maxIterations, equationId, canvasSize, shaderPalette, renderQuality2D, webglUnavailable, renderKey]);

  const getCanvasCoords = useCallback((e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    return {
      x: (e.clientX - rect.left) * dpr,
      y: (e.clientY - rect.top) * dpr,
    };
  }, []);

  const getComplexCoords = useCallback((x: number, y: number): Complex => {
    const canvas = canvasRef.current;
    if (!canvas) return { real: 0, imag: 0 };

    const realRange = viewBounds.maxReal - viewBounds.minReal;
    const imagRange = viewBounds.maxImag - viewBounds.minImag;

    return {
      real: viewBounds.minReal + (x / canvas.width) * realRange,
      imag: viewBounds.maxImag - (y / canvas.height) * imagRange,
    };
  }, [viewBounds]);

  // Convert complex coordinates to screen coordinates (CSS pixels, not canvas pixels)
  const getScreenCoords = useCallback((c: Complex): { x: number; y: number } | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const realRange = viewBounds.maxReal - viewBounds.minReal;
    const imagRange = viewBounds.maxImag - viewBounds.minImag;
    const dpr = window.devicePixelRatio || 1;

    // Check if point is in view
    if (c.real < viewBounds.minReal || c.real > viewBounds.maxReal ||
        c.imag < viewBounds.minImag || c.imag > viewBounds.maxImag) {
      return null;
    }

    // Convert to CSS pixels (not canvas pixels)
    const x = ((c.real - viewBounds.minReal) / realRange) * (canvas.width / dpr);
    const y = ((viewBounds.maxImag - c.imag) / imagRange) * (canvas.height / dpr);

    return { x, y };
  }, [viewBounds]);

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

    // Update preview constant and cursor position (unless panning)
    if (!isPanning) {
      const complex = getComplexCoords(coords.x, coords.y);
      setHeatmapPreviewConstant(complex);
      setCursorPosition({
        x: coords.x,
        y: coords.y,
        real: complex.real,
        imag: complex.imag,
      });
    }

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
  }, [isDragging, dragStart, isPanning, panStart, getCanvasCoords, getComplexCoords, setSelection, setHeatmapPreviewConstant, setCursorPosition, viewBounds, setViewBounds]);

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
    const coords = getCanvasCoords(e);
    const complex = getComplexCoords(coords.x, coords.y);

    // Switch to full Julia view
    switchToJulia(complex);
  }, [getCanvasCoords, getComplexCoords, switchToJulia]);

  const handleMouseLeave = useCallback(() => {
    setCursorPosition(null);
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
  }, [isDragging, isPanning, panStartBounds, setSelection, setCursorPosition, setViewBounds]);

  // Clear suggestions when view bounds or equation change
  useEffect(() => {
    clearSuggestions();
  }, [viewBounds, equationId, clearSuggestions]);

  // Handle spacebar for quick save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input field
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }
      if (e.code === 'Space' && heatmapPreviewConstant) {
        e.preventDefault();
        // Set the julia constant to the preview constant, then save
        // Small delay to ensure thumbnail canvas has rendered
        setJuliaConstant(heatmapPreviewConstant);
        setTimeout(() => {
          saveCurrentJulia();
        }, 50);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [heatmapPreviewConstant, saveCurrentJulia, setJuliaConstant]);

  return (
    <div ref={containerRef} className="w-full h-full relative">
      <canvas
        key={canvasKey}
        ref={canvasRef}
        className={`absolute inset-0 ${isPanning ? 'cursor-grabbing' : 'cursor-crosshair'}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onWheel={handleWheel}
        onContextMenu={handleContextMenu}
        onDoubleClick={handleDoubleClick}
      />
      {selection && <SelectionOverlay selection={selection} />}

      {/* AI Suggestion markers */}
      {showSuggestionsPanel && suggestions.map((suggestion) => (
        <SuggestionMarker
          key={suggestion.id}
          suggestion={suggestion}
          screenCoords={getScreenCoords(suggestion.point)}
          isHighlighted={highlightedSuggestion === suggestion.id}
        />
      ))}

      {/* AI Suggestions Panel */}
      <SuggestionsPanel />

      {/* WebGL unavailable overlay */}
      {webglUnavailable && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-20">
          <div className="text-center text-white p-6">
            <svg className="w-12 h-12 mx-auto mb-4 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div className="text-lg font-medium mb-2">WebGL Unavailable</div>
            <div className="text-sm text-gray-400 mb-4">
              The GPU context was lost or is unavailable.
            </div>
            <button
              onClick={handleRetryGPU}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium transition-colors"
            >
              Retry GPU
            </button>
          </div>
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

interface SuggestionMarkerProps {
  suggestion: SuggestedPoint;
  screenCoords: { x: number; y: number } | null;
  isHighlighted: boolean;
}

function SuggestionMarker({ suggestion, screenCoords, isHighlighted }: SuggestionMarkerProps) {
  if (!screenCoords) return null;

  const color = getCategoryColor(suggestion.category);
  const size = isHighlighted ? 16 : 12;
  const pulseClass = isHighlighted ? 'animate-pulse' : '';

  return (
    <div
      className={`absolute pointer-events-none transform -translate-x-1/2 -translate-y-1/2 ${pulseClass}`}
      style={{
        left: screenCoords.x,
        top: screenCoords.y,
        zIndex: isHighlighted ? 5 : 4,
      }}
    >
      {/* Outer ring */}
      <div
        className="absolute rounded-full transform -translate-x-1/2 -translate-y-1/2"
        style={{
          width: size + 8,
          height: size + 8,
          left: '50%',
          top: '50%',
          border: `2px solid ${color}`,
          opacity: isHighlighted ? 0.8 : 0.5,
        }}
      />
      {/* Inner dot */}
      <div
        className="rounded-full shadow-lg"
        style={{
          width: size,
          height: size,
          backgroundColor: color,
          boxShadow: isHighlighted ? `0 0 12px ${color}` : `0 0 6px ${color}`,
        }}
      />
      {/* Label for highlighted suggestion */}
      {isHighlighted && (
        <div
          className="absolute left-1/2 transform -translate-x-1/2 whitespace-nowrap px-2 py-1 rounded text-xs font-medium shadow-lg"
          style={{
            top: size + 12,
            backgroundColor: 'rgba(31, 41, 55, 0.95)',
            color: color,
            border: `1px solid ${color}40`,
          }}
        >
          {suggestion.description}
        </div>
      )}
    </div>
  );
}
