import { useCallback, useRef, useEffect } from 'react';
import { useFractalStore } from '../../store/fractalStore';
import { equations } from '../../lib/equations';
import { getEquation3D } from '../../lib/equations3d';
import { JuliaPreview } from '../JuliaPreview/JuliaPreview';
import { AnimationPanel } from '../AnimationPanel';

export function Toolbar() {
  const {
    maxIterations,
    setMaxIterations,
    renderMode,
    goBack,
    goForward,
    fractalType,
    juliaConstant,
    resetJuliaConstant,
    equationId,
    juliaZoomFactor,
    setJuliaZoomFactor,
    setShowEquationSelector,
    setShowColorSelector,
    switchToMandelbrot,
    switchToJulia,
    switchToHeatmap,
    switchToMandelbulb,
    camera3D,
    mandelbulbParams,
    lightingParams,
    renderQuality,
    renderQuality2D,
    equation3dId,
    setShowEquation3DSelector,
    setMandelbulbPower,
    setFov,
    setCamera3D,
    setLightingParams,
    resetCamera3D,
    resetLighting,
    setRenderQuality,
    setQualityPreset,
    setRenderQuality2D,
    history,
    historyIndex,
    savedJulias,
    showSaveIndicator,
    isHighPrecisionActive,
    setShowExportDialog,
    // UI collapsed states (persisted)
    toolbarCollapsed,
    setToolbarCollapsed,
    toolbarWidth,
    setToolbarWidth,
    qualityCollapsed,
    setQualityCollapsed,
    infoCollapsed,
    setInfoCollapsed,
    // Saved items dialogs
    setShowSavedJuliasDialog,
    savedAnimations,
    setShowSavedAnimationsDialog,
    // Help dialog
    setShowHelpDialog,
    // URL Sharing
    shareCurrentView,
  } = useFractalStore();

  // Compute these from state directly so component re-renders when they change
  const canGoBack = historyIndex > 0;
  const canGoForward = historyIndex < history.length - 1;

  const handleIterationsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value) && value > 0 && value <= 10000) {
      setMaxIterations(value);
    }
  };

  // Logarithmic slider conversion functions
  // Maps slider position (0-100) to zoom factor (0.1-1000) exponentially
  const MIN_ZOOM = 0.1;
  const MAX_ZOOM = 1000;
  const LOG_RATIO = Math.log(MAX_ZOOM / MIN_ZOOM);

  const sliderToZoom = (sliderValue: number): number => {
    // sliderValue is 0-100, convert to 0-1 then apply exponential
    const normalized = sliderValue / 100;
    return MIN_ZOOM * Math.exp(normalized * LOG_RATIO);
  };

  const zoomToSlider = (zoomValue: number): number => {
    // Convert zoom factor to slider position 0-100
    const clamped = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoomValue));
    return (Math.log(clamped / MIN_ZOOM) / LOG_RATIO) * 100;
  };

  const handleZoomFactorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const sliderValue = parseFloat(e.target.value);
    if (!isNaN(sliderValue)) {
      const zoomValue = sliderToZoom(sliderValue);
      setJuliaZoomFactor(zoomValue, false); // Preview without saving to history
    }
  };

  const handleZoomFactorCommit = () => {
    setJuliaZoomFactor(juliaZoomFactor, true); // Commit to history on release
  };

  // Resize handle logic
  const isResizing = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  const handleResizeStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    isResizing.current = true;
    startX.current = 'touches' in e ? e.touches[0].clientX : e.clientX;
    startWidth.current = toolbarWidth;
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
  }, [toolbarWidth]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent | TouchEvent) => {
      if (!isResizing.current) return;
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const delta = clientX - startX.current;
      setToolbarWidth(startWidth.current + delta);
    };

    const handleMouseUp = () => {
      if (isResizing.current) {
        isResizing.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('touchmove', handleMouseMove);
    document.addEventListener('touchend', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchmove', handleMouseMove);
      document.removeEventListener('touchend', handleMouseUp);
    };
  }, [setToolbarWidth]);

  const currentEquation = equations.find(e => e.id === equationId);

  // Collapsed toolbar - show expand button and Julia Preview in heatmap mode
  if (toolbarCollapsed) {
    return (
      <div className="absolute top-2 left-2 lg:top-4 lg:left-4 touch-manipulation flex flex-col gap-1.5 lg:gap-2">
        <button
          onClick={() => setToolbarCollapsed(false)}
          className="bg-gray-900/90 backdrop-blur-sm rounded-lg p-2 lg:p-3 shadow-lg border border-gray-700/50 hover:bg-gray-800 transition-colors"
          title="Show toolbar"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        {/* Show Julia Preview even when collapsed in heatmap mode - compact size */}
        {fractalType === 'heatmap' && (
          <div className="w-44 lg:w-64 [&>div]:min-w-0">
            <JuliaPreview />
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className="absolute top-2 left-2 lg:top-4 lg:left-4"
      style={{ width: `${toolbarWidth}px` }}
    >
      {/* Resize handle on right edge */}
      <div
        className="absolute top-0 right-0 w-2 h-full cursor-ew-resize hover:bg-blue-500/50 active:bg-blue-500/70 transition-colors z-20 rounded-r"
        onMouseDown={handleResizeStart}
        onTouchStart={handleResizeStart}
        title="Drag to resize toolbar"
      />
      {/* Scrollable toolbar content */}
      <div className="flex flex-col gap-1.5 lg:gap-2 touch-manipulation max-h-[calc(100vh-1rem)] lg:max-h-[calc(100vh-2rem)] overflow-y-auto overscroll-contain toolbar-scroll">
      {/* Navigation and mode controls */}
      <div className="bg-gray-900/90 backdrop-blur-sm rounded-lg p-1.5 lg:p-2 shadow-lg border border-gray-700/50">
        {/* Row 1: Navigation and utility buttons */}
        <div className="flex items-center justify-between gap-1 mb-1.5">
          <div className="flex items-center gap-1">
            {/* Collapse toolbar button */}
            <button
              onClick={() => setToolbarCollapsed(true)}
              className="p-1.5 rounded-md bg-gray-800 hover:bg-gray-700 transition-colors"
              title="Hide toolbar"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              </svg>
            </button>

            <div className="w-px h-5 bg-gray-600" />

            <button
              onClick={() => goBack()}
              disabled={!canGoBack}
              className="p-1.5 rounded-md bg-gray-800 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="Go back (previous view)"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <button
              onClick={() => goForward()}
              disabled={!canGoForward}
              className="p-1.5 rounded-md bg-gray-800 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="Go forward (next view)"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          <div className="flex items-center gap-1">
            {/* Color palette button */}
            <button
              onClick={() => setShowColorSelector(true)}
              className="p-1.5 rounded-md bg-gray-800 hover:bg-gray-700 transition-colors"
              title="Color palette"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
              </svg>
            </button>

            {/* Export image button */}
            <button
              onClick={() => setShowExportDialog(true)}
              className="p-1.5 rounded-md bg-gray-800 hover:bg-gray-700 transition-colors"
              title="Export high-resolution image"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>

            {/* Share button */}
            <button
              onClick={() => shareCurrentView()}
              className="p-1.5 rounded-md bg-gray-800 hover:bg-gray-700 transition-colors"
              title="Share current view (copy link)"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
            </button>

            {/* Help button */}
            <button
              onClick={() => setShowHelpDialog(true)}
              className="p-1.5 rounded-md bg-gray-800 hover:bg-gray-700 transition-colors"
              title="Help"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Row 2: Mode buttons - full width */}
        <div className="flex gap-1">
          <button
            onClick={switchToMandelbrot}
            className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors ${
              fractalType === 'mandelbrot'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
            title="Mandelbrot set"
          >
            Mandel
          </button>
          <button
            onClick={() => switchToJulia(juliaConstant)}
            className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors ${
              fractalType === 'julia'
                ? 'bg-purple-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
            title="Julia set"
          >
            Julia
          </button>
          <button
            onClick={switchToHeatmap}
            className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors ${
              fractalType === 'heatmap'
                ? 'bg-orange-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
            title="Heat map explorer"
          >
            Heat
          </button>
          <button
            onClick={switchToMandelbulb}
            className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors ${
              fractalType === 'mandelbulb'
                ? 'bg-emerald-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
            title="3D Mandelbulb"
          >
            3D
          </button>
        </div>
      </div>

      {/* Julia Preview - in heatmap mode, matches other toolbar sections */}
      {fractalType === 'heatmap' && <JuliaPreview />}

      {/* Equation selector - available for Julia and Heatmap modes */}
      {(fractalType === 'julia' || fractalType === 'heatmap') && (
        <div className="bg-gray-900/90 backdrop-blur-sm rounded-lg p-2 lg:p-3 shadow-lg border border-gray-700/50">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowEquationSelector(true)}
                className="flex-1 px-3 py-2 rounded-md bg-gray-800 hover:bg-gray-700 text-sm font-medium transition-colors text-left"
                title="Select equation"
              >
                <span className="text-gray-400 text-xs">Eq #{equationId}:</span>{' '}
                <span className="text-gray-200">{currentEquation?.label}</span>
              </button>
            </div>
            {/* Julia constant display */}
            {fractalType === 'julia' && (() => {
              const isCustomC = juliaConstant.real !== -0.7 || juliaConstant.imag !== 0.27015;
              return (
                <div className="flex items-center justify-between">
                  <div className={`text-xs ${isCustomC ? 'text-purple-400' : 'text-gray-400'}`}>
                    c = {juliaConstant.real.toFixed(4)} {juliaConstant.imag >= 0 ? '+' : ''} {juliaConstant.imag.toFixed(4)}i
                    {isCustomC && <span className="text-purple-500 ml-1">(custom)</span>}
                  </div>
                  <button
                    onClick={resetJuliaConstant}
                    className={`p-1 rounded hover:bg-gray-700 transition-colors ${
                      isCustomC ? 'text-purple-400 hover:text-purple-300' : 'text-gray-400 hover:text-gray-200'
                    }`}
                    title="Reset to default c = -0.7 + 0.27015i"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Zoom slider - available for 2D modes */}
      {fractalType !== 'mandelbulb' && (
        <div className="bg-gray-900/90 backdrop-blur-sm rounded-lg p-2 lg:p-3 shadow-lg border border-gray-700/50">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-300 whitespace-nowrap">Zoom:</label>
            <input
              type="range"
              min="0"
              max="100"
              step="0.1"
              value={zoomToSlider(juliaZoomFactor)}
              onChange={handleZoomFactorChange}
              onMouseUp={handleZoomFactorCommit}
              onTouchEnd={handleZoomFactorCommit}
              className={`flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer ${
                fractalType === 'julia' ? 'accent-purple-500' : fractalType === 'heatmap' ? 'accent-orange-500' : 'accent-blue-500'
              }`}
            />
            <span className="text-sm text-gray-400 w-12 text-right">{juliaZoomFactor < 10 ? juliaZoomFactor.toFixed(1) : Math.round(juliaZoomFactor)}x</span>
            <button
              onClick={() => setJuliaZoomFactor(1.0, true)}
              className="p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-gray-200 transition-colors"
              title="Reset zoom to 1.0x"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Animation Panel - for 2D modes (above Quality) */}
      {(fractalType === 'mandelbrot' || fractalType === 'julia') && (
        <AnimationPanel />
      )}

      {/* Saved Items - Julias and Animations */}
      {(fractalType === 'mandelbrot' || fractalType === 'julia') && (
        <div className="bg-gray-900/90 backdrop-blur-sm rounded-lg shadow-lg border border-gray-700/50 p-1.5">
          <div className="flex gap-1.5">
            {/* Saved Julias - only in Julia mode */}
            {fractalType === 'julia' && (
              <button
                onClick={() => setShowSavedJuliasDialog(true)}
                className={`flex-1 flex items-center justify-between p-1.5 hover:bg-gray-800/50 rounded transition-colors ${
                  savedJulias.length === 0 ? 'opacity-60' : ''
                }`}
                title="Manage saved Julias"
              >
                <div className="flex items-center gap-1.5 text-xs text-gray-300">
                  <svg className="w-3.5 h-3.5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                  Julias
                </div>
                <span className="text-[10px] text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded-full">
                  {savedJulias.length}
                </span>
              </button>
            )}
            {/* Saved Animations */}
            <button
              onClick={() => setShowSavedAnimationsDialog(true)}
              className={`flex-1 flex items-center justify-between p-1.5 hover:bg-gray-800/50 rounded transition-colors ${
                savedAnimations.length === 0 ? 'opacity-60' : ''
              }`}
              title="Manage saved animations"
            >
              <div className="flex items-center gap-1.5 text-xs text-gray-300">
                <svg className={`w-3.5 h-3.5 ${fractalType === 'julia' ? 'text-purple-400' : 'text-blue-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
                </svg>
                Animations
              </div>
              <span className="text-[10px] text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded-full">
                {savedAnimations.length}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* 2D Quality controls - only in 2D modes */}
      {(fractalType === 'mandelbrot' || fractalType === 'julia' || fractalType === 'heatmap') && (
        <div className="bg-gray-900/90 backdrop-blur-sm rounded-lg shadow-lg border border-gray-700/50">
          {/* Collapsible header */}
          <button
            onClick={() => setQualityCollapsed(!qualityCollapsed)}
            className="w-full flex items-center justify-between p-2 hover:bg-gray-800/50 rounded-lg transition-colors"
          >
            <div className="flex items-center gap-1 text-sm text-gray-300 font-medium">
              <svg
                className={`w-3 h-3 transition-transform ${qualityCollapsed ? '' : 'rotate-90'}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              Quality
            </div>
            <span className="text-xs text-gray-500">
              {maxIterations} · AA: {renderQuality2D.antiAlias === 1 ? 'Off' : `${renderQuality2D.antiAlias * renderQuality2D.antiAlias}x`}
              {(fractalType === 'mandelbrot' || fractalType === 'julia') && `/${renderQuality2D.antiAliasCPU === 1 ? 'Off' : `${renderQuality2D.antiAliasCPU * renderQuality2D.antiAliasCPU}x`}`}
              {(fractalType === 'mandelbrot' || fractalType === 'julia') && ` · ${
                renderQuality2D.precisionMode === 'auto'
                  ? `Auto (${renderQuality2D.precisionSwitchZoom >= 1000 ? `${Math.round(renderQuality2D.precisionSwitchZoom / 1000)}k` : renderQuality2D.precisionSwitchZoom}x)`
                  : renderQuality2D.precisionMode === 'high' ? 'Hi-Prec' : 'Std'
              }`}
            </span>
          </button>
          {/* Collapsible content */}
          {!qualityCollapsed && (
            <div className="px-3 pb-3 flex flex-col gap-2">
              {/* Iterations */}
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-400 w-20 cursor-help" title="Max iterations: Higher values reveal more detail and affect coloring">Iterations:</label>
                <input
                  type="number"
                  min="50"
                  max="10000"
                  step="50"
                  value={maxIterations}
                  onChange={handleIterationsChange}
                  className="w-16 px-2 py-1 rounded bg-gray-800 border border-gray-600 text-xs focus:outline-none focus:border-blue-500"
                />
                <button
                  onClick={() => setMaxIterations(256)}
                  className="p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-gray-200 transition-colors"
                  title="Reset iterations to 256"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              </div>
              {/* GPU Anti-aliasing */}
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-400 w-20 cursor-help" title="GPU Anti-aliasing: Smooths jagged edges by sampling multiple points per pixel. Higher = smoother but slower">AA (GPU):</label>
                <div className="flex gap-1">
                  {[
                    { value: 1, label: 'Off' },
                    { value: 2, label: '4x' },
                    { value: 3, label: '9x' },
                    { value: 4, label: '16x' },
                  ].map(({ value, label }) => (
                    <button
                      key={value}
                      onClick={() => setRenderQuality2D({ antiAlias: value })}
                      className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                        renderQuality2D.antiAlias === value
                          ? fractalType === 'julia' ? 'bg-purple-600 text-white'
                            : fractalType === 'heatmap' ? 'bg-orange-600 text-white'
                            : 'bg-blue-600 text-white'
                          : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              {/* CPU Anti-aliasing - only for Mandelbrot and Julia */}
              {(fractalType === 'mandelbrot' || fractalType === 'julia') && (
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-400 w-20 cursor-help" title="CPU Anti-aliasing: Used in high precision mode. Higher values significantly increase render time">AA (CPU):</label>
                  <div className="flex gap-1">
                    {[
                      { value: 1, label: 'Off' },
                      { value: 2, label: '4x' },
                      { value: 3, label: '9x' },
                    ].map(({ value, label }) => (
                      <button
                        key={value}
                        onClick={() => setRenderQuality2D({ antiAliasCPU: value })}
                        className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                          renderQuality2D.antiAliasCPU === value
                            ? fractalType === 'julia' ? 'bg-purple-600 text-white' : 'bg-blue-600 text-white'
                            : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {/* Precision mode - only for Mandelbrot and Julia */}
              {(fractalType === 'mandelbrot' || fractalType === 'julia') && (
                <>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-400 w-20 cursor-help" title="Rendering mode: Std = GPU (fast, limited zoom depth), High = CPU (slower, unlimited zoom depth), Auto = GPU at low zoom, switches to CPU at deep zoom">Precision:</label>
                    <div className="flex gap-1">
                      {[
                        { value: 'auto', label: 'Auto' },
                        { value: 'standard', label: 'Std' },
                        { value: 'high', label: 'High' },
                      ].map(({ value, label }) => (
                        <button
                          key={value}
                          onClick={() => setRenderQuality2D({ precisionMode: value as 'auto' | 'standard' | 'high' })}
                          className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                            renderQuality2D.precisionMode === value
                              ? fractalType === 'julia' ? 'bg-purple-600 text-white' : 'bg-blue-600 text-white'
                              : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* Auto switch threshold slider - only shown in auto mode */}
                  {renderQuality2D.precisionMode === 'auto' && (
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-gray-400 w-20 cursor-help" title="Auto mode threshold: The zoom level at which Auto switches from GPU to CPU. Lower = earlier switch (better quality), Higher = later switch (faster, may show artifacts before switching)">Switch at:</label>
                      <input
                        type="range"
                        min="0"
                        max="4"
                        step="1"
                        value={[12500, 30000, 50000, 100000, 200000].indexOf(renderQuality2D.precisionSwitchZoom)}
                        onChange={(e) => {
                          const zoomLevels = [12500, 30000, 50000, 100000, 200000];
                          setRenderQuality2D({ precisionSwitchZoom: zoomLevels[parseInt(e.target.value)] });
                        }}
                        className={`flex-1 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer ${
                          fractalType === 'julia' ? 'accent-purple-500' : 'accent-blue-500'
                        }`}
                      />
                      <span className="text-xs text-gray-400 w-12 text-right">
                        {renderQuality2D.precisionSwitchZoom >= 1000
                          ? `${(renderQuality2D.precisionSwitchZoom / 1000).toFixed(0)}k`
                          : renderQuality2D.precisionSwitchZoom}x
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* 3D Fractal Equation Selector */}
      {fractalType === 'mandelbulb' && (() => {
        const currentEquation3d = getEquation3D(equation3dId);
        return (
          <div className="bg-gray-900/90 backdrop-blur-sm rounded-lg p-2 lg:p-3 shadow-lg border border-gray-700/50">
            <div className="flex flex-col gap-2">
              {/* Equation selector button */}
              <button
                onClick={() => setShowEquation3DSelector(true)}
                className="w-full px-3 py-2 rounded-md bg-gray-800 hover:bg-gray-700 text-sm font-medium transition-colors text-left"
                title="Select 3D fractal equation"
              >
                <span className="text-gray-400 text-xs">Eq #{equation3dId}:</span>{' '}
                <span className="text-gray-200">{currentEquation3d?.label}</span>
              </button>
            </div>
          </div>
        );
      })()}

      {/* 3D Mandelbulb controls */}
      {fractalType === 'mandelbulb' && (() => {
        const currentEquation3d = getEquation3D(equation3dId);
        return (
        <div className="bg-gray-900/90 backdrop-blur-sm rounded-lg p-2 lg:p-3 shadow-lg border border-gray-700/50">
          <div className="flex flex-col gap-2">
            {/* Power slider - only for equations with hasPower */}
            {currentEquation3d?.hasPower && (() => {
              // Use different range for low-power fractals (Burning Ship, Tricorn)
              const isLowPowerFractal = (currentEquation3d.defaultPower ?? 8) <= 2;
              const minPower = isLowPowerFractal ? 1.5 : 2;
              const maxPower = isLowPowerFractal ? 6 : 16;
              return (
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-400 w-12 cursor-help" title="Power exponent: Controls the fractal's shape. Higher values create more complex structures">Power:</label>
              <input
                type="range"
                min={minPower}
                max={maxPower}
                step="0.1"
                value={mandelbulbParams.power}
                onChange={(e) => setMandelbulbPower(parseFloat(e.target.value))}
                className="flex-1 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
              <span className="text-xs text-gray-400 w-8 text-right">{mandelbulbParams.power.toFixed(1)}</span>
              <button
                onClick={() => setMandelbulbPower(currentEquation3d.defaultPower ?? 8)}
                className="p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-gray-200 transition-colors"
                title={`Reset power to ${currentEquation3d.defaultPower ?? 8}`}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>
              );
            })()}

            {/* Scale slider - only for equations with hasScale (Mandelbox, Kaleidoscopic, IFS) */}
            {currentEquation3d?.hasScale && (() => {
              // IFS fractals work best in positive scale range, Mandelbox works with -3 to 3
              const isPositiveScaleOnly = equation3dId === 8 || equation3dId === 9 || equation3dId === 10;
              const minScale = isPositiveScaleOnly ? 1.0 : -3.0;
              const maxScale = 3.0;
              return (
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-400 w-12 cursor-help" title="Scale factor: Controls the self-similarity ratio of the fractal">Scale:</label>
              <input
                type="range"
                min={minScale}
                max={maxScale}
                step="0.05"
                value={mandelbulbParams.scale ?? 2.0}
                onChange={(e) => {
                  useFractalStore.setState({ mandelbulbParams: { ...mandelbulbParams, scale: parseFloat(e.target.value) } });
                }}
                className="flex-1 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
              <span className="text-xs text-gray-400 w-8 text-right">{(mandelbulbParams.scale ?? 2.0).toFixed(2)}</span>
              <button
                onClick={() => {
                  useFractalStore.setState({ mandelbulbParams: { ...mandelbulbParams, scale: currentEquation3d.defaultScale ?? 2.0 } });
                }}
                className="p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-gray-200 transition-colors"
                title={`Reset scale to ${currentEquation3d.defaultScale ?? 2.0}`}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>
              );
            })()}

            {/* Distance slider */}
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-400 w-12 cursor-help" title="Camera distance: Move closer or farther from the fractal">Dist:</label>
              <input
                type="range"
                min="1.2"
                max="5"
                step="0.1"
                value={camera3D.distance}
                onChange={(e) => setCamera3D({ distance: parseFloat(e.target.value) })}
                className="flex-1 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
              <span className="text-xs text-gray-400 w-8 text-right">{camera3D.distance.toFixed(1)}</span>
              <button
                onClick={() => setCamera3D({ distance: 4.0 })}
                className="p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-gray-200 transition-colors"
                title="Reset distance to default"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>

            {/* FOV slider */}
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-400 w-12 cursor-help" title="Field of View: Lower values zoom in (telephoto), higher values show more (wide angle)">FOV:</label>
              <input
                type="range"
                min="20"
                max="120"
                step="1"
                value={camera3D.fov}
                onChange={(e) => setFov(parseInt(e.target.value))}
                className="flex-1 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
              <span className="text-xs text-gray-400 w-8 text-right">{camera3D.fov}°</span>
              <button
                onClick={() => setFov(60)}
                className="p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-gray-200 transition-colors"
                title="Reset FOV to 60°"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>

            {/* Rotation reset */}
            <div className="flex items-center justify-end pt-1">
              <button
                onClick={resetCamera3D}
                className="px-2 py-1 rounded text-xs bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-gray-200 transition-colors"
                title="Reset camera rotation to default view"
              >
                Reset Rotation
              </button>
            </div>
          </div>
        </div>
        );
      })()}

      {/* Lighting controls - only in 3D mode */}
      {fractalType === 'mandelbulb' && (
        <div className="bg-gray-900/90 backdrop-blur-sm rounded-lg p-2 lg:p-3 shadow-lg border border-gray-700/50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-300 font-medium">Lighting</span>
            <button
              onClick={resetLighting}
              className="px-2 py-0.5 rounded text-xs bg-gray-800 hover:bg-gray-700 text-gray-400 transition-colors"
              title="Reset all lighting settings"
            >
              Reset All
            </button>
          </div>
          <div className="flex flex-col gap-2">
            {/* Ambient */}
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-400 w-14 cursor-help" title="Ambient light: Base illumination that affects all surfaces equally, even in shadow">Ambient:</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={lightingParams.ambient}
                onChange={(e) => setLightingParams({ ambient: parseFloat(e.target.value) })}
                className="flex-1 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
              <span className="text-xs text-gray-500 w-8 text-right">{(lightingParams.ambient * 100).toFixed(0)}%</span>
              <button
                onClick={() => setLightingParams({ ambient: 0.15 })}
                className="p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-gray-200 transition-colors"
                title="Reset ambient to 15%"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>

            {/* Diffuse */}
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-400 w-14 cursor-help" title="Diffuse light: Soft, matte lighting that depends on surface angle to the light source">Diffuse:</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={lightingParams.diffuse}
                onChange={(e) => setLightingParams({ diffuse: parseFloat(e.target.value) })}
                className="flex-1 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
              <span className="text-xs text-gray-500 w-8 text-right">{(lightingParams.diffuse * 100).toFixed(0)}%</span>
              <button
                onClick={() => setLightingParams({ diffuse: 0.8 })}
                className="p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-gray-200 transition-colors"
                title="Reset diffuse to 80%"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>

            {/* Specular */}
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-400 w-14 cursor-help" title="Specular highlight: Bright reflections that create a shiny appearance">Specular:</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={lightingParams.specular}
                onChange={(e) => setLightingParams({ specular: parseFloat(e.target.value) })}
                className="flex-1 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
              <span className="text-xs text-gray-500 w-8 text-right">{(lightingParams.specular * 100).toFixed(0)}%</span>
              <button
                onClick={() => setLightingParams({ specular: 0.5 })}
                className="p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-gray-200 transition-colors"
                title="Reset specular to 50%"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>

            {/* Shininess */}
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-400 w-14 cursor-help" title="Shininess: Controls how tight the specular highlights are. Higher = smaller, sharper reflections">Shiny:</label>
              <input
                type="range"
                min="1"
                max="128"
                step="1"
                value={lightingParams.shininess}
                onChange={(e) => setLightingParams({ shininess: parseFloat(e.target.value) })}
                className="flex-1 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
              <span className="text-xs text-gray-500 w-8 text-right">{lightingParams.shininess.toFixed(0)}</span>
              <button
                onClick={() => setLightingParams({ shininess: 32 })}
                className="p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-gray-200 transition-colors"
                title="Reset shininess to 32"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>

            {/* Light Direction */}
            <div className="border-t border-gray-700 pt-2 mt-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-400 cursor-help" title="Controls the position of the light source">Light Direction</span>
                <button
                  onClick={() => setLightingParams({ lightAngleX: 0.5, lightAngleY: 0.8 })}
                  className="p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-gray-200 transition-colors"
                  title="Reset light direction"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-500 w-6 cursor-help" title="Horizontal angle: Rotates light around the fractal">H:</label>
                <input
                  type="range"
                  min="-3.14"
                  max="3.14"
                  step="0.05"
                  value={lightingParams.lightAngleX}
                  onChange={(e) => setLightingParams({ lightAngleX: parseFloat(e.target.value) })}
                  className="flex-1 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
                <label className="text-xs text-gray-500 w-6 ml-1 cursor-help" title="Vertical angle: Raises or lowers the light source">V:</label>
                <input
                  type="range"
                  min="-1.5"
                  max="1.5"
                  step="0.05"
                  value={lightingParams.lightAngleY}
                  onChange={(e) => setLightingParams({ lightAngleY: parseFloat(e.target.value) })}
                  className="flex-1 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quality controls - only in 3D mode */}
      {fractalType === 'mandelbulb' && (
        <div className="bg-gray-900/90 backdrop-blur-sm rounded-lg shadow-lg border border-gray-700/50">
          {/* Collapsible header */}
          <button
            onClick={() => setQualityCollapsed(!qualityCollapsed)}
            className="w-full flex items-center justify-between p-2 hover:bg-gray-800/50 rounded-lg transition-colors"
          >
            <div className="flex items-center gap-1 text-sm text-gray-300 font-medium">
              <svg
                className={`w-3 h-3 transition-transform ${qualityCollapsed ? '' : 'rotate-90'}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              Quality
            </div>
            <span className="text-xs text-gray-500">
              {maxIterations} · {
                renderQuality.maxSteps === 64 ? 'Low' :
                renderQuality.maxSteps === 256 ? 'Med' :
                renderQuality.maxSteps === 512 ? 'High' :
                renderQuality.maxSteps === 1024 ? 'Ultra' : 'Custom'
              }
            </span>
          </button>
          {/* Collapsible content */}
          {!qualityCollapsed && (
            <div className="px-3 pb-3 flex flex-col gap-2">
              {/* Iterations */}
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-400 w-16 cursor-help" title="Max iterations: Higher values reveal more detail and improve fractal shape accuracy">Iterations:</label>
                <input
                  type="number"
                  min="50"
                  max="10000"
                  step="50"
                  value={maxIterations}
                  onChange={handleIterationsChange}
                  className="w-16 px-2 py-1 rounded bg-gray-800 border border-gray-600 text-xs focus:outline-none focus:border-emerald-500"
                />
                <button
                  onClick={() => setMaxIterations(256)}
                  className="p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-gray-200 transition-colors"
                  title="Reset iterations to 256"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              </div>

              {/* Quality presets */}
              <div className="flex gap-1">
                {(['low', 'medium', 'high', 'ultra'] as const).map((preset) => (
                  <button
                    key={preset}
                    onClick={() => setQualityPreset(preset)}
                    className={`flex-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                      renderQuality.maxSteps === { low: 64, medium: 256, high: 512, ultra: 1024 }[preset]
                        ? 'bg-emerald-600 text-white'
                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                    }`}
                  >
                    {preset.charAt(0).toUpperCase() + preset.slice(1)}
                  </button>
                ))}
              </div>

              {/* Ray Steps */}
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-400 w-16 cursor-help" title="Ray march steps: Higher values find more surface detail but render slower">Steps:</label>
                <input
                  type="range"
                  min="64"
                  max="1024"
                  step="64"
                  value={renderQuality.maxSteps}
                  onChange={(e) => setRenderQuality({ maxSteps: parseInt(e.target.value) })}
                  className="flex-1 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
                <span className="text-xs text-gray-500 w-10 text-right">{renderQuality.maxSteps}</span>
              </div>

              {/* Shadow Steps */}
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-400 w-16 cursor-help" title="Soft shadow quality: More steps = smoother shadows. Set to 0 to disable shadows for better performance">Shadow:</label>
                <input
                  type="range"
                  min="0"
                  max="128"
                  step="8"
                  value={renderQuality.shadowSteps}
                  onChange={(e) => setRenderQuality({ shadowSteps: parseInt(e.target.value) })}
                  className="flex-1 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
                <span className="text-xs text-gray-500 w-10 text-right">{renderQuality.shadowSteps || 'Off'}</span>
              </div>

              {/* AO Samples */}
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-400 w-16 cursor-help" title="Ambient Occlusion: Adds depth by darkening crevices and corners. Set to 0 to disable for better performance">AO:</label>
                <input
                  type="range"
                  min="0"
                  max="12"
                  step="1"
                  value={renderQuality.aoSamples}
                  onChange={(e) => setRenderQuality({ aoSamples: parseInt(e.target.value) })}
                  className="flex-1 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
                <span className="text-xs text-gray-500 w-10 text-right">{renderQuality.aoSamples || 'Off'}</span>
              </div>

              {/* Detail Level */}
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-400 w-16 cursor-help" title="Surface detail: Controls ray step size. 'High' uses smaller steps for finer detail but slower rendering">Detail:</label>
                <input
                  type="range"
                  min="0.1"
                  max="0.5"
                  step="0.02"
                  value={renderQuality.detailLevel}
                  onChange={(e) => setRenderQuality({ detailLevel: parseFloat(e.target.value) })}
                  className="flex-1 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
                <span className="text-xs text-gray-500 w-10 text-right">{renderQuality.detailLevel <= 0.15 ? 'Ultra' : renderQuality.detailLevel <= 0.25 ? 'High' : renderQuality.detailLevel <= 0.35 ? 'Med' : 'Low'}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Usage hints and mode info */}
      <div className="bg-gray-900/90 backdrop-blur-sm rounded-lg shadow-lg border border-gray-700/50">
        {/* Collapsible header */}
        <button
          onClick={() => setInfoCollapsed(!infoCollapsed)}
          className="w-full flex items-center justify-between p-2 hover:bg-gray-800/50 rounded-lg transition-colors"
        >
          <div className="flex items-center gap-1 text-xs text-gray-300 font-medium">
            <svg
              className={`w-3 h-3 transition-transform ${infoCollapsed ? '' : 'rotate-90'}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            Info
          </div>
          <span className="text-xs text-gray-500">
            {isHighPrecisionActive ? 'CPU' : (renderMode === 'webgl' ? 'WebGL' : '2D')}
          </span>
        </button>
        {/* Collapsible content */}
        {!infoCollapsed && (
          <div className="px-3 pb-2 text-xs text-gray-400">
            <div className="grid grid-cols-2 gap-3">
              {/* Mouse column */}
              <div>
                <div className="text-gray-500 font-medium mb-1">Mouse</div>
                {fractalType === 'mandelbulb' ? (
                  <div className="space-y-0.5">
                    <div>Drag to rotate</div>
                    <div>Scroll to zoom</div>
                  </div>
                ) : fractalType === 'heatmap' ? (
                  <div className="space-y-0.5">
                    <div>Move to preview</div>
                    <div>Ctrl to freeze</div>
                    <div>Left-drag to zoom</div>
                    <div>Right-drag to pan</div>
                    <div>Dbl-click to open</div>
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    <div>Left-drag to zoom</div>
                    <div>Right-drag to pan</div>
                    <div>Scroll to zoom</div>
                    {fractalType === 'mandelbrot' && <div>Dbl-click for Julia</div>}
                    {fractalType === 'julia' && <div>+ button to save</div>}
                  </div>
                )}
              </div>
              {/* Touch column */}
              <div>
                <div className="text-gray-500 font-medium mb-1">Touch</div>
                {fractalType === 'mandelbulb' ? (
                  <div className="space-y-0.5">
                    <div>Drag to rotate</div>
                    <div>Pinch to zoom</div>
                  </div>
                ) : fractalType === 'heatmap' ? (
                  <div className="space-y-0.5">
                    <div>1 finger to preview</div>
                    <div>2 fingers pan/zoom</div>
                    <div>Dbl-tap to open</div>
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    <div>Drag to pan</div>
                    <div>Pinch to zoom</div>
                    {fractalType === 'mandelbrot' && <div>Dbl-tap for Julia</div>}
                    {fractalType === 'julia' && <div>+ button to save</div>}
                  </div>
                )}
              </div>
            </div>
            <div className="pt-1 border-t border-gray-700 mt-2">
              Renderer: <span className="text-gray-300">
                {isHighPrecisionActive ? 'CPU' : (renderMode === 'webgl' ? 'WebGL' : '2D')}
              </span>
            </div>
          </div>
        )}
      </div>
      </div>

      {/* Save indicator - fixed position floating notification */}
      {showSaveIndicator && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm animate-pulse z-50">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span>Saved!</span>
        </div>
      )}
    </div>
  );
}
