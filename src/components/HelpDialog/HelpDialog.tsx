import { useState, useEffect, useCallback } from 'react';
import { useFractalStore } from '../../store/fractalStore';

type TabId = 'how-to-use' | 'features' | 'about';

export function HelpDialog() {
  const { showHelpDialog, setShowHelpDialog } = useFractalStore();
  const [activeTab, setActiveTab] = useState<TabId>('how-to-use');

  const handleClose = useCallback(() => {
    setShowHelpDialog(false);
  }, [setShowHelpDialog]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleClose();
    }
  }, [handleClose]);

  useEffect(() => {
    if (showHelpDialog) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [showHelpDialog, handleKeyDown]);

  if (!showHelpDialog) return null;

  const tabs: { id: TabId; label: string }[] = [
    { id: 'how-to-use', label: 'How to Use' },
    { id: 'features', label: 'Features' },
    { id: 'about', label: 'About' },
  ];

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={handleClose}
    >
      <div
        className="bg-gray-900 rounded-xl shadow-2xl border border-gray-700 w-[90vw] max-w-[600px] max-h-[85vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-600/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-semibold text-gray-100">Help</h2>
              <p className="text-xs sm:text-sm text-gray-400">Learn how to use Fractal Voyager</p>
            </div>
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

        {/* Tab Navigation */}
        <div className="px-4 sm:px-6 py-3 border-b border-gray-700 flex items-center gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0 flex items-center justify-center h-9 ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 hover:bg-gray-700 text-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
          {activeTab === 'how-to-use' && <HowToUseContent />}
          {activeTab === 'features' && <FeaturesContent />}
          {activeTab === 'about' && <AboutContent />}
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-4 border-t border-gray-700 bg-gray-800/50">
          <button
            onClick={handleClose}
            className="w-full px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function HowToUseContent() {
  return (
    <div className="space-y-6">
      {/* Mouse Controls */}
      <section>
        <h3 className="text-sm font-semibold text-blue-400 uppercase tracking-wide mb-3">Mouse Controls</h3>
        <div className="space-y-2">
          <ControlRow action="Zoom in" control="Scroll wheel up or draw selection box" />
          <ControlRow action="Zoom out" control="Scroll wheel down" />
          <ControlRow action="Pan" control="Right-click and drag" />
          <ControlRow action="Open Julia set" control="Double-click" />
        </div>
      </section>

      {/* Touch Controls */}
      <section>
        <h3 className="text-sm font-semibold text-purple-400 uppercase tracking-wide mb-3">Touch Controls</h3>
        <div className="space-y-2">
          <ControlRow action="Pan" control="One-finger drag" />
          <ControlRow action="Zoom" control="Pinch with two fingers" />
          <ControlRow action="Open Julia set" control="Double-tap" />
          <ControlRow action="Preview Julia (Heatmap)" control="One-finger drag explores, two-finger pans" />
        </div>
      </section>

      {/* Keyboard Shortcuts */}
      <section>
        <h3 className="text-sm font-semibold text-green-400 uppercase tracking-wide mb-3">Keyboard Shortcuts</h3>
        <div className="space-y-2">
          <ControlRow action="Quick save Julia" control="Spacebar" />
          <ControlRow action="Freeze preview" control="Hold Ctrl (in Heatmap mode)" />
        </div>
      </section>

      {/* 3D Controls */}
      <section>
        <h3 className="text-sm font-semibold text-orange-400 uppercase tracking-wide mb-3">3D Fractal Controls</h3>
        <div className="space-y-2">
          <ControlRow action="Rotate view" control="Click and drag" />
          <ControlRow action="Zoom in/out" control="Scroll wheel or pinch" />
          <ControlRow action="Change fractal" control="Use equation selector" />
        </div>
      </section>
    </div>
  );
}

function FeaturesContent() {
  return (
    <div className="space-y-6">
      <FeatureSection
        title="Mandelbrot Set"
        color="blue"
        description="The classic Mandelbrot fractal. Explore infinite complexity by zooming into the boundary. Double-click on any point to see its corresponding Julia set."
      />

      <FeatureSection
        title="Julia Sets"
        color="purple"
        description="Each point in the Mandelbrot set corresponds to a unique Julia set. Use the equation selector to explore 57 different fractal formulas, from simple polynomials to exotic trigonometric variants. Save your favorite Julia sets with thumbnails for later."
      />

      <FeatureSection
        title="Heatmap Explorer"
        color="yellow"
        description="Visualize the 'interestingness' of Julia sets across the parameter space. Bright areas indicate visually complex Julia sets. Move your cursor to preview different Julia sets in real-time, hold Ctrl to freeze the preview."
      />

      <FeatureSection
        title="3D Fractals"
        color="orange"
        description="Explore 10 different 3D fractal types: Mandelbulb, Mandelbox, Quaternion Julia, Burning Ship 3D, Tricorn 3D, Menger Sponge, Sierpinski Tetrahedron, Kaleidoscopic IFS, Octahedron IFS, and Icosahedron IFS. Each has unique parameters for power, scale, and camera settings. Adjust lighting and quality for stunning renders."
      />

      <FeatureSection
        title="Animation"
        color="green"
        description="Create smooth zoom animations by adding keyframes. Change equations or iteration levels between keyframes and watch the fractal morph. Save animations for later and export as video to share your journey."
      />

      <FeatureSection
        title="High Precision Mode"
        color="cyan"
        description="When you zoom deep enough, the app automatically switches to high-precision CPU rendering with parallel web workers, allowing you to explore details far beyond normal floating-point limits."
      />

      <FeatureSection
        title="Sharing & Export"
        color="pink"
        description="Share your current view with a URL link that captures all settings. Export high-resolution images of any fractal. Choose from multiple color palettes with temperature adjustment."
      />
    </div>
  );
}

function AboutContent() {
  return (
    <div className="space-y-6">
      {/* App Info */}
      <section className="text-center py-4">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5" />
          </svg>
        </div>
        <h3 className="text-xl font-bold text-gray-100">Fractal Voyager</h3>
        <p className="text-sm text-gray-400 mt-1">Version 1.1</p>
      </section>

      {/* Description */}
      <section>
        <p className="text-sm text-gray-300 text-center leading-relaxed">
          A comprehensive fractal explorer featuring Mandelbrot and Julia sets with 57 equations,
          heatmap visualization, 10 different 3D fractals with ray-marched rendering,
          animation tools, and high-precision deep zoom capabilities.
        </p>
      </section>

      {/* Tech Stack */}
      <section className="bg-gray-800/50 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-gray-200 mb-2">Technology</h4>
        <p className="text-sm text-gray-400">
          Built with React, TypeScript, and WebGL 2.0 for GPU-accelerated rendering.
          Features parallel CPU rendering with Web Workers for high-precision deep zooms,
          IndexedDB for persistent storage, and PWA support for offline use.
        </p>
      </section>

      {/* Feedback & Issues */}
      <section className="bg-gray-800/50 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-gray-200 mb-2">Feedback & Issues</h4>
        <p className="text-sm text-gray-400 mb-3">
          Found a bug or have a feature request? Let us know on GitHub!
        </p>
        <a
          href="https://github.com/droza123/fractal-explorer/issues"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-medium transition-colors"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0012 2z" />
          </svg>
          Report Issue on GitHub
        </a>
      </section>

      {/* Credits */}
      <section className="text-center text-xs text-gray-500 pt-2">
        <p>Created with Claude Code</p>
      </section>
    </div>
  );
}

function ControlRow({ action, control }: { action: string; control: string }) {
  return (
    <div className="flex justify-between items-center py-1.5 px-3 bg-gray-800/50 rounded-lg">
      <span className="text-sm text-gray-300">{action}</span>
      <span className="text-xs text-gray-500 text-right ml-4">{control}</span>
    </div>
  );
}

function FeatureSection({ title, color, description }: { title: string; color: string; description: string }) {
  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-500/20 text-blue-400',
    purple: 'bg-purple-500/20 text-purple-400',
    yellow: 'bg-yellow-500/20 text-yellow-400',
    orange: 'bg-orange-500/20 text-orange-400',
    green: 'bg-green-500/20 text-green-400',
    cyan: 'bg-cyan-500/20 text-cyan-400',
    pink: 'bg-pink-500/20 text-pink-400',
  };

  return (
    <div className="flex gap-3">
      <div className={`w-2 rounded-full flex-shrink-0 ${colorClasses[color]?.split(' ')[0] || 'bg-gray-500/20'}`} />
      <div>
        <h4 className={`text-sm font-semibold mb-1 ${colorClasses[color]?.split(' ')[1] || 'text-gray-400'}`}>
          {title}
        </h4>
        <p className="text-sm text-gray-400 leading-relaxed">{description}</p>
      </div>
    </div>
  );
}
