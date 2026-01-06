import { useEffect, useCallback, useState } from 'react';
import { useFractalStore } from '../../store/fractalStore';
import { estimateFileSize } from '../../lib/imageExporter';
import type { ExportSettings } from '../../types';

type ResolutionPreset = '1080p' | '4k' | '8k' | 'custom';

const RESOLUTION_PRESETS: Record<ResolutionPreset, { width: number; height: number } | null> = {
  '1080p': { width: 1920, height: 1080 },
  '4k': { width: 3840, height: 2160 },
  '8k': { width: 7680, height: 4320 },
  'custom': null,
};

export function ExportDialog() {
  const {
    showExportDialog,
    setShowExportDialog,
    exportSettings,
    setExportSettings,
    isExporting,
    exportProgress,
    startExport,
    cancelExport,
    fractalType,
  } = useFractalStore();

  const [selectedPreset, setSelectedPreset] = useState<ResolutionPreset>(() => {
    // Detect current preset from settings
    for (const [preset, dims] of Object.entries(RESOLUTION_PRESETS)) {
      if (dims && dims.width === exportSettings.width && dims.height === exportSettings.height) {
        return preset as ResolutionPreset;
      }
    }
    return 'custom';
  });

  const [error, setError] = useState<string | null>(null);

  const handleClose = useCallback(() => {
    if (!isExporting) {
      setShowExportDialog(false);
      setError(null);
    }
  }, [isExporting, setShowExportDialog]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' && !isExporting) {
      handleClose();
    }
  }, [handleClose, isExporting]);

  useEffect(() => {
    if (showExportDialog) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [showExportDialog, handleKeyDown]);

  const handlePresetChange = useCallback((preset: ResolutionPreset) => {
    setSelectedPreset(preset);
    const dims = RESOLUTION_PRESETS[preset];
    if (dims) {
      setExportSettings({ width: dims.width, height: dims.height });
    }
  }, [setExportSettings]);

  const handleWidthChange = useCallback((width: number) => {
    if (exportSettings.aspectLocked) {
      const aspect = exportSettings.height / exportSettings.width;
      setExportSettings({ width, height: Math.round(width * aspect) });
    } else {
      setExportSettings({ width });
    }
    setSelectedPreset('custom');
  }, [exportSettings.aspectLocked, exportSettings.width, exportSettings.height, setExportSettings]);

  const handleHeightChange = useCallback((height: number) => {
    if (exportSettings.aspectLocked) {
      const aspect = exportSettings.width / exportSettings.height;
      setExportSettings({ height, width: Math.round(height * aspect) });
    } else {
      setExportSettings({ height });
    }
    setSelectedPreset('custom');
  }, [exportSettings.aspectLocked, exportSettings.width, exportSettings.height, setExportSettings]);

  const handleFormatChange = useCallback((format: ExportSettings['format']) => {
    setExportSettings({ format });
  }, [setExportSettings]);

  const handleQualityChange = useCallback((quality: number) => {
    setExportSettings({ quality });
  }, [setExportSettings]);

  const handleAspectLockToggle = useCallback(() => {
    setExportSettings({ aspectLocked: !exportSettings.aspectLocked });
  }, [exportSettings.aspectLocked, setExportSettings]);

  const handleExport = useCallback(async () => {
    setError(null);
    try {
      await startExport();
      setShowExportDialog(false);
    } catch (e) {
      if (e instanceof Error && e.name !== 'AbortError') {
        setError(e.message);
      }
    }
  }, [startExport, setShowExportDialog]);

  const handleCancel = useCallback(() => {
    if (isExporting) {
      cancelExport();
    } else {
      handleClose();
    }
  }, [isExporting, cancelExport, handleClose]);

  if (!showExportDialog) return null;

  const estimatedSize = estimateFileSize(
    exportSettings.width,
    exportSettings.height,
    exportSettings.format,
    exportSettings.quality
  );

  const progressPercent = exportProgress?.percent ?? 0;
  const progressMessage = (() => {
    if (!exportProgress) return '';
    switch (exportProgress.phase) {
      case 'preparing':
        return 'Preparing...';
      case 'rendering':
        if (exportProgress.totalTiles > 1) {
          return `Rendering tile ${exportProgress.currentTile} of ${exportProgress.totalTiles}...`;
        }
        return 'Rendering...';
      case 'assembling':
        return 'Assembling image...';
      case 'encoding':
        return 'Encoding...';
      case 'complete':
        return 'Complete!';
      default:
        return '';
    }
  })();

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={handleClose}
    >
      <div
        className="bg-gray-900 rounded-xl shadow-2xl border border-gray-700 w-[420px] max-h-[85vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <div>
            <h2 className="text-xl font-semibold text-gray-100">Export Image</h2>
            <p className="text-sm text-gray-400 mt-1">
              {fractalType === 'mandelbulb' ? '3D Mandelbulb' : fractalType.charAt(0).toUpperCase() + fractalType.slice(1)}
            </p>
          </div>
          {!isExporting && (
            <button
              onClick={handleClose}
              className="p-2 rounded-lg hover:bg-gray-800 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto">
          {/* Resolution Presets */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Resolution</label>
            <div className="grid grid-cols-4 gap-2">
              {(['1080p', '4k', '8k', 'custom'] as ResolutionPreset[]).map((preset) => (
                <button
                  key={preset}
                  onClick={() => handlePresetChange(preset)}
                  disabled={isExporting}
                  className={`
                    px-3 py-2 rounded-lg text-sm font-medium transition-all
                    ${selectedPreset === preset
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-800 hover:bg-gray-700 text-gray-300'
                    }
                    ${isExporting ? 'opacity-50 cursor-not-allowed' : ''}
                  `}
                >
                  {preset.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Dimensions */}
          <div>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <label className="block text-xs text-gray-400 mb-1">Width</label>
                <input
                  type="number"
                  value={exportSettings.width}
                  onChange={(e) => handleWidthChange(Math.max(100, parseInt(e.target.value) || 100))}
                  disabled={isExporting}
                  min={100}
                  max={15360}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 text-sm
                           focus:outline-none focus:border-blue-500 disabled:opacity-50"
                />
              </div>

              <button
                onClick={handleAspectLockToggle}
                disabled={isExporting}
                className={`mt-5 p-2 rounded-lg transition-colors ${
                  exportSettings.aspectLocked
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                } ${isExporting ? 'opacity-50 cursor-not-allowed' : ''}`}
                title={exportSettings.aspectLocked ? 'Aspect ratio locked' : 'Aspect ratio unlocked'}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {exportSettings.aspectLocked ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                  )}
                </svg>
              </button>

              <div className="flex-1">
                <label className="block text-xs text-gray-400 mb-1">Height</label>
                <input
                  type="number"
                  value={exportSettings.height}
                  onChange={(e) => handleHeightChange(Math.max(100, parseInt(e.target.value) || 100))}
                  disabled={isExporting}
                  min={100}
                  max={15360}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 text-sm
                           focus:outline-none focus:border-blue-500 disabled:opacity-50"
                />
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Estimated size: <span className="text-gray-300">{estimatedSize}</span>
            </p>
          </div>

          {/* Format */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Format</label>
            <div className="grid grid-cols-3 gap-2">
              {(['png', 'jpeg', 'webp'] as ExportSettings['format'][]).map((format) => (
                <button
                  key={format}
                  onClick={() => handleFormatChange(format)}
                  disabled={isExporting}
                  className={`
                    px-3 py-2 rounded-lg text-sm font-medium transition-all
                    ${exportSettings.format === format
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-800 hover:bg-gray-700 text-gray-300'
                    }
                    ${isExporting ? 'opacity-50 cursor-not-allowed' : ''}
                  `}
                >
                  {format.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Quality Slider (for JPEG/WebP) */}
          {exportSettings.format !== 'png' && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-300">Quality</label>
                <span className="text-sm text-gray-400">{Math.round(exportSettings.quality * 100)}%</span>
              </div>
              <input
                type="range"
                min={0.1}
                max={1}
                step={0.01}
                value={exportSettings.quality}
                onChange={(e) => handleQualityChange(parseFloat(e.target.value))}
                disabled={isExporting}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer
                         disabled:opacity-50 disabled:cursor-not-allowed
                         [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
                         [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:rounded-full
                         [&::-webkit-slider-thumb]:hover:bg-blue-400 [&::-webkit-slider-thumb]:transition-colors"
              />
            </div>
          )}

          {/* Progress */}
          {isExporting && exportProgress && (
            <div className="bg-gray-800 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-300">Progress</span>
                <span className="text-sm text-gray-400">{progressPercent}%</span>
              </div>
              <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <p className="text-xs text-gray-400 mt-2">{progressMessage}</p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-red-900/30 border border-red-700 rounded-lg p-3">
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}

          {/* 3D Warning */}
          {fractalType === 'mandelbulb' && !isExporting && (
            <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg p-3">
              <p className="text-xs text-yellow-300">
                3D exports use high-quality settings and may take longer. Large resolutions may exceed GPU limits.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-700 bg-gray-800/50 flex justify-end gap-3">
          <button
            onClick={handleCancel}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors"
          >
            {isExporting ? 'Cancel' : 'Close'}
          </button>
          {!isExporting && (
            <button
              onClick={handleExport}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition-colors"
            >
              Export
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
