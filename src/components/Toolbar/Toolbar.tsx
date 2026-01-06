import { useState, useRef } from 'react';
import { useFractalStore } from '../../store/fractalStore';
import { equations } from '../../lib/equations';
import { JuliaPreview } from '../JuliaPreview/JuliaPreview';
import { SavedPointsList } from '../SavedPointsList/SavedPointsList';
import { ManualPointEntry } from '../ManualPointEntry/ManualPointEntry';
import { exportPoints, importPoints } from '../../db/database';

export function Toolbar() {
  const {
    maxIterations,
    setMaxIterations,
    renderMode,
    goBack,
    goForward,
    resetView,
    fractalType,
    juliaConstant,
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
    setMandelbulbPower,
    setFov,
    setLightingParams,
    resetCamera3D,
    resetLighting,
    setRenderQuality,
    setQualityPreset,
    setRenderQuality2D,
    history,
    historyIndex,
    savedJulias,
    loadSavedJuliasFromDb,
    showSaveIndicator,
    isHighPrecisionActive,
    setShowExportDialog,
  } = useFractalStore();

  const [showManualEntry, setShowManualEntry] = useState(false);
  const [savedJuliasCollapsed, setSavedJuliasCollapsed] = useState(false);
  const [compactView, setCompactView] = useState(false);
  const [sortByRecent, setSortByRecent] = useState(true); // true = recent first, false = alphabetical
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sort saved julias based on current sort preference
  const sortedSavedJulias = [...savedJulias].sort((a, b) => {
    if (sortByRecent) {
      // Recent first (by id, higher = more recent)
      return (b.id ?? 0) - (a.id ?? 0);
    } else {
      // Alphabetical by name
      return a.name.localeCompare(b.name);
    }
  });

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

  const handleExport = async () => {
    const json = await exportPoints();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `julia-sets-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const result = await importPoints(text);
      await loadSavedJuliasFromDb();

      if (result.imported === 0 && result.skipped > 0) {
        alert(`All ${result.skipped} Julia sets were already in your collection.`);
      } else if (result.skipped > 0) {
        alert(`Imported ${result.imported} Julia sets.\n${result.skipped} duplicates were skipped.`);
      } else {
        alert(`Imported ${result.imported} Julia sets successfully.`);
      }
    } catch (err) {
      alert('Failed to import. Please check the file format.');
      console.error(err);
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const currentEquation = equations.find(e => e.id === equationId);

  return (
    <div className="absolute top-4 left-4 flex flex-col gap-2">
      {/* Navigation and mode controls */}
      <div className="bg-gray-900/90 backdrop-blur-sm rounded-lg p-3 shadow-lg border border-gray-700/50">
        <div className="flex items-center gap-2">
          <button
            onClick={() => goBack()}
            disabled={!canGoBack}
            className="p-2 rounded-md bg-gray-800 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title="Go back (previous view)"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <button
            onClick={() => goForward()}
            disabled={!canGoForward}
            className="p-2 rounded-md bg-gray-800 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title="Go forward (next view)"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          <button
            onClick={resetView}
            className="p-2 rounded-md bg-gray-800 hover:bg-gray-700 transition-colors"
            title="Reset to default view"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          </button>

          <div className="w-px h-6 bg-gray-600 mx-1" />

          {/* Mode buttons */}
          <div className="flex gap-1">
            <button
              onClick={switchToMandelbrot}
              className={`px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${
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
              className={`px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${
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
              className={`px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${
                fractalType === 'heatmap'
                  ? 'bg-orange-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
              title="Heat map explorer"
            >
              Heatmap
            </button>
            <button
              onClick={switchToMandelbulb}
              className={`px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${
                fractalType === 'mandelbulb'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
              title="3D Mandelbulb"
            >
              3D
            </button>
          </div>

          <div className="w-px h-6 bg-gray-600 mx-1" />

          {/* Color palette button */}
          <button
            onClick={() => setShowColorSelector(true)}
            className="p-2 rounded-md bg-gray-800 hover:bg-gray-700 transition-colors"
            title="Color palette"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
            </svg>
          </button>

          {/* Export image button */}
          <button
            onClick={() => setShowExportDialog(true)}
            className="p-2 rounded-md bg-gray-800 hover:bg-gray-700 transition-colors"
            title="Export high-resolution image"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </button>

          <div className="w-px h-6 bg-gray-600 mx-1" />

          <div className="flex items-center gap-2">
            <label htmlFor="iterations" className="text-sm text-gray-300 cursor-help" title="Max iterations: Higher values reveal more detail and affect coloring. In 3D, also improves fractal shape accuracy">
              Iter:
            </label>
            <input
              id="iterations"
              type="number"
              min="50"
              max="10000"
              step="50"
              value={maxIterations}
              onChange={handleIterationsChange}
              className="w-20 px-2 py-1 rounded bg-gray-800 border border-gray-600 text-sm focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={() => setMaxIterations(256)}
              className="p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-gray-200 transition-colors"
              title="Reset iterations to 256"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>

          </div>
        </div>
      </div>

      {/* Equation selector - available for Julia and Heatmap modes */}
      {(fractalType === 'julia' || fractalType === 'heatmap') && (
        <div className="bg-gray-900/90 backdrop-blur-sm rounded-lg p-3 shadow-lg border border-gray-700/50">
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
        </div>
      )}

      {/* Zoom slider - available for 2D modes */}
      {fractalType !== 'mandelbulb' && (
        <div className="bg-gray-900/90 backdrop-blur-sm rounded-lg p-3 shadow-lg border border-gray-700/50">
          <div className="flex flex-col gap-3">
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

            {/* Julia-specific: Complex constant display */}
            {fractalType === 'julia' && (
              <div className="text-xs text-gray-400">
                c = {juliaConstant.real.toFixed(4)} {juliaConstant.imag >= 0 ? '+' : ''} {juliaConstant.imag.toFixed(4)}i
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2D Quality controls - only in 2D modes */}
      {(fractalType === 'mandelbrot' || fractalType === 'julia' || fractalType === 'heatmap') && (
        <div className="bg-gray-900/90 backdrop-blur-sm rounded-lg p-3 shadow-lg border border-gray-700/50">
          <div className="text-sm text-gray-300 font-medium mb-2">Quality</div>
          <div className="flex flex-col gap-2">
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
                        ? 'bg-blue-600 text-white'
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
                          ? 'bg-purple-600 text-white'
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
                            ? 'bg-purple-600 text-white'
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
                      className="flex-1 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
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
        </div>
      )}

      {/* 3D Mandelbulb controls */}
      {fractalType === 'mandelbulb' && (
        <div className="bg-gray-900/90 backdrop-blur-sm rounded-lg p-3 shadow-lg border border-gray-700/50">
          <div className="flex flex-col gap-3">
            {/* Power slider */}
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-300 whitespace-nowrap w-14 cursor-help" title="Mandelbulb exponent: Controls the fractal's shape. Power 8 is the classic Mandelbulb">Power:</label>
              <input
                type="range"
                min="2"
                max="16"
                step="0.1"
                value={mandelbulbParams.power}
                onChange={(e) => setMandelbulbPower(parseFloat(e.target.value))}
                className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
              <span className="text-sm text-gray-400 w-8 text-right">{mandelbulbParams.power.toFixed(1)}</span>
            </div>

            {/* FOV slider */}
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-300 whitespace-nowrap w-14 cursor-help" title="Field of View: Lower values zoom in (telephoto), higher values show more (wide angle)">FOV:</label>
              <input
                type="range"
                min="20"
                max="120"
                step="1"
                value={camera3D.fov}
                onChange={(e) => setFov(parseInt(e.target.value))}
                className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
              <span className="text-sm text-gray-400 w-8 text-right">{camera3D.fov}°</span>
            </div>

            {/* Camera reset */}
            <div className="flex items-center justify-between">
              <div className="text-xs text-gray-400">
                Distance: {camera3D.distance.toFixed(1)}
              </div>
              <button
                onClick={resetCamera3D}
                className="px-2 py-1 rounded text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors"
                title="Reset camera position"
              >
                Reset Camera
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lighting controls - only in 3D mode */}
      {fractalType === 'mandelbulb' && (
        <div className="bg-gray-900/90 backdrop-blur-sm rounded-lg p-3 shadow-lg border border-gray-700/50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-300 font-medium">Lighting</span>
            <button
              onClick={resetLighting}
              className="px-2 py-0.5 rounded text-xs bg-gray-800 hover:bg-gray-700 text-gray-400 transition-colors"
              title="Reset lighting"
            >
              Reset
            </button>
          </div>
          <div className="flex flex-col gap-2">
            {/* Ambient */}
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-400 w-16 cursor-help" title="Ambient light: Base illumination that affects all surfaces equally, even in shadow">Ambient:</label>
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
            </div>

            {/* Diffuse */}
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-400 w-16 cursor-help" title="Diffuse light: Soft, matte lighting that depends on surface angle to the light source">Diffuse:</label>
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
            </div>

            {/* Specular */}
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-400 w-16 cursor-help" title="Specular highlight: Bright reflections that create a shiny appearance">Specular:</label>
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
            </div>

            {/* Shininess */}
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-400 w-16 cursor-help" title="Shininess: Controls how tight the specular highlights are. Higher = smaller, sharper reflections">Shiny:</label>
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
            </div>

            {/* Light Direction */}
            <div className="border-t border-gray-700 pt-2 mt-1">
              <div className="text-xs text-gray-400 mb-1 cursor-help" title="Controls the position of the light source">Light Direction</div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-500 w-8 cursor-help" title="Horizontal angle: Rotates light around the fractal">H:</label>
                <input
                  type="range"
                  min="-3.14"
                  max="3.14"
                  step="0.05"
                  value={lightingParams.lightAngleX}
                  onChange={(e) => setLightingParams({ lightAngleX: parseFloat(e.target.value) })}
                  className="flex-1 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
                <label className="text-xs text-gray-500 w-6 ml-2 cursor-help" title="Vertical angle: Raises or lowers the light source">V:</label>
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
        <div className="bg-gray-900/90 backdrop-blur-sm rounded-lg p-3 shadow-lg border border-gray-700/50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-300 font-medium">Quality</span>
          </div>

          {/* Quality presets */}
          <div className="flex gap-1 mb-3">
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

          <div className="flex flex-col gap-2">
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
                min="0.3"
                max="1.0"
                step="0.05"
                value={renderQuality.detailLevel}
                onChange={(e) => setRenderQuality({ detailLevel: parseFloat(e.target.value) })}
                className="flex-1 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
              <span className="text-xs text-gray-500 w-10 text-right">{renderQuality.detailLevel < 0.5 ? 'High' : renderQuality.detailLevel < 0.8 ? 'Med' : 'Low'}</span>
            </div>
          </div>
        </div>
      )}

      {/* Saved Julia sets - only in Julia mode */}
      {fractalType === 'julia' && (
        <div className="bg-gray-900/90 backdrop-blur-sm rounded-lg shadow-lg border border-gray-700/50">
          {/* Header - always visible */}
          <div className="flex items-center justify-between p-2">
            <button
              onClick={() => setSavedJuliasCollapsed(!savedJuliasCollapsed)}
              className="flex items-center gap-1 text-xs text-gray-300 font-medium hover:text-gray-100"
            >
              <svg
                className={`w-3 h-3 transition-transform ${savedJuliasCollapsed ? '' : 'rotate-90'}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              Saved Julia Sets ({savedJulias.length})
            </button>
            <div className="flex gap-1">
              {!savedJuliasCollapsed && (
                <>
                  <button
                    onClick={() => setSortByRecent(!sortByRecent)}
                    className="p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-gray-200 transition-colors"
                    title={sortByRecent ? 'Sorted by recent - click for alphabetical' : 'Sorted alphabetically - click for recent'}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      {sortByRecent ? (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                      )}
                    </svg>
                  </button>
                  <button
                    onClick={() => setCompactView(!compactView)}
                    className={`p-1 rounded hover:bg-gray-700 transition-colors ${compactView ? 'text-purple-400' : 'text-gray-400 hover:text-gray-200'}`}
                    title={compactView ? 'Switch to detailed view' : 'Switch to compact view'}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      {compactView ? (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                      ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                      )}
                    </svg>
                  </button>
                </>
              )}
              <button
                onClick={() => setShowManualEntry(true)}
                className="p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-gray-200"
                title="Add point manually"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-gray-200"
                title="Import Julia Sets"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
              </button>
              <button
                onClick={handleExport}
                className="p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-gray-200"
                title="Export Saved Julia Sets"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </button>
            </div>
          </div>
          {/* Collapsible content */}
          {!savedJuliasCollapsed && (
            <div className={`px-2 pb-2 overflow-y-auto ${compactView ? 'max-h-52' : 'max-h-48'}`}>
              <SavedPointsList compact={compactView} sortedJulias={sortedSavedJulias} />
            </div>
          )}
        </div>
      )}

      {/* Julia preview - only in heatmap mode */}
      {fractalType === 'heatmap' && <JuliaPreview />}

      {/* Usage hints and mode info */}
      <div className="bg-gray-900/90 backdrop-blur-sm rounded-lg px-3 py-2 shadow-lg border border-gray-700/50">
        <div className="text-xs text-gray-400 space-y-1">
          {fractalType === 'mandelbulb' ? (
            <>
              <div>Drag to rotate the view</div>
              <div>Scroll wheel to zoom in/out</div>
              <div>Adjust power slider for different shapes</div>
            </>
          ) : (
            <>
              <div>Left-drag to select zoom area</div>
              <div>Right-drag to pan</div>
              <div>Scroll wheel to zoom at cursor</div>
              {fractalType === 'mandelbrot' && (
                <div>Double-click to view Julia set at point</div>
              )}
              {fractalType === 'julia' && (
                <div>Press Space to save current Julia</div>
              )}
              {fractalType === 'heatmap' && (
                <>
                  <div>Move cursor to preview Julia sets</div>
                  <div>Double-click to open full Julia view</div>
                  <div>Press Space to save current Julia</div>
                </>
              )}
            </>
          )}
          <div className="pt-1 border-t border-gray-700 mt-1">
            Renderer: <span className="text-gray-300">
              {isHighPrecisionActive ? 'Canvas 2D (High Precision)' : (renderMode === 'webgl' ? 'WebGL 2.0' : 'Canvas 2D')}
            </span>
          </div>
        </div>
      </div>

      {/* Hidden file input for import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleImport}
        className="hidden"
      />

      {/* Manual point entry modal */}
      <ManualPointEntry
        isOpen={showManualEntry}
        onClose={() => setShowManualEntry(false)}
      />

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
