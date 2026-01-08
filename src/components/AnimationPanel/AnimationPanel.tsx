import { useState } from 'react';
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
    savedAnimations,
    setShowSavedAnimationsDialog,
    saveAnimation,
  } = useFractalStore();

  const [showSaveInput, setShowSaveInput] = useState(false);
  const [saveName, setSaveName] = useState('');

  const totalDuration = calculateTotalDuration(keyframes);
  const canAnimate = fractalType === 'mandelbrot' || fractalType === 'julia';
  const hasKeyframes = keyframes.length > 0;
  const canExport = keyframes.length >= 2;

  // Dynamic accent color based on fractal type
  const accentColor = fractalType === 'julia' ? 'purple' : 'blue';
  const primaryButtonClass = accentColor === 'purple'
    ? 'bg-purple-600 hover:bg-purple-500'
    : 'bg-blue-600 hover:bg-blue-500';
  const accentBadgeClass = accentColor === 'purple' ? 'bg-purple-600' : 'bg-blue-600';

  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    }
    return `${seconds}s`;
  };

  const handleSave = async () => {
    if (!saveName.trim() || !canExport) return;
    await saveAnimation(saveName.trim());
    setSaveName('');
    setShowSaveInput(false);
  };

  const handleSaveKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      setShowSaveInput(false);
      setSaveName('');
    }
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

          {/* Primary action - Add Keyframe */}
          <button
            onClick={addKeyframe}
            disabled={!canAnimate || animationPlayback.isPlaying}
            className={`w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded transition-colors ${
              canAnimate && !animationPlayback.isPlaying
                ? `${primaryButtonClass} text-white`
                : 'bg-gray-700 text-gray-500 cursor-not-allowed'
            }`}
            title={!canAnimate ? 'Switch to Mandelbrot or Julia mode' : 'Capture current view as keyframe'}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Keyframe
          </button>

          {/* Save animation - expandable input */}
          {showSaveInput ? (
            <div className="flex gap-1.5">
              <input
                type="text"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                onKeyDown={handleSaveKeyDown}
                placeholder="Animation name..."
                autoFocus
                className="flex-1 bg-gray-700 text-white text-xs px-2 py-1.5 rounded focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
              <button
                onClick={handleSave}
                disabled={!saveName.trim()}
                className={`px-3 py-1.5 text-xs rounded transition-colors ${
                  saveName.trim()
                    ? `${primaryButtonClass} text-white`
                    : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                }`}
              >
                Save
              </button>
              <button
                onClick={() => { setShowSaveInput(false); setSaveName(''); }}
                className="px-2 py-1.5 text-xs rounded bg-gray-700 hover:bg-gray-600 text-gray-400"
                title="Cancel"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ) : (
            <div className="flex gap-1.5">
              {/* Save animation */}
              <button
                onClick={() => setShowSaveInput(true)}
                disabled={!canExport || animationPlayback.isPlaying}
                className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs rounded transition-colors ${
                  canExport && !animationPlayback.isPlaying
                    ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                    : 'bg-gray-800 text-gray-600 cursor-not-allowed'
                }`}
                title={canExport ? 'Save animation to library' : 'Need at least 2 keyframes to save'}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
                Save
              </button>

              {/* Clear keyframes */}
              <button
                onClick={() => {
                  if (confirm('Clear all keyframes? This cannot be undone.')) {
                    clearKeyframes();
                  }
                }}
                disabled={!hasKeyframes || animationPlayback.isPlaying}
                className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs rounded transition-colors ${
                  hasKeyframes && !animationPlayback.isPlaying
                    ? 'bg-gray-700 hover:bg-red-600 text-gray-300 hover:text-white'
                    : 'bg-gray-800 text-gray-600 cursor-not-allowed'
                }`}
                title={hasKeyframes ? 'Clear all keyframes from current animation' : 'No keyframes to clear'}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Clear
              </button>
            </div>
          )}

          {/* Secondary actions */}
          <div className="flex gap-1.5">
            {/* Library (saved animations) */}
            <button
              onClick={() => setShowSavedAnimationsDialog(true)}
              disabled={animationPlayback.isPlaying}
              className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs rounded transition-colors relative ${
                !animationPlayback.isPlaying
                  ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                  : 'bg-gray-800 text-gray-600 cursor-not-allowed'
              }`}
              title="Browse saved animations"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
              </svg>
              Library
              {savedAnimations.length > 0 && (
                <span className={`absolute -top-1 -right-1 ${accentBadgeClass} text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center`}>
                  {savedAnimations.length}
                </span>
              )}
            </button>

            {/* Export Video */}
            <button
              onClick={() => setShowVideoExportDialog(true)}
              disabled={!canExport || animationPlayback.isPlaying}
              className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs rounded transition-colors ${
                canExport && !animationPlayback.isPlaying
                  ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                  : 'bg-gray-800 text-gray-600 cursor-not-allowed'
              }`}
              title={canExport ? 'Export animation as video' : 'Need at least 2 keyframes to export'}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Export
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
