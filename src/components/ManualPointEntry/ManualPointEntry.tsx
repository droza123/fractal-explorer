import { useState, useEffect } from 'react';
import { useFractalStore } from '../../store/fractalStore';
import { equations } from '../../lib/equations';

interface ManualPointEntryProps {
  isOpen: boolean;
  onClose: () => void;
}

type EntryMode = 'current' | 'manual';

export function ManualPointEntry({ isOpen, onClose }: ManualPointEntryProps) {
  const { equationId, switchToJulia, saveCurrentJulia, setJuliaConstant, setEquationId, juliaConstant, fractalType } = useFractalStore();

  // Default to 'current' mode in Julia mode, 'manual' otherwise
  const [mode, setMode] = useState<EntryMode>(fractalType === 'julia' ? 'current' : 'manual');
  const [name, setName] = useState('');
  const [real, setReal] = useState('');
  const [imag, setImag] = useState('');
  const [selectedEquation, setSelectedEquation] = useState(equationId);
  const [saveAfterOpen, setSaveAfterOpen] = useState(true);

  // Reset mode based on fractal type when dialog opens
  useEffect(() => {
    if (isOpen) {
      setMode(fractalType === 'julia' ? 'current' : 'manual');
      setSelectedEquation(equationId);
    }
  }, [isOpen, fractalType, equationId]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    let constant: { real: number; imag: number };

    if (mode === 'current') {
      // Use current Julia constant
      constant = juliaConstant;
    } else {
      // Parse manual entry
      const realNum = parseFloat(real);
      const imagNum = parseFloat(imag);

      if (isNaN(realNum) || isNaN(imagNum)) {
        alert('Please enter valid numbers for real and imaginary parts');
        return;
      }
      constant = { real: realNum, imag: imagNum };
    }

    // Set the equation first if different
    if (selectedEquation !== equationId) {
      setEquationId(selectedEquation);
    }

    // For 'current' mode, we don't need to switch - just save
    if (mode === 'current') {
      // Save directly with current Julia
      if (name.trim()) {
        await saveCurrentJulia(name.trim());
      } else {
        await saveCurrentJulia();
      }
    } else {
      // Switch to Julia view with this constant
      switchToJulia(constant);

      // If save is checked, save it after a short delay to allow rendering
      if (saveAfterOpen && name.trim()) {
        // Wait for the canvas to render before saving (for thumbnail)
        setTimeout(async () => {
          setJuliaConstant(constant);
          await saveCurrentJulia(name.trim());
        }, 100);
      }
    }

    // Reset form
    setName('');
    setReal('');
    setImag('');
    onClose();
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Check if current mode is available (only when in Julia mode with a valid constant)
  const currentModeAvailable = fractalType === 'julia';

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={handleBackdropClick}
    >
      <div className="bg-gray-900 rounded-lg p-4 w-80 shadow-xl border border-gray-700">
        <h2 className="text-lg font-medium text-gray-200 mb-4">
          {mode === 'current' ? 'Save Julia Set' : 'Add Julia Point'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Mode toggle - only show if current mode is available */}
          {currentModeAvailable && (
            <div className="flex gap-1 p-1 bg-gray-800 rounded-lg">
              <button
                type="button"
                onClick={() => setMode('current')}
                className={`flex-1 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                  mode === 'current'
                    ? 'bg-purple-600 text-white'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                Current Julia
              </button>
              <button
                type="button"
                onClick={() => setMode('manual')}
                className={`flex-1 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                  mode === 'manual'
                    ? 'bg-purple-600 text-white'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                Manual Entry
              </button>
            </div>
          )}

          {/* Current Julia preview */}
          {mode === 'current' && (
            <div className="p-3 bg-gray-800 rounded-lg">
              <div className="text-xs text-gray-400 mb-1">Current Julia constant:</div>
              <div className="text-sm font-mono text-purple-300">
                c = {juliaConstant.real.toFixed(6)}{juliaConstant.imag >= 0 ? ' + ' : ' - '}{Math.abs(juliaConstant.imag).toFixed(6)}i
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs text-gray-400 mb-1">Name (optional)</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-600 text-sm focus:outline-none focus:border-purple-500"
              placeholder="My Julia Set"
            />
          </div>

          {/* Manual entry fields - only show in manual mode */}
          {mode === 'manual' && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Real (c.re)</label>
                  <input
                    type="text"
                    value={real}
                    onChange={(e) => setReal(e.target.value)}
                    className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-600 text-sm focus:outline-none focus:border-purple-500"
                    placeholder="-0.7"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Imaginary (c.im)</label>
                  <input
                    type="text"
                    value={imag}
                    onChange={(e) => setImag(e.target.value)}
                    className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-600 text-sm focus:outline-none focus:border-purple-500"
                    placeholder="0.27015"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">Equation</label>
                <select
                  value={selectedEquation}
                  onChange={(e) => setSelectedEquation(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-600 text-sm focus:outline-none focus:border-purple-500"
                >
                  {equations.map((eq) => (
                    <option key={eq.id} value={eq.id}>
                      #{eq.id}: {eq.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="saveAfterOpen"
                  checked={saveAfterOpen}
                  onChange={(e) => setSaveAfterOpen(e.target.checked)}
                  className="rounded bg-gray-800 border-gray-600"
                />
                <label htmlFor="saveAfterOpen" className="text-xs text-gray-400">
                  Save to collection after opening
                </label>
              </div>
            </>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              className="flex-1 px-4 py-2 rounded bg-purple-600 hover:bg-purple-500 text-sm font-medium"
            >
              {mode === 'current' ? 'Save' : 'Open Julia'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded bg-gray-700 hover:bg-gray-600 text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
