import { useEffect, useCallback } from 'react';
import { useFractalStore } from '../../store/fractalStore';
import { equations } from '../../lib/equations';

export function EquationSelector() {
  const {
    showEquationSelector,
    setShowEquationSelector,
    equationId,
    setEquationId,
    fractalType,
  } = useFractalStore();

  const handleClose = useCallback(() => {
    setShowEquationSelector(false);
  }, [setShowEquationSelector]);

  const handleSelect = useCallback((id: number) => {
    setEquationId(id);
    setShowEquationSelector(false);
  }, [setEquationId, setShowEquationSelector]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleClose();
    }
  }, [handleClose]);

  useEffect(() => {
    if (showEquationSelector) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [showEquationSelector, handleKeyDown]);

  if (!showEquationSelector) return null;

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={handleClose}
    >
      <div
        className="bg-gray-900 rounded-xl shadow-2xl border border-gray-700 max-w-4xl max-h-[85vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <div>
            <h2 className="text-xl font-semibold text-gray-100">Select Equation</h2>
            <p className="text-sm text-gray-400 mt-1">
              {fractalType === 'julia' ? 'Choose a Julia set equation' : 'Switch to Julia mode first'}
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
          <div className="grid grid-cols-3 gap-2">
            {equations.map((eq) => (
              <button
                key={eq.id}
                onClick={() => handleSelect(eq.id)}
                className={`
                  p-3 rounded-lg text-left transition-all
                  ${equationId === eq.id
                    ? 'bg-blue-600 text-white ring-2 ring-blue-400'
                    : 'bg-gray-800 hover:bg-gray-700 text-gray-200'
                  }
                `}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-gray-400 w-6">
                    {eq.id.toString().padStart(2, '0')}
                  </span>
                  <span className="text-sm font-medium truncate flex-1">
                    {eq.label}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-700 bg-gray-800/50">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-400">
              Current: <span className="text-gray-200 font-medium">{equations.find(e => e.id === equationId)?.formula}</span>
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
