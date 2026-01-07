import { useEffect, useRef } from 'react';
import { useFractalStore } from '../../store/fractalStore';
import { PlaybackEngine, setPlaybackEngine, destroyPlaybackEngine } from '../../lib/animation/playbackEngine';
import { calculateTotalDuration } from '../../lib/animation/interpolation';

const SPEED_OPTIONS = [0.25, 0.5, 1, 2];

// Throttle interval for playback updates (ms) - lower = smoother but slower
const PLAYBACK_THROTTLE_MS = 100;

export function PlaybackControls() {
  const {
    keyframes,
    animationPlayback,
    setAnimationPlayback,
    applyAnimationState,
  } = useFractalStore();

  const engineRef = useRef<PlaybackEngine | null>(null);
  const lastApplyTimeRef = useRef<number>(0);
  const totalDuration = calculateTotalDuration(keyframes);
  const canPlay = keyframes.length >= 2;

  const formatTime = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    const milliseconds = Math.floor((ms % 1000) / 10);
    if (minutes > 0) {
      return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`;
    }
    return `${remainingSeconds}.${milliseconds.toString().padStart(2, '0')}`;
  };

  // Initialize engine when keyframes change
  useEffect(() => {
    if (keyframes.length >= 2) {
      const engine = new PlaybackEngine({
        keyframes,
        onFrame: (state, timeMs) => {
          // Throttle frame application to avoid overwhelming the renderer
          const now = performance.now();
          if (now - lastApplyTimeRef.current >= PLAYBACK_THROTTLE_MS) {
            lastApplyTimeRef.current = now;
            applyAnimationState(state);
          }
          // Always update time display
          setAnimationPlayback({ currentTime: timeMs });
        },
        onComplete: () => {
          setAnimationPlayback({ isPlaying: false });
        },
        playbackSpeed: animationPlayback.playbackSpeed,
      });
      engineRef.current = engine;
      setPlaybackEngine(engine);
    }

    return () => {
      if (engineRef.current) {
        destroyPlaybackEngine();
        engineRef.current = null;
      }
    };
  }, [keyframes]); // eslint-disable-line react-hooks/exhaustive-deps

  // Update speed when it changes
  useEffect(() => {
    engineRef.current?.setSpeed(animationPlayback.playbackSpeed);
  }, [animationPlayback.playbackSpeed]);

  const handlePlay = () => {
    if (!canPlay) return;
    engineRef.current?.play();
    setAnimationPlayback({ isPlaying: true });
  };

  const handlePause = () => {
    engineRef.current?.pause();
    setAnimationPlayback({ isPlaying: false });
  };

  const handleStop = () => {
    engineRef.current?.stop();
    setAnimationPlayback({ isPlaying: false, currentTime: 0 });
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const timeMs = parseFloat(e.target.value);
    engineRef.current?.seek(timeMs);
  };

  const handleSpeedChange = (speed: number) => {
    setAnimationPlayback({ playbackSpeed: speed });
  };

  return (
    <div className="flex flex-col gap-2 bg-gray-800/30 rounded p-2">
      {/* Progress bar / timeline scrubber */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-gray-400 font-mono w-12 text-right">
          {formatTime(animationPlayback.currentTime)}
        </span>
        <input
          type="range"
          min="0"
          max={totalDuration}
          step="10"
          value={animationPlayback.currentTime}
          onChange={handleSeek}
          disabled={!canPlay}
          className="flex-1 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500 disabled:opacity-50"
        />
        <span className="text-[10px] text-gray-400 font-mono w-12">
          {formatTime(totalDuration)}
        </span>
      </div>

      {/* Control buttons */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          {/* Stop button */}
          <button
            onClick={handleStop}
            disabled={!canPlay}
            className="p-1.5 rounded hover:bg-gray-700 text-gray-400 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Stop"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="6" width="12" height="12" rx="1" />
            </svg>
          </button>

          {/* Play/Pause button */}
          <button
            onClick={animationPlayback.isPlaying ? handlePause : handlePlay}
            disabled={!canPlay}
            className={`p-1.5 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              animationPlayback.isPlaying
                ? 'bg-blue-600 hover:bg-blue-500 text-white'
                : 'hover:bg-gray-700 text-gray-400 hover:text-white'
            }`}
            title={animationPlayback.isPlaying ? 'Pause' : 'Play'}
          >
            {animationPlayback.isPlaying ? (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="5" width="4" height="14" rx="1" />
                <rect x="14" y="5" width="4" height="14" rx="1" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>
        </div>

        {/* Preview speed selector */}
        <div
          className="flex items-center gap-1"
          title="Preview playback speed. Only affects real-time preview in browser. Exported videos always play at normal (1x) speed."
        >
          <span className="text-[10px] text-gray-500 cursor-help">Preview:</span>
          {SPEED_OPTIONS.map((speed) => (
            <button
              key={speed}
              onClick={() => handleSpeedChange(speed)}
              className={`text-[10px] px-1.5 py-0.5 rounded transition-colors ${
                animationPlayback.playbackSpeed === speed
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
              }`}
              title={`Preview at ${speed}x speed`}
            >
              {speed}x
            </button>
          ))}
        </div>
      </div>

      {/* Info text */}
      {!canPlay && (
        <div className="text-[10px] text-yellow-500 text-center">
          Add at least 2 keyframes to preview animation
        </div>
      )}
    </div>
  );
}
