import { useState } from 'react';
import { useFractalStore } from '../../store/fractalStore';
import type { SavedJulia } from '../../types';

interface EditingPoint {
  id: number;
  name: string;
  real: string;
  imag: string;
}

interface SavedPointsListProps {
  compact?: boolean;
  sortedJulias?: SavedJulia[];
}

export function SavedPointsList({ compact = false, sortedJulias }: SavedPointsListProps) {
  const {
    savedJulias,
    loadSavedJulia,
    removeSavedJulia,
    updateSavedJulia,
  } = useFractalStore();

  // Use sortedJulias if provided, otherwise fall back to store's savedJulias
  const displayJulias = sortedJulias ?? savedJulias;

  const [editingPoint, setEditingPoint] = useState<EditingPoint | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(null);

  const handleEdit = (point: SavedJulia) => {
    if (!point.id) return;
    setEditingPoint({
      id: point.id,
      name: point.name,
      real: point.constant.real.toString(),
      imag: point.constant.imag.toString(),
    });
  };

  const handleSaveEdit = async () => {
    if (!editingPoint) return;

    const real = parseFloat(editingPoint.real);
    const imag = parseFloat(editingPoint.imag);

    if (isNaN(real) || isNaN(imag)) {
      alert('Invalid coordinates');
      return;
    }

    await updateSavedJulia(editingPoint.id, {
      name: editingPoint.name,
      constant: { real, imag },
    });

    setEditingPoint(null);
  };

  const handleCancelEdit = () => {
    setEditingPoint(null);
  };

  const handleDelete = async (id: number) => {
    await removeSavedJulia(id);
    setShowDeleteConfirm(null);
  };

  if (displayJulias.length === 0) {
    return (
      <div className="text-xs text-gray-500 text-center py-2">
        No saved points yet.
        <br />
        Press Space in Julia mode to save.
      </div>
    );
  }

  // Compact view - 3-column grid with small thumbnails
  if (compact) {
    return (
      <div className="grid grid-cols-3 gap-1">
        {displayJulias.map((point) => {
          const isDeleting = showDeleteConfirm === point.id;

          if (isDeleting) {
            return (
              <div key={point.id} className="bg-gray-800 rounded p-1 text-center">
                <div className="text-xs text-gray-300 mb-1">Delete?</div>
                <div className="flex gap-1 justify-center">
                  <button
                    onClick={() => point.id && handleDelete(point.id)}
                    className="px-2 py-0.5 rounded bg-red-600 hover:bg-red-500 text-xs"
                  >
                    Yes
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(null)}
                    className="px-2 py-0.5 rounded bg-gray-600 hover:bg-gray-500 text-xs"
                  >
                    No
                  </button>
                </div>
              </div>
            );
          }

          return (
            <div
              key={point.id}
              className="bg-gray-800 hover:bg-gray-700 rounded overflow-hidden cursor-pointer group relative"
              onClick={() => point.id && loadSavedJulia(point.id)}
              title={`${point.name}\nEq${point.equationId}: ${point.constant.real.toFixed(4)}, ${point.constant.imag.toFixed(4)}i`}
            >
              {/* Thumbnail */}
              <div className="aspect-video bg-black">
                {point.thumbnail ? (
                  <img
                    src={point.thumbnail}
                    alt={point.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-600 text-xs">
                    ?
                  </div>
                )}
              </div>
              {/* Label overlay */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-1 py-0.5">
                <div className="text-xs text-gray-200 truncate leading-tight">{point.name}</div>
                <div className="text-xs text-purple-400 leading-tight">E{point.equationId}</div>
              </div>
              {/* Delete button on hover */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDeleteConfirm(point.id ?? null);
                }}
                className="absolute top-0.5 right-0.5 p-0.5 rounded bg-black/50 hover:bg-red-900/80 text-gray-400 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                title="Delete"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          );
        })}
      </div>
    );
  }

  // Detailed view with thumbnails
  return (
    <div className="space-y-2">
      {displayJulias.map((point) => {
        const isEditing = editingPoint?.id === point.id;
        const isDeleting = showDeleteConfirm === point.id;

        return (
          <div
            key={point.id}
            className="bg-gray-800 rounded-lg overflow-hidden"
          >
            {isEditing ? (
              // Edit mode
              <div className="p-2 space-y-2">
                <input
                  type="text"
                  value={editingPoint!.name}
                  onChange={(e) =>
                    setEditingPoint((prev) => prev ? { ...prev, name: e.target.value } : null)
                  }
                  className="w-full px-2 py-1 rounded bg-gray-700 border border-gray-600 text-xs focus:outline-none focus:border-blue-500"
                  placeholder="Name"
                />
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={editingPoint!.real}
                    onChange={(e) =>
                      setEditingPoint((prev) => prev ? { ...prev, real: e.target.value } : null)
                    }
                    className="flex-1 px-2 py-1 rounded bg-gray-700 border border-gray-600 text-xs focus:outline-none focus:border-blue-500"
                    placeholder="Real"
                  />
                  <input
                    type="text"
                    value={editingPoint!.imag}
                    onChange={(e) =>
                      setEditingPoint((prev) => prev ? { ...prev, imag: e.target.value } : null)
                    }
                    className="flex-1 px-2 py-1 rounded bg-gray-700 border border-gray-600 text-xs focus:outline-none focus:border-blue-500"
                    placeholder="Imag"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveEdit}
                    className="flex-1 px-2 py-1 rounded bg-blue-600 hover:bg-blue-500 text-xs"
                  >
                    Save
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    className="flex-1 px-2 py-1 rounded bg-gray-600 hover:bg-gray-500 text-xs"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : isDeleting ? (
              // Delete confirmation
              <div className="p-2 space-y-2">
                <div className="text-xs text-gray-300">Delete this point?</div>
                <div className="flex gap-2">
                  <button
                    onClick={() => point.id && handleDelete(point.id)}
                    className="flex-1 px-2 py-1 rounded bg-red-600 hover:bg-red-500 text-xs"
                  >
                    Delete
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(null)}
                    className="flex-1 px-2 py-1 rounded bg-gray-600 hover:bg-gray-500 text-xs"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              // Normal display
              <div className="flex">
                {/* Thumbnail */}
                <div
                  className="w-16 h-10 flex-shrink-0 bg-black cursor-pointer"
                  onClick={() => point.id && loadSavedJulia(point.id)}
                >
                  {point.thumbnail ? (
                    <img
                      src={point.thumbnail}
                      alt={point.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-600 text-xs">
                      No preview
                    </div>
                  )}
                </div>

                {/* Info */}
                <div
                  className="flex-1 px-2 py-1 cursor-pointer hover:bg-gray-700"
                  onClick={() => point.id && loadSavedJulia(point.id)}
                >
                  <div className="text-xs text-gray-200 truncate">
                    {point.name}
                  </div>
                  <div className="text-xs text-gray-500 truncate">
                    <span className="text-purple-400">Eq{point.equationId}</span>{' '}
                    {point.constant.real.toFixed(3)}, {point.constant.imag.toFixed(3)}i
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col justify-center px-1 gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEdit(point);
                    }}
                    className="p-1 rounded hover:bg-gray-700 text-gray-500 hover:text-gray-300"
                    title="Edit"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowDeleteConfirm(point.id ?? null);
                    }}
                    className="p-1 rounded hover:bg-red-900/50 text-gray-500 hover:text-red-400"
                    title="Delete"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
