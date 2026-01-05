import { useEffect, useCallback, useState } from 'react';
import { useFractalStore } from '../../store/fractalStore';
import { PRESET_PALETTES, type ColorPalette, type RGB, rgbToHex, hexToRgb } from '../../lib/colors';

export function ColorPaletteSelector() {
  const {
    showColorSelector,
    setShowColorSelector,
    currentPaletteId,
    setCurrentPaletteId,
    colorTemperature,
    setColorTemperature,
    customPalettes,
    addCustomPalette,
    removeCustomPalette,
    updateCustomPalette,
  } = useFractalStore();

  const [showCustomBuilder, setShowCustomBuilder] = useState(false);
  const [editingPaletteId, setEditingPaletteId] = useState<string | null>(null);
  const [customName, setCustomName] = useState('');
  const [customColors, setCustomColors] = useState<RGB[]>([
    { r: 0, g: 128, b: 128 },
    { r: 128, g: 0, b: 128 },
    { r: 255, g: 0, b: 64 },
  ]);

  const allPalettes: ColorPalette[] = [
    ...PRESET_PALETTES,
    ...customPalettes.map(p => ({ ...p, isCustom: true })),
  ];

  const handleClose = useCallback(() => {
    setShowColorSelector(false);
    setShowCustomBuilder(false);
    setEditingPaletteId(null);
  }, [setShowColorSelector]);

  const handleSelect = useCallback((id: string) => {
    setCurrentPaletteId(id);
  }, [setCurrentPaletteId]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (showCustomBuilder) {
        setShowCustomBuilder(false);
        setEditingPaletteId(null);
      } else {
        handleClose();
      }
    }
  }, [handleClose, showCustomBuilder]);

  useEffect(() => {
    if (showColorSelector) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [showColorSelector, handleKeyDown]);

  const handleTemperatureChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setColorTemperature(parseFloat(e.target.value));
  };

  const handleAddColor = () => {
    if (customColors.length < 10) {
      setCustomColors([...customColors, { r: 128, g: 128, b: 128 }]);
    }
  };

  const handleRemoveColor = (index: number) => {
    if (customColors.length > 2) {
      setCustomColors(customColors.filter((_, i) => i !== index));
    }
  };

  const handleColorChange = (index: number, hex: string) => {
    const newColors = [...customColors];
    newColors[index] = hexToRgb(hex);
    setCustomColors(newColors);
  };

  const handleSaveCustomPalette = async () => {
    const name = customName.trim() || `Custom ${customPalettes.length + 1}`;

    if (editingPaletteId) {
      await updateCustomPalette(editingPaletteId, { name, colors: customColors });
    } else {
      const id = `custom-${Date.now()}`;
      await addCustomPalette({ id, name, colors: customColors });
      setCurrentPaletteId(id);
    }

    setShowCustomBuilder(false);
    setEditingPaletteId(null);
    setCustomName('');
    setCustomColors([
      { r: 0, g: 128, b: 128 },
      { r: 128, g: 0, b: 128 },
      { r: 255, g: 0, b: 64 },
    ]);
  };

  const handleEditPalette = (palette: ColorPalette) => {
    setEditingPaletteId(palette.id);
    setCustomName(palette.name);
    setCustomColors([...palette.colors]);
    setShowCustomBuilder(true);
  };

  const handleDeletePalette = async (id: string) => {
    await removeCustomPalette(id);
    if (currentPaletteId === id) {
      setCurrentPaletteId('default');
    }
  };

  const renderPalettePreview = (colors: RGB[]) => {
    return (
      <div className="flex h-4 rounded overflow-hidden">
        {colors.map((color, i) => (
          <div
            key={i}
            className="flex-1"
            style={{ backgroundColor: rgbToHex(color) }}
          />
        ))}
      </div>
    );
  };

  if (!showColorSelector) return null;

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={handleClose}
    >
      <div
        className="bg-gray-900 rounded-xl shadow-2xl border border-gray-700 max-w-lg w-full max-h-[85vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <div>
            <h2 className="text-xl font-semibold text-gray-100">
              {showCustomBuilder ? (editingPaletteId ? 'Edit Palette' : 'Create Custom Palette') : 'Color Palette'}
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              {showCustomBuilder ? 'Design your own color scheme' : 'Select a color scheme for the fractal'}
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

        <div className="overflow-y-auto flex-1 p-4">
          {showCustomBuilder ? (
            /* Custom palette builder */
            <div className="space-y-4">
              {/* Start from existing palette - only show when creating new */}
              {!editingPaletteId && (
                <div>
                  <label className="block text-sm text-gray-300 mb-2">Start from (optional)</label>
                  <select
                    onChange={(e) => {
                      const paletteId = e.target.value;
                      if (paletteId) {
                        const palette = allPalettes.find(p => p.id === paletteId);
                        if (palette) {
                          setCustomColors([...palette.colors]);
                        }
                      }
                    }}
                    className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-600 text-sm focus:outline-none focus:border-blue-500"
                    defaultValue=""
                  >
                    <option value="">Start from scratch</option>
                    <optgroup label="Preset Palettes">
                      {PRESET_PALETTES.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </optgroup>
                    {customPalettes.length > 0 && (
                      <optgroup label="Custom Palettes">
                        {customPalettes.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm text-gray-300 mb-2">Palette Name</label>
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder={`Custom ${customPalettes.length + 1}`}
                  className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-600 text-sm focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm text-gray-300">Colors ({customColors.length}/10)</label>
                  <button
                    onClick={handleAddColor}
                    disabled={customColors.length >= 10}
                    className="text-xs px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Add Color
                  </button>
                </div>

                <div className="space-y-2">
                  {customColors.map((color, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <input
                        type="color"
                        value={rgbToHex(color)}
                        onChange={(e) => handleColorChange(index, e.target.value)}
                        className="w-12 h-8 rounded border border-gray-600 cursor-pointer bg-transparent"
                      />
                      <div className="flex-1 px-2 py-1 rounded bg-gray-800 text-sm text-gray-300">
                        {rgbToHex(color).toUpperCase()}
                      </div>
                      <button
                        onClick={() => handleRemoveColor(index)}
                        disabled={customColors.length <= 2}
                        className="p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-red-400 disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-300 mb-2">Preview</label>
                <div className="p-2 rounded bg-gray-800">
                  {renderPalettePreview(customColors)}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => {
                    setShowCustomBuilder(false);
                    setEditingPaletteId(null);
                  }}
                  className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveCustomPalette}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm transition-colors"
                >
                  {editingPaletteId ? 'Update' : 'Save'} Palette
                </button>
              </div>
            </div>
          ) : (
            /* Palette selection */
            <div className="space-y-4">
              {/* Temperature slider */}
              <div className="bg-gray-800 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm text-gray-300">Color Temperature</label>
                  <span className="text-xs text-gray-400">
                    {colorTemperature === 0 ? 'Neutral' : colorTemperature > 0 ? 'Warmer' : 'Cooler'}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-blue-400 text-sm">Cool</span>
                  <input
                    type="range"
                    min="-1"
                    max="1"
                    step="0.1"
                    value={colorTemperature}
                    onChange={handleTemperatureChange}
                    className="flex-1 h-2 bg-gradient-to-r from-blue-500 via-gray-500 to-orange-500 rounded-lg appearance-none cursor-pointer"
                  />
                  <span className="text-orange-400 text-sm">Warm</span>
                </div>
                <button
                  onClick={() => setColorTemperature(0)}
                  className="mt-2 text-xs text-gray-400 hover:text-gray-200 transition-colors"
                >
                  Reset to Neutral
                </button>
              </div>

              {/* Preset palettes */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-300">Preset Palettes</h3>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {PRESET_PALETTES.map((palette) => (
                    <button
                      key={palette.id}
                      onClick={() => handleSelect(palette.id)}
                      className={`p-3 rounded-lg text-left transition-all ${
                        currentPaletteId === palette.id
                          ? 'bg-blue-600 ring-2 ring-blue-400'
                          : 'bg-gray-800 hover:bg-gray-700'
                      }`}
                    >
                      <div className="text-sm font-medium mb-2">{palette.name}</div>
                      {renderPalettePreview(palette.colors)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom palettes */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-300">Custom Palettes</h3>
                  <button
                    onClick={() => setShowCustomBuilder(true)}
                    className="text-xs px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 transition-colors"
                  >
                    + New
                  </button>
                </div>
                {customPalettes.length === 0 ? (
                  <div className="text-sm text-gray-500 text-center py-4 bg-gray-800/50 rounded-lg">
                    No custom palettes yet
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {customPalettes.map((palette) => (
                      <div
                        key={palette.id}
                        className={`p-3 rounded-lg transition-all relative group ${
                          currentPaletteId === palette.id
                            ? 'bg-blue-600 ring-2 ring-blue-400'
                            : 'bg-gray-800 hover:bg-gray-700'
                        }`}
                      >
                        <button
                          onClick={() => handleSelect(palette.id)}
                          className="w-full text-left"
                        >
                          <div className="text-sm font-medium mb-2 pr-12">{palette.name}</div>
                          {renderPalettePreview(palette.colors)}
                        </button>
                        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditPalette({ ...palette, isCustom: true });
                            }}
                            className="p-1 rounded bg-gray-700 hover:bg-gray-600"
                            title="Edit palette"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeletePalette(palette.id);
                            }}
                            className="p-1 rounded bg-gray-700 hover:bg-red-600"
                            title="Delete palette"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {!showCustomBuilder && (
          <div className="px-6 py-4 border-t border-gray-700 bg-gray-800/50">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-400">
                Current: <span className="text-gray-200 font-medium">
                  {allPalettes.find(p => p.id === currentPaletteId)?.name || 'Default'}
                </span>
              </div>
              <button
                onClick={handleClose}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
