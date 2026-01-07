import { useState } from 'react';
import { useFractalStore } from '../../store/fractalStore';
import type { EasingFunction } from '../../types';

interface KeyframeEditorProps {
  keyframeId: string;
}

const EASING_OPTIONS: { value: EasingFunction; label: string; description: string }[] = [
  { value: 'linear', label: 'Linear', description: 'Constant speed' },
  { value: 'ease-in', label: 'Ease In', description: 'Start slow, end fast' },
  { value: 'ease-out', label: 'Ease Out', description: 'Start fast, end slow' },
  { value: 'ease-in-out', label: 'Ease In-Out', description: 'Smooth start and end' },
];

const DURATION_PRESETS = [500, 1000, 2000, 3000, 5000];

export function KeyframeEditor({ keyframeId }: KeyframeEditorProps) {
  const {
    keyframes,
    updateKeyframe,
    removeKeyframe,
    applyKeyframe,
    selectKeyframe,
  } = useFractalStore();

  const keyframe = keyframes.find((kf) => kf.id === keyframeId);
  const keyframeIndex = keyframes.findIndex((kf) => kf.id === keyframeId);
  const isLastKeyframe = keyframeIndex === keyframes.length - 1;

  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(keyframe?.name || '');

  if (!keyframe) return null;

  const handleNameSubmit = () => {
    updateKeyframe(keyframeId, { name: nameValue || undefined });
    setEditingName(false);
  };

  const handleDurationChange = (duration: number) => {
    updateKeyframe(keyframeId, { duration: Math.max(100, duration) });
  };

  const handleEasingChange = (easing: EasingFunction) => {
    updateKeyframe(keyframeId, { easing });
  };

  const handleDelete = () => {
    if (confirm('Delete this keyframe?')) {
      removeKeyframe(keyframeId);
    }
  };

  return (
    <div className="bg-gray-800/50 rounded-lg p-2 flex flex-col gap-2 border border-gray-700/50">
      {/* Header with name and actions */}
      <div className="flex items-center justify-between">
        {editingName ? (
          <input
            type="text"
            value={nameValue}
            onChange={(e) => setNameValue(e.target.value)}
            onBlur={handleNameSubmit}
            onKeyDown={(e) => e.key === 'Enter' && handleNameSubmit()}
            className="bg-gray-700 text-white text-xs px-2 py-1 rounded flex-1 mr-2"
            placeholder={`Keyframe ${keyframeIndex + 1}`}
            autoFocus
          />
        ) : (
          <button
            onClick={() => {
              setNameValue(keyframe.name || '');
              setEditingName(true);
            }}
            className="text-xs text-gray-300 hover:text-white transition-colors"
          >
            {keyframe.name || `Keyframe ${keyframeIndex + 1}`}
            <span className="ml-1 text-gray-500">✎</span>
          </button>
        )}
        <div className="flex gap-1">
          <button
            onClick={() => applyKeyframe(keyframeId)}
            className="p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-blue-400 transition-colors"
            title="Jump to this keyframe"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </button>
          <button
            onClick={handleDelete}
            className="p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-red-400 transition-colors"
            title="Delete keyframe"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
          <button
            onClick={() => selectKeyframe(null)}
            className="p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-gray-200 transition-colors"
            title="Close editor"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Transition settings (not for last keyframe) */}
      {!isLastKeyframe && (
        <>
          {/* Duration */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-400 w-16">Duration:</label>
            <div className="flex-1 flex items-center gap-1">
              <input
                type="range"
                min="100"
                max="10000"
                step="100"
                value={keyframe.duration}
                onChange={(e) => handleDurationChange(parseInt(e.target.value, 10))}
                className="flex-1 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
              />
              <input
                type="number"
                min="100"
                max="60000"
                step="100"
                value={keyframe.duration}
                onChange={(e) => handleDurationChange(parseInt(e.target.value, 10) || 100)}
                className="w-16 bg-gray-700 text-white text-xs px-1 py-0.5 rounded text-right"
              />
              <span className="text-xs text-gray-500">ms</span>
            </div>
          </div>

          {/* Duration presets */}
          <div className="flex gap-1 ml-16">
            {DURATION_PRESETS.map((preset) => (
              <button
                key={preset}
                onClick={() => handleDurationChange(preset)}
                className={`text-[10px] px-1.5 py-0.5 rounded transition-colors ${
                  keyframe.duration === preset
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                }`}
              >
                {preset >= 1000 ? `${preset / 1000}s` : `${preset}ms`}
              </button>
            ))}
          </div>

          {/* Easing */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-400 w-16">Easing:</label>
            <div className="flex-1 flex gap-1">
              {EASING_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => handleEasingChange(option.value)}
                  className={`flex-1 text-[10px] px-1 py-1 rounded transition-colors ${
                    keyframe.easing === option.value
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                  }`}
                  title={option.description}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* State info */}
      <div className="text-[10px] text-gray-500 mt-1">
        {keyframe.fractalType === 'julia' ? (
          <span>Julia: c = {keyframe.juliaConstant.real.toFixed(4)} + {keyframe.juliaConstant.imag.toFixed(4)}i</span>
        ) : (
          <span>Mandelbrot</span>
        )}
        {' · '}
        <span>Eq #{keyframe.equationId}</span>
        {' · '}
        <span>{keyframe.maxIterations} iter</span>
      </div>
    </div>
  );
}
