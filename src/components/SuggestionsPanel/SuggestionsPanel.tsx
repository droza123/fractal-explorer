import { useEffect, useCallback } from 'react';
import { useFractalStore } from '../../store/fractalStore';
import { getCategoryColor, getCategoryIcon } from '../../lib/suggestions';
import type { SuggestedPoint } from '../../types';

export function SuggestionsPanel() {
  const {
    suggestions,
    isLoadingSuggestions,
    showSuggestionsPanel,
    highlightedSuggestion,
    setShowSuggestionsPanel,
    setHighlightedSuggestion,
    generateSuggestions,
    setHeatmapPreviewConstant,
    switchToJulia,
    fractalType,
  } = useFractalStore();

  // Generate suggestions when panel opens
  useEffect(() => {
    if (showSuggestionsPanel && suggestions.length === 0 && !isLoadingSuggestions) {
      generateSuggestions();
    }
  }, [showSuggestionsPanel, suggestions.length, isLoadingSuggestions, generateSuggestions]);

  const handleRefresh = useCallback(() => {
    generateSuggestions();
  }, [generateSuggestions]);

  const handleMouseEnter = useCallback((suggestion: SuggestedPoint) => {
    setHighlightedSuggestion(suggestion.id);
    setHeatmapPreviewConstant(suggestion.point);
  }, [setHighlightedSuggestion, setHeatmapPreviewConstant]);

  const handleMouseLeave = useCallback(() => {
    setHighlightedSuggestion(null);
  }, [setHighlightedSuggestion]);

  // Click/tap just previews (same as hover)
  const handleClick = useCallback((suggestion: SuggestedPoint) => {
    setHighlightedSuggestion(suggestion.id);
    setHeatmapPreviewConstant(suggestion.point);
  }, [setHighlightedSuggestion, setHeatmapPreviewConstant]);

  // Double-click opens Julia view (mouse users)
  const handleDoubleClick = useCallback((suggestion: SuggestedPoint) => {
    switchToJulia(suggestion.point);
  }, [switchToJulia]);

  // Don't render in non-heatmap mode
  if (fractalType !== 'heatmap') return null;

  if (!showSuggestionsPanel) {
    return (
      <button
        onClick={() => setShowSuggestionsPanel(true)}
        className="absolute top-4 right-4 bg-gray-800/90 hover:bg-gray-700 text-white px-3 py-2 rounded-lg shadow-lg flex items-center gap-2 text-sm transition-colors z-10"
        title="Show AI Suggestions"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
        AI Suggestions
      </button>
    );
  }

  return (
    <div className="absolute top-4 right-4 w-72 max-h-[calc(100vh-200px)] bg-gray-800/95 backdrop-blur-sm rounded-lg shadow-xl overflow-hidden z-10">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          <span className="font-medium text-white">AI Suggestions</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleRefresh}
            disabled={isLoadingSuggestions}
            className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors disabled:opacity-50"
            title="Refresh suggestions"
          >
            <svg className={`w-4 h-4 ${isLoadingSuggestions ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
          <button
            onClick={() => setShowSuggestionsPanel(false)}
            className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors"
            title="Close panel"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="overflow-y-auto max-h-[400px]">
        {isLoadingSuggestions ? (
          <div className="p-4 text-center text-gray-400">
            <svg className="w-8 h-8 mx-auto mb-2 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Analyzing region...
          </div>
        ) : suggestions.length === 0 ? (
          <div className="p-4 text-center text-gray-400">
            <p className="mb-2">No interesting points found</p>
            <p className="text-sm">Try zooming to a different region</p>
          </div>
        ) : (
          <div className="p-2">
            <p className="text-xs text-gray-500 px-2 mb-2">
              Hover to preview, double-click to explore
            </p>
            {suggestions.map((suggestion) => (
              <SuggestionItem
                key={suggestion.id}
                suggestion={suggestion}
                isHighlighted={highlightedSuggestion === suggestion.id}
                onMouseEnter={() => handleMouseEnter(suggestion)}
                onMouseLeave={handleMouseLeave}
                onClick={() => handleClick(suggestion)}
                onDoubleClick={() => handleDoubleClick(suggestion)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer with legend */}
      <div className="p-2 border-t border-gray-700">
        <div className="flex justify-center gap-4 text-xs text-gray-400">
          <span className="flex items-center gap-1">
            <span style={{ color: getCategoryColor('classic') }}>★</span> Classic
          </span>
          <span className="flex items-center gap-1">
            <span style={{ color: getCategoryColor('boundary') }}>◐</span> Boundary
          </span>
          <span className="flex items-center gap-1">
            <span style={{ color: getCategoryColor('high-variance') }}>◆</span> Variance
          </span>
        </div>
      </div>
    </div>
  );
}

interface SuggestionItemProps {
  suggestion: SuggestedPoint;
  isHighlighted: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onClick: () => void;
  onDoubleClick: () => void;
}

function SuggestionItem({ suggestion, isHighlighted, onMouseEnter, onMouseLeave, onClick, onDoubleClick }: SuggestionItemProps) {
  const categoryColor = getCategoryColor(suggestion.category);
  const categoryIcon = getCategoryIcon(suggestion.category);

  return (
    <button
      className={`w-full text-left p-2 rounded-lg mb-1 transition-all ${
        isHighlighted
          ? 'bg-gray-600/80 ring-1 ring-white/30'
          : 'bg-gray-700/50 hover:bg-gray-700'
      }`}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
    >
      <div className="flex items-start gap-2">
        <span
          className="text-lg flex-shrink-0 mt-0.5"
          style={{ color: categoryColor }}
        >
          {categoryIcon}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-white truncate">
              {suggestion.description}
            </span>
            <span
              className="text-xs px-1.5 py-0.5 rounded ml-2 flex-shrink-0"
              style={{ backgroundColor: categoryColor + '30', color: categoryColor }}
            >
              {Math.round(suggestion.score * 100)}%
            </span>
          </div>
          <div className="text-xs text-gray-400 font-mono mt-0.5">
            {suggestion.point.real.toFixed(6)} {suggestion.point.imag >= 0 ? '+' : ''}{suggestion.point.imag.toFixed(6)}i
          </div>
        </div>
      </div>
    </button>
  );
}
