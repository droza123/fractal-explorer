import { useState } from 'react';
import { useFractalStore } from '../../store/fractalStore';
import { equations } from '../../lib/equations';

interface ManualPointEntryProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ManualPointEntry({ isOpen, onClose }: ManualPointEntryProps) {
  const { equationId, switchToJulia, saveCurrentJulia, setJuliaConstant, setEquationId } = useFractalStore();

  const [name, setName] = useState('');
  const [real, setReal] = useState('');
  const [imag, setImag] = useState('');
  const [selectedEquation, setSelectedEquation] = useState(equationId);
  const [saveAfterOpen, setSaveAfterOpen] = useState(true);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const realNum = parseFloat(real);
    const imagNum = parseFloat(imag);

    if (isNaN(realNum) || isNaN(imagNum)) {
      alert('Please enter valid numbers for real and imaginary parts');
      return;
    }

    const constant = { real: realNum, imag: imagNum };

    // Set the equation first if different
    if (selectedEquation !== equationId) {
      setEquationId(selectedEquation);
    }

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

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={handleBackdropClick}
    >
      <div className="bg-gray-900 rounded-lg p-4 w-80 shadow-xl border border-gray-700">
        <h2 className="text-lg font-medium text-gray-200 mb-4">Add Julia Point</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Name (optional)</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-600 text-sm focus:outline-none focus:border-blue-500"
              placeholder="My Julia Set"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Real (c.re)</label>
              <input
                type="text"
                value={real}
                onChange={(e) => setReal(e.target.value)}
                className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-600 text-sm focus:outline-none focus:border-blue-500"
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
                className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-600 text-sm focus:outline-none focus:border-blue-500"
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
              className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-600 text-sm focus:outline-none focus:border-blue-500"
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

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              className="flex-1 px-4 py-2 rounded bg-purple-600 hover:bg-purple-500 text-sm font-medium"
            >
              Open Julia
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
