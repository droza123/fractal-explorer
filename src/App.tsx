import { useEffect } from 'react';
import { FractalCanvas } from './components/FractalCanvas';
import { HeatmapExplorer } from './components/HeatmapExplorer';
import { Mandelbulb3D } from './components/Mandelbulb3D';
import { Toolbar } from './components/Toolbar';
import { EquationSelector } from './components/EquationSelector';
import { ColorPaletteSelector } from './components/ColorPaletteSelector';
import { ExportDialog } from './components/ExportDialog';
import { VideoExportDialog } from './components/VideoExportDialog';
import { SavedAnimationsDialog } from './components/SavedAnimationsDialog';
import { SavedJuliasDialog } from './components/SavedJuliasDialog';
import { HelpDialog } from './components/HelpDialog';
import { useFractalStore } from './store/fractalStore';

function App() {
  const fractalType = useFractalStore((state) => state.fractalType);
  const loadSavedJuliasFromDb = useFractalStore((state) => state.loadSavedJuliasFromDb);
  const loadCustomPalettesFromDb = useFractalStore((state) => state.loadCustomPalettesFromDb);
  const loadAnimationsFromDb = useFractalStore((state) => state.loadAnimationsFromDb);

  // Load saved julias, custom palettes, and animations from database on startup
  useEffect(() => {
    loadSavedJuliasFromDb();
    loadCustomPalettesFromDb();
    loadAnimationsFromDb();
  }, [loadSavedJuliasFromDb, loadCustomPalettesFromDb, loadAnimationsFromDb]);

  const renderFractalView = () => {
    switch (fractalType) {
      case 'heatmap':
        return <HeatmapExplorer />;
      case 'mandelbulb':
        return <Mandelbulb3D />;
      default:
        return <FractalCanvas />;
    }
  };

  return (
    <div className="w-full h-screen bg-gray-950 overflow-hidden">
      {renderFractalView()}
      <Toolbar />
      <EquationSelector />
      <ColorPaletteSelector />
      <ExportDialog />
      <VideoExportDialog />
      <SavedAnimationsDialog />
      <SavedJuliasDialog />
      <HelpDialog />
    </div>
  );
}

export default App;
