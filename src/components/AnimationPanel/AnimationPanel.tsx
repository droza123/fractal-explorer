import { useFractalStore } from '../../store/fractalStore';
import { KeyframeTimeline } from './KeyframeTimeline';
import { PlaybackControls } from './PlaybackControls';
import { calculateTotalDuration } from '../../lib/animation/interpolation';

export function AnimationPanel() {
  const {
    keyframes,
    animationPanelCollapsed,
    setAnimationPanelCollapsed,
    addKeyframe,
    clearKeyframes,
    fractalType,
    setShowVideoExportDialog,
    animationPlayback,
  } = useFractalStore();

  const totalDuration = calculateTotalDuration(keyframes);
  const canAnimate = fractalType === 'mandelbrot' || fractalType === 'julia';
  const hasKeyframes = keyframes.length > 0;
  const canExport = keyframes.length >= 2;

  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    }
    return `${seconds}s`;
  };

  return (
    <div className="bg-gray-900/90 backdrop-blur-sm rounded-lg shadow-lg border border-gray-700/50">
      {/* Collapsible header */}
      <button
        onClick={() => setAnimationPanelCollapsed(!animationPanelCollapsed)}
        className="w-full flex items-center justify-between p-2 hover:bg-gray-800/50 rounded-lg transition-colors"
      >
        <div className="flex items-center gap-1 text-sm text-gray-300 font-medium">
          <svg
            className={`w-3 h-3 transition-transform ${animationPanelCollapsed ? '' : 'rotate-90'}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          Animation
        </div>
        <span className="text-xs text-gray-500">
          {keyframes.length} keyframe{keyframes.length !== 1 ? 's' : ''}
          {totalDuration > 0 && ` · ${formatDuration(totalDuration)}`}
        </span>
      </button>

      {/* Collapsible content */}
      {!animationPanelCollapsed && (
        <div className="px-3 pb-3 flex flex-col gap-3">
          {/* Mode warning */}
          {!canAnimate && (
            <div className="text-xs text-yellow-400 bg-yellow-900/30 rounded px-2 py-1">
              Animation only works with Mandelbrot and Julia modes
            </div>
          )}

          {/* Playback controls */}
          {hasKeyframes && <PlaybackControls />}

          {/* Keyframe timeline */}
          {hasKeyframes ? (
            <KeyframeTimeline />
          ) : (
            <div className="text-xs text-gray-500 text-center py-4">
              No keyframes yet. Add your first keyframe to start creating an animation.
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2">
            <button
              onClick={addKeyframe}
              disabled={!canAnimate || animationPlayback.isPlaying}
              className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs rounded transition-colors ${
                canAnimate && !animationPlayback.isPlaying
                  ? 'bg-blue-600 hover:bg-blue-500 text-white'
                  : 'bg-gray-700 text-gray-500 cursor-not-allowed'
              }`}
              title={!canAnimate ? 'Switch to Mandelbrot or Julia mode' : 'Capture current view as keyframe'}
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Keyframe
            </button>

            {canExport && (
              <button
                onClick={() => setShowVideoExportDialog(true)}
                disabled={animationPlayback.isPlaying}
                className={`flex items-center justify-center gap-1 px-2 py-1.5 text-xs rounded transition-colors ${
                  !animationPlayback.isPlaying
                    ? 'bg-purple-600 hover:bg-purple-500 text-white'
                    : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                }`}
                title="Export animation as video"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Export
              </button>
            )}
          </div>

          {/* Clear button */}
          {hasKeyframes && (
            <button
              onClick={() => {
                if (confirm('Clear all keyframes? This cannot be undone.')) {
                  clearKeyframes();
                }
              }}
              disabled={animationPlayback.isPlaying}
              className="text-xs text-gray-500 hover:text-red-400 transition-colors disabled:opacity-50"
            >
              Clear all keyframes
            </button>
          )}
        </div>
      )}
    </div>
  );
}
