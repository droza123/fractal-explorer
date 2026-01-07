import { useFractalStore } from '../../store/fractalStore';
import { KeyframeEditor } from './KeyframeEditor';
import type { EasingFunction } from '../../types';

const EASING_ICONS: Record<EasingFunction, string> = {
  'linear': '/',
  'ease-in': '⌒',
  'ease-out': '⌓',
  'ease-in-out': '~',
};

export function KeyframeTimeline() {
  const {
    keyframes,
    selectedKeyframeId,
    selectKeyframe,
    applyKeyframe,
    animationPlayback,
  } = useFractalStore();

  const formatDuration = (ms: number): string => {
    if (ms >= 1000) {
      return `${(ms / 1000).toFixed(1)}s`;
    }
    return `${ms}ms`;
  };

  const handleKeyframeClick = (id: string) => {
    if (animationPlayback.isPlaying) return;
    selectKeyframe(selectedKeyframeId === id ? null : id);
  };

  const handleKeyframeDoubleClick = (id: string) => {
    if (animationPlayback.isPlaying) return;
    applyKeyframe(id);
  };

  return (
    <div className="flex flex-col gap-2">
      {/* Timeline strip */}
      <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-gray-700">
        {keyframes.map((kf, index) => (
          <div key={kf.id} className="flex items-center">
            {/* Keyframe thumbnail */}
            <button
              onClick={() => handleKeyframeClick(kf.id)}
              onDoubleClick={() => handleKeyframeDoubleClick(kf.id)}
              className={`relative flex-shrink-0 w-16 h-10 rounded overflow-hidden border-2 transition-all ${
                selectedKeyframeId === kf.id
                  ? 'border-blue-500 ring-2 ring-blue-500/50'
                  : 'border-gray-600 hover:border-gray-500'
              } ${animationPlayback.isPlaying ? 'opacity-50' : ''}`}
              title={`${kf.name || `Keyframe ${index + 1}`}\nDouble-click to jump to this state`}
            >
              {kf.thumbnail ? (
                <img
                  src={kf.thumbnail}
                  alt={kf.name || `Keyframe ${index + 1}`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gray-800 flex items-center justify-center text-gray-500 text-xs">
                  {index + 1}
                </div>
              )}
              {/* Keyframe number badge */}
              <div className="absolute top-0 left-0 bg-black/70 text-white text-[10px] px-1 rounded-br">
                {index + 1}
              </div>
              {/* Fractal type indicator */}
              <div className={`absolute bottom-0 right-0 text-[8px] px-1 rounded-tl ${
                kf.fractalType === 'julia' ? 'bg-purple-600/90' : 'bg-blue-600/90'
              } text-white`}>
                {kf.fractalType === 'julia' ? 'J' : 'M'}
              </div>
            </button>

            {/* Duration/transition indicator (not after last keyframe) */}
            {index < keyframes.length - 1 && (
              <div className="flex flex-col items-center mx-1 text-[10px] text-gray-500">
                <span className="font-mono">{EASING_ICONS[kf.easing]}</span>
                <span>{formatDuration(kf.duration)}</span>
                <svg className="w-3 h-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Selected keyframe editor */}
      {selectedKeyframeId && (
        <KeyframeEditor keyframeId={selectedKeyframeId} />
      )}
    </div>
  );
}
