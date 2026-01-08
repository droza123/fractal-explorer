import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useFractalStore } from '../../store/fractalStore';
import { exportAnimations, importAnimations } from '../../db/animations';

export function SavedAnimationsDialog() {
  const {
    showSavedAnimationsDialog,
    setShowSavedAnimationsDialog,
    savedAnimations,
    loadAnimation,
    deleteAnimation,
    updateSavedAnimation,
    currentAnimationId,
    loadAnimationsFromDb,
  } = useFractalStore();

  const [sortByRecent, setSortByRecent] = useState(true);
  const [compactView, setCompactView] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClose = useCallback(() => {
    setShowSavedAnimationsDialog(false);
    setEditingId(null);
    setDeleteConfirmId(null);
    setImportMessage(null);
  }, [setShowSavedAnimationsDialog]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleClose();
    }
  }, [handleClose]);

  useEffect(() => {
    if (showSavedAnimationsDialog) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [showSavedAnimationsDialog, handleKeyDown]);

  // Sort animations based on current sort mode
  const sortedAnimations = useMemo(() => {
    const animations = [...savedAnimations];
    if (sortByRecent) {
      // Sort by createdAt descending (most recent first)
      animations.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });
    } else {
      // Sort alphabetically by name
      animations.sort((a, b) => a.name.localeCompare(b.name));
    }
    return animations;
  }, [savedAnimations, sortByRecent]);

  const handleLoadAnimation = async (id: number) => {
    await loadAnimation(id);
    handleClose();
  };

  const handleDeleteAnimation = async (id: number) => {
    await deleteAnimation(id);
    setDeleteConfirmId(null);
  };

  const handleStartEdit = (id: number, name: string) => {
    setEditingId(id);
    setEditName(name);
  };

  const handleSaveEdit = async () => {
    if (editingId === null || !editName.trim()) return;
    await updateSavedAnimation(editingId, { name: editName.trim() });
    setEditingId(null);
    setEditName('');
  };

  const handleExport = async () => {
    const jsonString = await exportAnimations();
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `animations-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const result = await importAnimations(text);
      await loadAnimationsFromDb();
      setImportMessage(`Imported ${result.imported} animation${result.imported !== 1 ? 's' : ''}. ${result.skipped} duplicate${result.skipped !== 1 ? 's' : ''} skipped.`);
      setTimeout(() => setImportMessage(null), 3000);
    } catch (error) {
      setImportMessage('Failed to import animations. Invalid file format.');
      setTimeout(() => setImportMessage(null), 3000);
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    }
    return `${seconds}s`;
  };

  if (!showSavedAnimationsDialog) return null;

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={(e) => e.target === e.currentTarget && handleClose()}
    >
      <div
        className="bg-gray-900 rounded-xl shadow-2xl border border-gray-700 w-[520px] max-h-[85vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
            </svg>
            Animation Library
            <span className="text-sm font-normal text-gray-500">({savedAnimations.length})</span>
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Toolbar */}
        <div className="px-4 py-2 border-b border-gray-700/50 flex items-center gap-2">
          {/* Sort toggle */}
          <button
            onClick={() => setSortByRecent(!sortByRecent)}
            className="flex items-center gap-1.5 px-2 py-1.5 rounded bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs transition-colors"
            title={sortByRecent ? 'Sorted by recent' : 'Sorted alphabetically'}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {sortByRecent ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
              )}
            </svg>
            {sortByRecent ? 'Recent' : 'A-Z'}
          </button>

          {/* View toggle */}
          <button
            onClick={() => setCompactView(!compactView)}
            className="flex items-center gap-1.5 px-2 py-1.5 rounded bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs transition-colors"
            title={compactView ? 'Compact view' : 'Detailed view'}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {compactView ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              )}
            </svg>
            {compactView ? 'Grid' : 'List'}
          </button>

          <div className="flex-1" />

          {/* Import/Export */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-2 py-1.5 rounded bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs transition-colors"
            title="Import from file"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Import
          </button>
          <button
            onClick={handleExport}
            disabled={savedAnimations.length === 0}
            className="flex items-center gap-1.5 px-2 py-1.5 rounded bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-gray-300 text-xs transition-colors"
            title="Export to file"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Export
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleImport}
            className="hidden"
          />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {/* Import message */}
          {importMessage && (
            <div className="bg-blue-900/30 text-blue-400 text-sm px-3 py-2 rounded-lg mb-4">
              {importMessage}
            </div>
          )}

          {/* Empty state */}
          {savedAnimations.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
              </svg>
              <p>No saved animations yet</p>
              <p className="text-sm mt-1">Use the Save button in the Animation panel</p>
            </div>
          ) : (
            <div className={compactView ? 'grid grid-cols-2 gap-2' : 'space-y-2'}>
              {sortedAnimations.map((animation) => (
                <div
                  key={animation.id}
                  className={`bg-gray-800/50 rounded-lg group hover:bg-gray-800 transition-colors ${
                    currentAnimationId === animation.id ? 'ring-2 ring-purple-500' : ''
                  } ${compactView ? 'p-2 flex flex-col' : 'p-3 flex items-center gap-3'}`}
                >
                  {/* Thumbnail (first keyframe) */}
                  <div className={`bg-gray-700 rounded overflow-hidden flex-shrink-0 ${
                    compactView ? 'w-full aspect-video mb-2' : 'w-16 h-10'
                  }`}>
                    {animation.keyframes[0]?.thumbnail ? (
                      <img
                        src={animation.keyframes[0].thumbnail}
                        alt={animation.name}
                        className="w-full h-full object-cover cursor-pointer"
                        onClick={() => handleLoadAnimation(animation.id!)}
                      />
                    ) : (
                      <div
                        className="w-full h-full flex items-center justify-center text-gray-500 cursor-pointer"
                        onClick={() => handleLoadAnimation(animation.id!)}
                      >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className={compactView ? 'flex-1' : 'flex-1 min-w-0'}>
                    {editingId === animation.id ? (
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onBlur={handleSaveEdit}
                        onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()}
                        className="w-full bg-gray-700 text-white text-xs px-2 py-1 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                        autoFocus
                      />
                    ) : (
                      <div
                        className={`font-medium text-white truncate cursor-pointer hover:text-purple-400 ${
                          compactView ? 'text-xs' : 'text-sm'
                        }`}
                        onClick={() => handleLoadAnimation(animation.id!)}
                        title="Click to load"
                      >
                        {animation.name}
                      </div>
                    )}
                    <div className={`text-gray-500 ${compactView ? 'text-[10px]' : 'text-xs'}`}>
                      {animation.keyframes.length} keyframes · {formatDuration(animation.totalDuration)}
                    </div>
                  </div>

                  {/* Actions - only show in list view or on hover in grid */}
                  <div className={`flex gap-1 transition-opacity ${
                    compactView ? 'mt-1 opacity-0 group-hover:opacity-100' : 'opacity-0 group-hover:opacity-100'
                  }`}>
                    {deleteConfirmId === animation.id ? (
                      <>
                        <button
                          onClick={() => handleDeleteAnimation(animation.id!)}
                          className="p-1 rounded bg-red-600 hover:bg-red-500 text-white transition-colors"
                          title="Confirm delete"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(null)}
                          className="p-1 rounded bg-gray-600 hover:bg-gray-500 text-white transition-colors"
                          title="Cancel"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => handleStartEdit(animation.id!, animation.name)}
                          className="p-1 rounded hover:bg-gray-600 text-gray-400 hover:text-blue-400 transition-colors"
                          title="Rename"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(animation.id!)}
                          className="p-1 rounded hover:bg-gray-600 text-gray-400 hover:text-red-400 transition-colors"
                          title="Delete"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-700">
          <button
            onClick={handleClose}
            className="w-full px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
