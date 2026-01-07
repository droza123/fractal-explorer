// Thumbnail generator for animation keyframes

const THUMBNAIL_WIDTH = 120;
const THUMBNAIL_HEIGHT = 67; // ~16:9 aspect ratio
const THUMBNAIL_QUALITY = 0.7;

export interface ThumbnailConfig {
  sourceCanvas: HTMLCanvasElement;
  width?: number;
  height?: number;
  quality?: number;
}

// Generate a thumbnail from a canvas
export function generateThumbnail(config: ThumbnailConfig): string | null {
  const {
    sourceCanvas,
    width = THUMBNAIL_WIDTH,
    height = THUMBNAIL_HEIGHT,
    quality = THUMBNAIL_QUALITY,
  } = config;

  try {
    // Create thumbnail canvas
    const thumbCanvas = document.createElement('canvas');
    thumbCanvas.width = width;
    thumbCanvas.height = height;

    const ctx = thumbCanvas.getContext('2d');
    if (!ctx) {
      console.warn('Could not get 2D context for thumbnail');
      return null;
    }

    // Draw scaled image
    ctx.drawImage(sourceCanvas, 0, 0, width, height);

    // Convert to data URL
    return thumbCanvas.toDataURL('image/jpeg', quality);
  } catch (error) {
    console.error('Failed to generate thumbnail:', error);
    return null;
  }
}

// Generate thumbnail from the current canvas in the store
export function generateKeyframeThumbnail(thumbnailCanvas: HTMLCanvasElement | null): string | null {
  if (!thumbnailCanvas) {
    console.warn('No thumbnail canvas available');
    return null;
  }

  return generateThumbnail({ sourceCanvas: thumbnailCanvas });
}

// Generate multiple thumbnails (e.g., for batch export)
export function generateThumbnails(
  canvases: HTMLCanvasElement[],
  config?: Omit<ThumbnailConfig, 'sourceCanvas'>
): (string | null)[] {
  return canvases.map((canvas) =>
    generateThumbnail({ ...config, sourceCanvas: canvas })
  );
}

// Estimate the size of a thumbnail in bytes (rough estimate)
export function estimateThumbnailSize(): number {
  // JPEG at 70% quality, 120x67 pixels
  // Rough estimate: ~3KB per thumbnail
  return 3 * 1024;
}
