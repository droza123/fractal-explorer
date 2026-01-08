import { useEffect, useCallback, useState, useRef } from 'react';
import { useFractalStore } from '../../store/fractalStore';
import {
  calculateTotalFrames,
  estimateFileSize,
  estimateExportDuration,
  getAntiAliasForQuality,
  getResolutionDimensions,
  TiledFrameRenderer,
  CPUFrameRenderer,
  createTiledRenderOptionsFromState,
  needsHighPrecision,
  calculateZoomLevel,
} from '../../lib/video/frameRenderer';
import { getStateAtTime, calculateTotalDuration } from '../../lib/animation/interpolation';
import { downloadBlob, generateVideoFilename } from '../../lib/video/videoRecorder';
import {
  WebCodecsEncoder,
  createWebCodecsEncoderFromSettings,
  isWebCodecsSupported,
  type WebCodecsProgress,
} from '../../lib/video/webCodecsEncoder';
import type { VideoExportSettings, VideoRenderQuality, VideoRenderPrecision, ZoomOverlayPosition, ViewBounds } from '../../types';

const RESOLUTION_PRESETS: { value: VideoExportSettings['resolution']; label: string }[] = [
  { value: '720p', label: '720p (1280x720)' },
  { value: '1080p', label: '1080p (1920x1080)' },
  { value: '4k', label: '4K (3840x2160)' },
  { value: '8k', label: '8K (7680x4320)' },
  { value: 'custom', label: 'Custom' },
];

const FPS_OPTIONS: { value: 30 | 60; label: string }[] = [
  { value: 30, label: '30 FPS' },
  { value: 60, label: '60 FPS' },
];

const QUALITY_OPTIONS: { value: VideoRenderQuality; label: string; description: string }[] = [
  { value: 'standard', label: 'Standard', description: 'True resolution with 4x anti-aliasing (fastest)' },
  { value: 'high', label: 'High', description: 'True resolution with 9x anti-aliasing' },
  { value: 'ultra', label: 'Ultra', description: 'True resolution with 16x anti-aliasing (slowest)' },
];

const PRECISION_OPTIONS: { value: VideoRenderPrecision; label: string; description: string }[] = [
  { value: 'auto', label: 'Auto', description: 'GPU rendering, auto-switches to CPU for deep zooms (>12,500x)' },
  { value: 'gpu', label: 'GPU', description: 'Fast GPU rendering (may pixelate at extreme zoom levels)' },
  { value: 'cpu', label: 'CPU', description: 'High-precision CPU rendering (slower, AA capped at 9x)' },
];

const ZOOM_POSITION_OPTIONS: { value: ZoomOverlayPosition; label: string }[] = [
  { value: 'top-left', label: 'Top Left' },
  { value: 'top-right', label: 'Top Right' },
  { value: 'bottom-left', label: 'Bottom Left' },
  { value: 'bottom-right', label: 'Bottom Right' },
];

/**
 * Format zoom level for display
 */
function formatZoomLevel(zoom: number): string {
  if (zoom >= 1e12) {
    return `${(zoom / 1e12).toFixed(1)}T×`;
  } else if (zoom >= 1e9) {
    return `${(zoom / 1e9).toFixed(1)}B×`;
  } else if (zoom >= 1e6) {
    return `${(zoom / 1e6).toFixed(1)}M×`;
  } else if (zoom >= 1e3) {
    return `${(zoom / 1e3).toFixed(1)}K×`;
  } else {
    return `${zoom.toFixed(1)}×`;
  }
}

/**
 * Draw zoom level overlay on a canvas
 */
function drawZoomOverlay(
  canvas: HTMLCanvasElement,
  viewBounds: ViewBounds,
  position: ZoomOverlayPosition
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const zoom = calculateZoomLevel(viewBounds);
  const text = `Zoom: ${formatZoomLevel(zoom)}`;

  // Scale font size based on canvas resolution
  const baseFontSize = Math.max(16, Math.min(canvas.width, canvas.height) / 40);
  const padding = baseFontSize * 0.75;

  ctx.font = `bold ${baseFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  ctx.textBaseline = 'top';

  const metrics = ctx.measureText(text);
  const textWidth = metrics.width;
  const textHeight = baseFontSize;

  // Calculate position
  let x: number;
  let y: number;

  switch (position) {
    case 'top-left':
      x = padding;
      y = padding;
      break;
    case 'top-right':
      x = canvas.width - textWidth - padding * 2;
      y = padding;
      break;
    case 'bottom-left':
      x = padding;
      y = canvas.height - textHeight - padding * 2;
      break;
    case 'bottom-right':
    default:
      x = canvas.width - textWidth - padding * 2;
      y = canvas.height - textHeight - padding * 2;
      break;
  }

  // Draw semi-transparent background
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.beginPath();
  ctx.roundRect(x - padding * 0.5, y - padding * 0.25, textWidth + padding, textHeight + padding * 0.5, baseFontSize * 0.25);
  ctx.fill();

  // Draw text with slight shadow for better readability
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.fillText(text, x + 1, y + 1);
  ctx.fillStyle = 'white';
  ctx.fillText(text, x, y);
}

export function VideoExportDialog() {
  const {
    showVideoExportDialog,
    setShowVideoExportDialog,
    videoExportSettings,
    setVideoExportSettings,
    isExportingVideo,
    setIsExportingVideo,
    setVideoExportProgress,
    cancelVideoExport,
    keyframes,
    thumbnailCanvas,
    customPalettes,
  } = useFractalStore();

  const [error, setError] = useState<string | null>(null);
  const [exportProgress, setExportProgress] = useState<WebCodecsProgress | null>(null);
  const [downloadReady, setDownloadReady] = useState<string | null>(null); // filename when download starts
  const [exportStartTime, setExportStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const encoderRef = useRef<WebCodecsEncoder | null>(null);
  const timerRef = useRef<number | null>(null);

  const webCodecsSupported = isWebCodecsSupported();

  // Timer for elapsed time during export
  useEffect(() => {
    if (isExportingVideo && exportStartTime && !downloadReady) {
      timerRef.current = window.setInterval(() => {
        setElapsedTime(Date.now() - exportStartTime);
      }, 1000);

      return () => {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      };
    }
  }, [isExportingVideo, exportStartTime, downloadReady]);

  // Calculate estimated time remaining
  const estimatedTimeRemaining = (() => {
    if (!exportProgress || exportProgress.overallPercent <= 0 || elapsedTime <= 0) {
      return null;
    }
    const percentComplete = exportProgress.overallPercent;
    if (percentComplete >= 100) return 0;

    // Estimate based on current progress rate
    const msPerPercent = elapsedTime / percentComplete;
    const remainingPercent = 100 - percentComplete;
    return Math.round(msPerPercent * remainingPercent);
  })();

  const totalDuration = calculateTotalDuration(keyframes);
  const totalFrames = calculateTotalFrames(keyframes, videoExportSettings.fps);
  const estimatedSize = estimateFileSize(keyframes, videoExportSettings);
  const estimatedTime = estimateExportDuration(keyframes, videoExportSettings);

  const handleClose = useCallback(() => {
    if (!isExportingVideo) {
      setShowVideoExportDialog(false);
      setError(null);
      setExportProgress(null);
      setDownloadReady(null);
      setExportStartTime(null);
      setElapsedTime(0);
    }
  }, [isExportingVideo, setShowVideoExportDialog]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' && !isExportingVideo) {
      handleClose();
    }
  }, [handleClose, isExportingVideo]);

  useEffect(() => {
    if (showVideoExportDialog) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [showVideoExportDialog, handleKeyDown]);

  const handleSettingChange = useCallback((settings: Partial<VideoExportSettings>) => {
    setVideoExportSettings(settings);
  }, [setVideoExportSettings]);

  const handleExport = useCallback(async () => {
    if (!thumbnailCanvas || keyframes.length < 2) {
      setError('Cannot export: need at least 2 keyframes and a canvas');
      return;
    }

    if (!webCodecsSupported) {
      setError('WebCodecs is not supported in your browser. Please use Chrome, Edge, or another Chromium-based browser.');
      return;
    }

    setError(null);
    setIsExportingVideo(true);
    setExportProgress(null);
    setExportStartTime(Date.now());
    setElapsedTime(0);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    // Get anti-aliasing level based on quality setting
    const antiAlias = getAntiAliasForQuality(videoExportSettings.renderQuality);

    // Create renderers based on precision mode
    // GPU renderer (TiledFrameRenderer) is always created for non-CPU modes
    // CPU renderer is created lazily when needed
    const tiledRenderer = videoExportSettings.renderPrecision !== 'cpu' ? new TiledFrameRenderer() : null;
    let cpuRenderer: CPUFrameRenderer | null = null;

    // Create CPU renderer upfront if we know we'll need it
    if (videoExportSettings.renderPrecision === 'cpu') {
      cpuRenderer = new CPUFrameRenderer();
    }

    try {

      const { width, height } = getResolutionDimensions(
        videoExportSettings,
        thumbnailCanvas.width,
        thumbnailCanvas.height
      );

      // Create WebCodecs encoder with progress callback
      const encoder = createWebCodecsEncoderFromSettings(
        videoExportSettings,
        thumbnailCanvas.width,
        thumbnailCanvas.height,
        totalFrames,
        (progress) => {
          setExportProgress(progress);
          setVideoExportProgress({
            phase: progress.phase,
            currentFrame: progress.currentFrame || 0,
            totalFrames: progress.totalFrames || totalFrames,
            percent: progress.overallPercent,
          });
        }
      );
      encoderRef.current = encoder;

      await encoder.start();

      // Render and encode all frames
      const { fps } = videoExportSettings;

      for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
        if (abortController.signal.aborted) break;

        const timeMs = (frameIndex / fps) * 1000;
        const state = getStateAtTime(keyframes, timeMs);

        if (!state) {
          console.warn(`No state at time ${timeMs}ms, skipping frame ${frameIndex}`);
          continue;
        }

        // Create render options
        const tiledOptions = createTiledRenderOptionsFromState(
          state,
          width,
          height,
          customPalettes,
          antiAlias
        );

        // Determine which renderer to use for this frame
        let frameCanvas: HTMLCanvasElement;

        // Cap CPU anti-aliasing at 9x (3x3) - higher values are too slow
        const cpuAntiAlias = Math.min(antiAlias, 3);

        if (videoExportSettings.renderPrecision === 'cpu') {
          // Always use CPU renderer
          if (!cpuRenderer) {
            cpuRenderer = new CPUFrameRenderer();
          }
          const cpuOptions = { ...tiledOptions, antiAlias: cpuAntiAlias };
          frameCanvas = await cpuRenderer.renderFrame(cpuOptions);
        } else if (videoExportSettings.renderPrecision === 'auto' && needsHighPrecision(state.viewBounds)) {
          // Auto mode: switch to CPU for deep zooms
          if (!cpuRenderer) {
            cpuRenderer = new CPUFrameRenderer();
          }
          const cpuOptions = { ...tiledOptions, antiAlias: cpuAntiAlias };
          frameCanvas = await cpuRenderer.renderFrame(cpuOptions);
        } else {
          // GPU rendering (fast)
          if (!tiledRenderer) {
            throw new Error('GPU renderer not initialized');
          }
          frameCanvas = tiledRenderer.renderFrame(tiledOptions);
        }

        // Draw zoom level overlay if enabled
        if (videoExportSettings.showZoomLevel) {
          drawZoomOverlay(frameCanvas, state.viewBounds, videoExportSettings.zoomLevelPosition);
        }

        // Add frame to encoder - encoding happens in real-time
        await encoder.addFrame(frameCanvas);

        // Allow UI to update periodically
        if (frameIndex % 5 === 0) {
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      }

      if (!abortController.signal.aborted) {
        // Finish encoding and get the MP4 blob
        const { blob } = await encoder.finish();

        // Generate filename and download the video
        const filename = generateVideoFilename('mp4');

        // Set download ready state before starting download
        setDownloadReady(filename);

        // Start the download
        downloadBlob(blob, filename);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Export failed';
      setError(errorMessage);
      console.error('Video export error:', err);
    } finally {
      // Dispose renderers to free resources
      tiledRenderer?.dispose();
      cpuRenderer?.dispose();
      setIsExportingVideo(false);
      abortControllerRef.current = null;
      encoderRef.current = null;
    }
  }, [
    keyframes,
    videoExportSettings,
    thumbnailCanvas,
    totalFrames,
    webCodecsSupported,
    customPalettes,
    setIsExportingVideo,
    setVideoExportProgress,
  ]);

  const handleCancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    if (encoderRef.current) {
      encoderRef.current.abort();
    }
    cancelVideoExport();
    setError(null);
    setExportProgress(null);
    setDownloadReady(null);
    setExportStartTime(null);
    setElapsedTime(0);
  }, [cancelVideoExport]);

  if (!showVideoExportDialog) return null;

  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    }
    return `${seconds}s`;
  };

  const formatTimeElapsed = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={(e) => e.target === e.currentTarget && handleClose()}
    >
      <div
        className="bg-gray-900 rounded-xl shadow-2xl border border-gray-700 w-[420px] max-h-[85vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            Export Video (MP4)
          </h2>
          <button
            onClick={handleClose}
            disabled={isExportingVideo}
            className="text-gray-400 hover:text-white transition-colors disabled:opacity-50"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {/* Error message */}
          {error && (
            <div className="bg-red-900/30 text-red-400 text-sm px-3 py-2 rounded-lg">
              {error}
            </div>
          )}

          {/* Animation info */}
          <div className="bg-gray-800/50 rounded-lg p-3 text-sm">
            <div className="flex justify-between text-gray-400">
              <span>Keyframes:</span>
              <span className="text-white">{keyframes.length}</span>
            </div>
            <div className="flex justify-between text-gray-400">
              <span>Duration:</span>
              <span className="text-white">{formatDuration(totalDuration)}</span>
            </div>
            <div className="flex justify-between text-gray-400">
              <span>Total Frames:</span>
              <span className="text-white">{totalFrames}</span>
            </div>
          </div>

          {/* Download complete */}
          {downloadReady && (
            <div className="bg-green-900/30 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                  <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <div className="text-green-400 font-medium">Export Complete!</div>
                  <div className="text-sm text-gray-400">
                    Completed in {formatTimeElapsed(elapsedTime)}
                  </div>
                </div>
              </div>
              <div className="bg-gray-800/50 rounded px-3 py-2">
                <div className="text-xs text-gray-500">Filename:</div>
                <div className="text-sm text-white font-mono truncate">{downloadReady}</div>
              </div>
              <div className="text-xs text-gray-500">
                Check your browser's download folder. Large files may take a moment to save.
              </div>
            </div>
          )}

          {/* Export progress */}
          {isExportingVideo && exportProgress && !downloadReady && (
            <div className="bg-gray-800/50 rounded-lg p-3 space-y-3">
              {/* Single progress bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Exporting Video</span>
                  <span className="text-white">{Math.round(exportProgress.phasePercent)}%</span>
                </div>
                <div className="h-3 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-purple-500"
                    style={{ width: `${exportProgress.phasePercent}%` }}
                  />
                </div>
                {/* Detailed progress message */}
                <div className="text-center text-sm text-gray-400">
                  {exportProgress.message}
                </div>
              </div>

              {/* Time elapsed and remaining */}
              <div className="flex justify-between text-sm border-t border-gray-700 pt-2">
                <div>
                  <span className="text-gray-500">Elapsed: </span>
                  <span className="text-white font-mono">{formatTimeElapsed(elapsedTime)}</span>
                </div>
                <div>
                  <span className="text-gray-500">Remaining: </span>
                  <span className="text-white font-mono">
                    {estimatedTimeRemaining !== null
                      ? formatTimeElapsed(estimatedTimeRemaining)
                      : '--:--'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Settings (hidden during export and after download) */}
          {!isExportingVideo && !downloadReady && (
            <>
              {/* Render Quality */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">Render Quality</label>
                <div className="grid grid-cols-3 gap-2">
                  {QUALITY_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => handleSettingChange({ renderQuality: option.value })}
                      className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                        videoExportSettings.renderQuality === option.value
                          ? 'bg-purple-600 text-white'
                          : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                      }`}
                      title={option.description}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {QUALITY_OPTIONS.find((o) => o.value === videoExportSettings.renderQuality)?.description}
                </p>
              </div>

              {/* Render Precision (GPU/CPU) */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">Render Precision</label>
                <div className="grid grid-cols-3 gap-2">
                  {PRECISION_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => handleSettingChange({ renderPrecision: option.value })}
                      className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                        videoExportSettings.renderPrecision === option.value
                          ? 'bg-purple-600 text-white'
                          : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                      }`}
                      title={option.description}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {PRECISION_OPTIONS.find((o) => o.value === videoExportSettings.renderPrecision)?.description}
                </p>
              </div>

              {/* Resolution */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">Resolution</label>
                <div className="grid grid-cols-3 gap-2">
                  {RESOLUTION_PRESETS.slice(0, 3).map((preset) => (
                    <button
                      key={preset.value}
                      onClick={() => handleSettingChange({ resolution: preset.value })}
                      className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                        videoExportSettings.resolution === preset.value
                          ? 'bg-purple-600 text-white'
                          : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {RESOLUTION_PRESETS.slice(3).map((preset) => (
                    <button
                      key={preset.value}
                      onClick={() => handleSettingChange({ resolution: preset.value })}
                      className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                        videoExportSettings.resolution === preset.value
                          ? 'bg-purple-600 text-white'
                          : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                {/* Custom resolution inputs */}
                {videoExportSettings.resolution === 'custom' && (
                  <div className="flex gap-2 mt-2">
                    <input
                      type="number"
                      value={videoExportSettings.customWidth || 1920}
                      onChange={(e) => handleSettingChange({ customWidth: parseInt(e.target.value) || 1920 })}
                      className="flex-1 bg-gray-800 text-white text-sm px-3 py-2 rounded-lg"
                      placeholder="Width"
                      min="320"
                      max="7680"
                    />
                    <span className="text-gray-500 self-center">x</span>
                    <input
                      type="number"
                      value={videoExportSettings.customHeight || 1080}
                      onChange={(e) => handleSettingChange({ customHeight: parseInt(e.target.value) || 1080 })}
                      className="flex-1 bg-gray-800 text-white text-sm px-3 py-2 rounded-lg"
                      placeholder="Height"
                      min="240"
                      max="4320"
                    />
                  </div>
                )}
              </div>

              {/* FPS */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">Frame Rate</label>
                <div className="grid grid-cols-2 gap-2">
                  {FPS_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => handleSettingChange({ fps: option.value })}
                      className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                        videoExportSettings.fps === option.value
                          ? 'bg-purple-600 text-white'
                          : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quality slider */}
              <div>
                <div className="flex justify-between text-sm text-gray-400 mb-2">
                  <label>Encoding Quality</label>
                  <span className="text-white">{Math.round(videoExportSettings.quality * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="1"
                  step="0.1"
                  value={videoExportSettings.quality}
                  onChange={(e) => handleSettingChange({ quality: parseFloat(e.target.value) })}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                />
              </div>

              {/* Zoom Level Overlay */}
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={videoExportSettings.showZoomLevel}
                    onChange={(e) => handleSettingChange({ showZoomLevel: e.target.checked })}
                    className="w-4 h-4 rounded bg-gray-700 border-gray-600 text-purple-600 focus:ring-purple-500 focus:ring-offset-gray-900"
                  />
                  <span className="text-sm text-gray-400">Show zoom level overlay</span>
                </label>
                {videoExportSettings.showZoomLevel && (
                  <div className="mt-2 grid grid-cols-4 gap-1.5">
                    {ZOOM_POSITION_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => handleSettingChange({ zoomLevelPosition: option.value })}
                        className={`px-2 py-1.5 rounded text-xs transition-colors ${
                          videoExportSettings.zoomLevelPosition === option.value
                            ? 'bg-purple-600 text-white'
                            : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Estimates */}
              <div className="bg-gray-800/50 rounded-lg p-3 text-sm space-y-1">
                <div className="flex justify-between text-gray-400">
                  <span>Estimated size:</span>
                  <span className="text-white">
                    {estimatedSize.minMB.toFixed(1)} - {estimatedSize.maxMB.toFixed(1)} MB
                  </span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>Estimated time:</span>
                  <span className="text-white">
                    {estimatedTime.minSeconds < 60
                      ? `${estimatedTime.minSeconds}s`
                      : `${Math.floor(estimatedTime.minSeconds / 60)}m`}
                    {' - '}
                    {estimatedTime.maxSeconds < 60
                      ? `${estimatedTime.maxSeconds}s`
                      : `${Math.floor(estimatedTime.maxSeconds / 60)}m`}
                  </span>
                </div>
                {!webCodecsSupported && (
                  <div className="text-xs text-yellow-500 mt-2">
                    WebCodecs not supported. Please use Chrome, Edge, or another Chromium-based browser.
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-700 flex gap-2">
          {downloadReady ? (
            <button
              onClick={handleClose}
              className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors"
            >
              Close
            </button>
          ) : isExportingVideo ? (
            <button
              onClick={handleCancel}
              className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors"
            >
              Cancel Export
            </button>
          ) : (
            <>
              <button
                onClick={handleClose}
                className="flex-1 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleExport}
                disabled={keyframes.length < 2}
                className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Export Video
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
