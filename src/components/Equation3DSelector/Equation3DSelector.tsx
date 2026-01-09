import { useEffect, useCallback } from 'react';
import { useFractalStore } from '../../store/fractalStore';
import { equations3d, getEquation3D } from '../../lib/equations3d';

export function Equation3DSelector() {
  const {
    showEquation3DSelector,
    setShowEquation3DSelector,
    equation3dId,
    setEquation3DId,
  } = useFractalStore();

  const handleClose = useCallback(() => {
    setShowEquation3DSelector(false);
  }, [setShowEquation3DSelector]);

  const handleSelect = useCallback((id: number) => {
    setEquation3DId(id);
    setShowEquation3DSelector(false);
  }, [setEquation3DId, setShowEquation3DSelector]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleClose();
    }
  }, [handleClose]);

  useEffect(() => {
    if (showEquation3DSelector) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [showEquation3DSelector, handleKeyDown]);

  if (!showEquation3DSelector) return null;

  const currentEquation = getEquation3D(equation3dId);

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={handleClose}
    >
      <div
        className="bg-gray-900 rounded-xl shadow-2xl border border-gray-700 max-w-3xl max-h-[85vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <div>
            <h2 className="text-xl font-semibold text-gray-100">Select 3D Fractal</h2>
            <p className="text-sm text-gray-400 mt-1">
              Choose a 3D fractal equation to render
            </p>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-lg hover:bg-gray-800 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto p-4">
          <div className="grid grid-cols-2 gap-3">
            {equations3d.map((eq) => (
              <button
                key={eq.id}
                onClick={() => handleSelect(eq.id)}
                className={`
                  p-4 rounded-lg text-left transition-all
                  ${equation3dId === eq.id
                    ? 'bg-purple-600 text-white ring-2 ring-purple-400'
                    : 'bg-gray-800 hover:bg-gray-700 text-gray-200'
                  }
                `}
              >
                <div className="flex items-start gap-3">
                  <span className={`
                    text-xs font-mono px-2 py-0.5 rounded
                    ${equation3dId === eq.id ? 'bg-purple-500/50' : 'bg-gray-700'}
                  `}>
                    {eq.id}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-base">{eq.label}</div>
                    <div className={`text-xs font-mono mt-0.5 ${
                      equation3dId === eq.id ? 'text-purple-200' : 'text-gray-400'
                    }`}>
                      {eq.formula}
                    </div>
                    <div className={`text-xs mt-2 line-clamp-2 ${
                      equation3dId === eq.id ? 'text-purple-100' : 'text-gray-500'
                    }`}>
                      {eq.description}
                    </div>
                    {/* Parameter badges */}
                    <div className="flex gap-1.5 mt-2">
                      {eq.hasPower && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                          equation3dId === eq.id ? 'bg-purple-500/40' : 'bg-gray-700'
                        }`}>
                          power: {eq.defaultPower}
                        </span>
                      )}
                      {eq.hasScale && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                          equation3dId === eq.id ? 'bg-purple-500/40' : 'bg-gray-700'
                        }`}>
                          scale: {eq.defaultScale}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-700 bg-gray-800/50">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-400">
              Current: <span className="text-gray-200 font-medium">{currentEquation?.label}</span>
              <span className="text-gray-500 ml-2 font-mono text-xs">{currentEquation?.formula}</span>
            </div>
            <button
              onClick={handleClose}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
