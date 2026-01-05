import { useRef, useEffect, useCallback, useState, useLayoutEffect, useMemo } from 'react';
import { useFractalStore } from '../../store/fractalStore';
import { WebGLRenderer } from '../../webgl/renderer';
import { PRESET_PALETTES, generateShaderPalette, applyTemperatureToPalette } from '../../lib/colors';
import type { SelectionRect, Complex } from '../../types';

export function HeatmapExplorer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<WebGLRenderer | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [contextLost, setContextLost] = useState(false);
  const [renderKey, setRenderKey] = useState(0);

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

    rendererRef.current = new WebGLRenderer(canvas);

    // Set up context loss/restoration callbacks
    rendererRef.current.setContextLostCallback(() => {
      console.warn('HeatmapExplorer: WebGL context lost');
      setContextLost(true);
    });

    rendererRef.current.setContextRestoredCallback(() => {
      console.log('HeatmapExplorer: WebGL context restored');
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
  }, []);

  // Render heatmap
  useEffect(() => {
    if (rendererRef.current && canvasSize.width > 0 && canvasSize.height > 0 && !contextLost) {
      rendererRef.current.setFractalType('heatmap');
      rendererRef.current.setPalette(shaderPalette);
      rendererRef.current.render(viewBounds, maxIterations, 0, undefined, equationId, renderQuality2D.antiAlias);
    }
  }, [viewBounds, maxIterations, equationId, canvasSize, shaderPalette, renderQuality2D, contextLost, renderKey]);

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
