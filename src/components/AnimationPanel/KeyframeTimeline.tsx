import { useState } from 'react';
import { useFractalStore } from '../../store/fractalStore';
import { KeyframeEditor } from './KeyframeEditor';
import type { EasingFunction, ViewBounds } from '../../types';

const EASING_ICONS: Record<EasingFunction, string> = {
  'linear': '/',
  'ease-in': '⌒',
  'ease-out': '⌓',
  'ease-in-out': '~',
};

function calculateZoomLevel(viewBounds: ViewBounds): number {
  const range = Math.min(
    viewBounds.maxReal - viewBounds.minReal,
    viewBounds.maxImag - viewBounds.minImag
  );
  return 3 / range;
}

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

export function KeyframeTimeline() {
  const {
    keyframes,
    selectedKeyframeId,
    selectKeyframe,
    applyKeyframe,
    animationPlayback,
    reorderKeyframes,
  } = useFractalStore();

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);

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
    // Select the keyframe (keep it selected) and apply its state
    selectKeyframe(id);
    applyKeyframe(id);
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    if (animationPlayback.isPlaying) {
      e.preventDefault();
      return;
    }
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
    // Add a slight delay to allow the drag image to be created before adding opacity
    requestAnimationFrame(() => {
      (e.target as HTMLElement).style.opacity = '0.5';
    });
  };

  const handleDragEnd = (e: React.DragEvent) => {
    (e.target as HTMLElement).style.opacity = '1';
    setDraggedIndex(null);
    setDropTargetIndex(null);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedIndex !== null && index !== draggedIndex) {
      setDropTargetIndex(index);
    }
  };

  const handleDragLeave = () => {
    setDropTargetIndex(null);
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    const sourceIndex = draggedIndex;
    if (sourceIndex !== null && sourceIndex !== targetIndex) {
      reorderKeyframes(sourceIndex, targetIndex);
    }
    setDraggedIndex(null);
    setDropTargetIndex(null);
  };

  return (
    <div className="flex flex-col gap-2">
      {/* Timeline strip */}
      <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-gray-700">
        {keyframes.map((kf, index) => (
          <div key={kf.id} className="flex items-center">
            {/* Keyframe thumbnail - draggable */}
            <div
              draggable={!animationPlayback.isPlaying}
              onDragStart={(e) => handleDragStart(e, index)}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, index)}
              className={`relative flex-shrink-0 transition-transform ${
                draggedIndex === index ? 'scale-95' : ''
              } ${dropTargetIndex === index ? 'scale-110' : ''}`}
            >
              {/* Drop indicator - left side */}
              {dropTargetIndex === index && draggedIndex !== null && draggedIndex > index && (
                <div className="absolute -left-1 top-0 bottom-0 w-1 bg-blue-500 rounded-full z-10" />
              )}
              {/* Drop indicator - right side */}
              {dropTargetIndex === index && draggedIndex !== null && draggedIndex < index && (
                <div className="absolute -right-1 top-0 bottom-0 w-1 bg-blue-500 rounded-full z-10" />
              )}
              <button
                onClick={() => handleKeyframeClick(kf.id)}
                onDoubleClick={() => handleKeyframeDoubleClick(kf.id)}
                className={`relative flex-shrink-0 w-16 h-10 rounded overflow-hidden border-2 transition-all ${
                  selectedKeyframeId === kf.id
                    ? 'border-blue-500 ring-2 ring-blue-500/50'
                    : dropTargetIndex === index
                    ? 'border-blue-400 ring-2 ring-blue-400/50'
                    : 'border-gray-600 hover:border-gray-500'
                } ${animationPlayback.isPlaying ? 'opacity-50 cursor-not-allowed' : 'cursor-grab active:cursor-grabbing'}`}
                title={`${kf.name || `Keyframe ${index + 1}`} (${formatZoomLevel(calculateZoomLevel(kf.viewBounds))})\nDrag to reorder • Double-click to jump`}
              >
                {kf.thumbnail ? (
                  <img
                    src={kf.thumbnail}
                    alt={kf.name || `Keyframe ${index + 1}`}
                    className="w-full h-full object-cover pointer-events-none"
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
            </div>

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
