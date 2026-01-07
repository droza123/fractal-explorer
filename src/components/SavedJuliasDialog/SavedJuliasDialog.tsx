import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useFractalStore } from '../../store/fractalStore';
import { SavedPointsList } from '../SavedPointsList/SavedPointsList';
import { exportPoints, importPoints } from '../../db/database';

export function SavedJuliasDialog() {
  const {
    showSavedJuliasDialog,
    setShowSavedJuliasDialog,
    savedJulias,
    loadSavedJuliasFromDb,
  } = useFractalStore();

  const [sortByRecent, setSortByRecent] = useState(true);
  const [compactView, setCompactView] = useState(true);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClose = useCallback(() => {
    setShowSavedJuliasDialog(false);
    setImportMessage(null);
  }, [setShowSavedJuliasDialog]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleClose();
    }
  }, [handleClose]);

  useEffect(() => {
    if (showSavedJuliasDialog) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [showSavedJuliasDialog, handleKeyDown]);

  // Sort julias based on current sort mode
  const sortedJulias = useMemo(() => {
    const julias = [...savedJulias];
    if (sortByRecent) {
      // Sort by createdAt descending (most recent first)
      julias.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });
    } else {
      // Sort alphabetically by name
      julias.sort((a, b) => a.name.localeCompare(b.name));
    }
    return julias;
  }, [savedJulias, sortByRecent]);

  const handleExport = async () => {
    const jsonString = await exportPoints();
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `julia-sets-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const result = await importPoints(text);
      await loadSavedJuliasFromDb();
      setImportMessage(`Imported ${result.imported} Julia set${result.imported !== 1 ? 's' : ''}. ${result.skipped} duplicate${result.skipped !== 1 ? 's' : ''} skipped.`);
      setTimeout(() => setImportMessage(null), 3000);
    } catch (error) {
      setImportMessage('Failed to import. Invalid file format.');
      setTimeout(() => setImportMessage(null), 3000);
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  if (!showSavedJuliasDialog) return null;

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
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
            </svg>
            Saved Julia Sets
            <span className="text-sm font-normal text-gray-500">({savedJulias.length})</span>
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
            disabled={savedJulias.length === 0}
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

          {/* Tip */}
          {savedJulias.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
              </svg>
              <p>No saved Julia sets yet</p>
              <p className="text-sm mt-1">Press <kbd className="px-1.5 py-0.5 bg-gray-700 rounded text-gray-300">Space</kbd> in Julia mode to save</p>
            </div>
          )}

          {/* Saved points list */}
          {savedJulias.length > 0 && (
            <SavedPointsList compact={compactView} sortedJulias={sortedJulias} />
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
