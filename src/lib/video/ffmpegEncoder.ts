// FFmpeg.wasm-based MP4 encoder for high-quality video export
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';
import type { VideoExportSettings } from '../../types';
import { getResolutionDimensions } from './frameRenderer';

export interface FFmpegProgress {
  phase: 'loading' | 'rendering' | 'writing' | 'encoding' | 'finalizing' | 'complete';
  phasePercent: number;      // Progress within current phase (0-100)
  overallPercent: number;    // Overall progress (0-100)
  currentFrame?: number;
  totalFrames?: number;
  message: string;
}

export interface FFmpegEncoderConfig {
  width: number;
  height: number;
  fps: number;
  quality: number; // 0-1, higher = better quality
  totalFrames: number;
  onProgress?: (progress: FFmpegProgress) => void;
}

export interface FFmpegEncoderResult {
  blob: Blob;
  duration: number;
}

// Singleton FFmpeg instance (reuse across exports)
let ffmpegInstance: FFmpeg | null = null;
let ffmpegLoaded = false;
let ffmpegLoading: Promise<void> | null = null;
let currentProgressCallback: ((progress: number) => void) | null = null;
let currentFrameCallback: ((frame: number) => void) | null = null;

// Load FFmpeg.wasm (lazy loading)
async function loadFFmpeg(onProgress?: (percent: number) => void): Promise<FFmpeg> {
  if (ffmpegInstance && ffmpegLoaded) {
    return ffmpegInstance;
  }

  if (ffmpegLoading) {
    await ffmpegLoading;
    return ffmpegInstance!;
  }

  ffmpegInstance = new FFmpeg();

  ffmpegLoading = (async () => {
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';

    // Log handler - also parses frame progress during encoding
    ffmpegInstance!.on('log', ({ message }) => {
      console.log('[FFmpeg]', message);

      // Parse frame number from log messages like "frame=   60 fps=2.8 q=24.0..."
      if (currentFrameCallback) {
        const frameMatch = message.match(/frame=\s*(\d+)/);
        if (frameMatch) {
          const frameNum = parseInt(frameMatch[1], 10);
          currentFrameCallback(frameNum);
        }
      }
    });

    // Progress handler that can be updated for different phases
    ffmpegInstance!.on('progress', ({ progress }) => {
      console.log('[FFmpeg] Encoding progress:', progress);
      if (currentProgressCallback) {
        currentProgressCallback(progress * 100);
      }
    });

    console.log('[FFmpeg] Starting to download core files from CDN...');
    onProgress?.(5);

    try {
      console.log('[FFmpeg] Downloading ffmpeg-core.js...');
      const coreURL = await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript');
      console.log('[FFmpeg] Downloaded ffmpeg-core.js');
      onProgress?.(30);

      console.log('[FFmpeg] Downloading ffmpeg-core.wasm (~25MB)...');
      const wasmURL = await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm');
      console.log('[FFmpeg] Downloaded ffmpeg-core.wasm');
      onProgress?.(70);

      console.log('[FFmpeg] Loading FFmpeg...');
      await ffmpegInstance!.load({
        coreURL,
        wasmURL,
      });
      console.log('[FFmpeg] FFmpeg loaded successfully!');
      onProgress?.(100);

      ffmpegLoaded = true;
    } catch (error) {
      console.error('[FFmpeg] Failed to load:', error);
      throw new Error(`Failed to load FFmpeg: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  })();

  await ffmpegLoading;
  return ffmpegInstance!;
}

// Check if FFmpeg can be loaded
export function isFFmpegSupported(): boolean {
  return typeof WebAssembly !== 'undefined';
}

// Check if File System Access API is available
export function isFileSystemAccessSupported(): boolean {
  return 'showDirectoryPicker' in window;
}

export class FFmpegEncoder {
  private config: FFmpegEncoderConfig;
  private frames: Uint8Array[] = [];
  private frameCount: number = 0;
  private ffmpeg: FFmpeg | null = null;
  private aborted: boolean = false;
  private directoryHandle: FileSystemDirectoryHandle | null = null;
  private useFileSystem: boolean = false;
  private finalizingTimer: number | null = null;
  private finalizingStartTime: number = 0;

  constructor(config: FFmpegEncoderConfig) {
    this.config = config;
  }

  // Estimate finalization time based on video characteristics
  private estimateFinalizingTime(): number {
    const { width, height, totalFrames, fps } = this.config;
    const duration = totalFrames / fps;
    const pixelCount = width * height;

    // Base estimate: 30 seconds minimum
    // Add time based on resolution and duration
    // Higher resolution = more data to rewrite for faststart
    // Longer duration = larger file = more time
    const resolutionFactor = pixelCount / (1920 * 1080); // Relative to 1080p
    const durationFactor = Math.max(1, duration / 10); // Scale up for longer videos

    const estimatedMs = 30000 + (resolutionFactor * durationFactor * 15000);
    return Math.min(estimatedMs, 180000); // Cap at 3 minutes
  }

  // Start simulated progress for finalization phase
  private startFinalizingProgress(): void {
    this.finalizingStartTime = Date.now();
    const estimatedTime = this.estimateFinalizingTime();

    const updateProgress = () => {
      if (this.aborted || this.finalizingTimer === null) return;

      const elapsed = Date.now() - this.finalizingStartTime;
      // Progress from 0 to 99% over the estimated time
      const progress = Math.min(99, (elapsed / estimatedTime) * 100);

      this.reportProgress('finalizing', progress, 'Finalizing video...');

      // Continue updating if we haven't reached 99%
      if (progress < 99) {
        this.finalizingTimer = window.setTimeout(updateProgress, 500) as unknown as number;
      }
    };

    // Start the progress updates
    this.finalizingTimer = window.setTimeout(updateProgress, 500) as unknown as number;
  }

  // Stop the simulated finalization progress
  private stopFinalizingProgress(): void {
    if (this.finalizingTimer !== null) {
      clearTimeout(this.finalizingTimer);
      this.finalizingTimer = null;
    }
  }

  private reportProgress(
    phase: FFmpegProgress['phase'],
    phasePercent: number,
    message: string
  ) {
    // Calculate overall progress based on phase weights
    // Weights are dynamic based on frame count because:
    // - Rendering/encoding time scales linearly with frames
    // - Finalizing time is more constant (based on file size, not frame count)
    // For short videos, finalizing is a larger percentage; for long videos, it's smaller

    const totalFrames = this.config.totalFrames;

    // Finalizing weight: 25% for very short videos (<60 frames),
    // scaling down to 5% for long videos (>600 frames)
    const finalizingWeight = Math.max(5, Math.min(25, 30 - (totalFrames / 24)));

    // Distribute remaining weight among other phases
    const remainingWeight = 100 - 5 - finalizingWeight; // 5% for loading
    const renderingWeight = remainingWeight * 0.35;  // 35% of remaining
    const writingWeight = remainingWeight * 0.10;    // 10% of remaining
    const encodingWeight = remainingWeight * 0.55;   // 55% of remaining

    const phaseWeights = {
      loading: { start: 0, weight: 5 },
      rendering: { start: 5, weight: renderingWeight },
      writing: { start: 5 + renderingWeight, weight: writingWeight },
      encoding: { start: 5 + renderingWeight + writingWeight, weight: encodingWeight },
      finalizing: { start: 100 - finalizingWeight, weight: finalizingWeight },
      complete: { start: 100, weight: 0 },
    };

    const phaseInfo = phaseWeights[phase];
    const overallPercent = phaseInfo.start + (phasePercent / 100) * phaseInfo.weight;

    this.config.onProgress?.({
      phase,
      phasePercent,
      overallPercent,
      currentFrame: this.frameCount,
      totalFrames: this.config.totalFrames,
      message,
    });
  }

  async start(useFileSystem: boolean = false): Promise<void> {
    this.useFileSystem = useFileSystem && isFileSystemAccessSupported();

    this.reportProgress('loading', 0, 'Loading FFmpeg...');

    this.ffmpeg = await loadFFmpeg((percent) => {
      this.reportProgress('loading', percent, 'Loading FFmpeg...');
    });

    this.frames = [];
    this.frameCount = 0;
    this.aborted = false;

    // If using file system, ask user to select a directory
    if (this.useFileSystem && window.showDirectoryPicker) {
      try {
        this.directoryHandle = await window.showDirectoryPicker({
          mode: 'readwrite',
          startIn: 'downloads',
        });
        console.log('[FFmpeg] Using file system for frame storage');
      } catch (error) {
        console.log('[FFmpeg] File system access denied, falling back to memory');
        this.useFileSystem = false;
        this.directoryHandle = null;
      }
    } else if (this.useFileSystem) {
      console.log('[FFmpeg] File System Access API not available, falling back to memory');
      this.useFileSystem = false;
    }
  }

  async addFrame(canvas: HTMLCanvasElement): Promise<void> {
    if (this.aborted) return;

    const paddedIndex = this.frameCount.toString().padStart(6, '0');
    const filename = `frame_${paddedIndex}.jpg`;

    // Convert canvas to JPEG data (much smaller than PNG, ~5-10x reduction)
    // Quality 0.95 is visually lossless and the re-encoding to H.264 masks any artifacts
    const blob = await new Promise<Blob>((resolve) => {
      canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.95);
    });

    if (this.useFileSystem && this.directoryHandle) {
      // Write to file system
      try {
        const fileHandle = await this.directoryHandle.getFileHandle(filename, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(blob);
        await writable.close();
      } catch (error) {
        console.error('[FFmpeg] Failed to write frame to file system:', error);
        // Fall back to memory
        const arrayBuffer = await blob.arrayBuffer();
        this.frames.push(new Uint8Array(arrayBuffer));
      }
    } else {
      // Store in memory
      const arrayBuffer = await blob.arrayBuffer();
      this.frames.push(new Uint8Array(arrayBuffer));
    }

    this.frameCount++;

    // Report rendering progress
    const percent = (this.frameCount / this.config.totalFrames) * 100;
    this.reportProgress(
      'rendering',
      percent,
      `Rendering frame ${this.frameCount}/${this.config.totalFrames}`
    );
  }

  async finish(): Promise<FFmpegEncoderResult> {
    if (!this.ffmpeg || this.aborted) {
      throw new Error('Encoder not ready or aborted');
    }

    const { width, height, fps, quality } = this.config;

    // Write frames to FFmpeg's virtual filesystem
    this.reportProgress('writing', 0, 'Writing frames to encoder...');

    if (this.useFileSystem && this.directoryHandle) {
      // Read from file system and write to FFmpeg
      for (let i = 0; i < this.frameCount; i++) {
        const paddedIndex = i.toString().padStart(6, '0');
        const filename = `frame_${paddedIndex}.jpg`;

        try {
          const fileHandle = await this.directoryHandle.getFileHandle(filename);
          const file = await fileHandle.getFile();
          const arrayBuffer = await file.arrayBuffer();
          await this.ffmpeg.writeFile(filename, new Uint8Array(arrayBuffer));
        } catch (error) {
          console.error(`[FFmpeg] Failed to read frame ${i}:`, error);
        }

        if (i % 10 === 0 || i === this.frameCount - 1) {
          const percent = ((i + 1) / this.frameCount) * 100;
          this.reportProgress('writing', percent, `Writing frame ${i + 1}/${this.frameCount}`);
        }
      }
    } else {
      // Write from memory
      for (let i = 0; i < this.frames.length; i++) {
        const paddedIndex = i.toString().padStart(6, '0');
        await this.ffmpeg.writeFile(`frame_${paddedIndex}.jpg`, this.frames[i]);

        if (i % 10 === 0 || i === this.frames.length - 1) {
          const percent = ((i + 1) / this.frames.length) * 100;
          this.reportProgress('writing', percent, `Writing frame ${i + 1}/${this.frames.length}`);
        }
      }
    }

    // Report writing complete before starting encoding
    this.reportProgress('writing', 100, 'All frames written');

    // Set up frame-based progress callback for encoding phase
    // This parses actual frame numbers from FFmpeg logs for accurate progress
    const totalFramesToEncode = this.frameCount;
    let hasReachedFinalizing = false;

    currentFrameCallback = (frameNum: number) => {
      const percent = Math.min(100, (frameNum / totalFramesToEncode) * 100);

      // When we hit 100%, immediately switch to finalizing phase
      // FFmpeg still needs time after encoding the last frame to finalize the video
      if (frameNum >= totalFramesToEncode && !hasReachedFinalizing) {
        hasReachedFinalizing = true;
        this.reportProgress('encoding', 100, 'Encoding complete');
        this.reportProgress('finalizing', 0, 'Finalizing video...');
        // Start simulated progress for the finalizing phase
        this.startFinalizingProgress();
      } else if (!hasReachedFinalizing) {
        this.reportProgress('encoding', percent, `Encoding frame ${frameNum}/${totalFramesToEncode}`);
      }
    };

    // Also keep the time-based progress as a fallback (disabled for now since frame-based is better)
    currentProgressCallback = null;

    this.reportProgress('encoding', 0, 'Encoding video...');

    // Calculate CRF based on quality (0-51, lower = better, 18-28 is typical range)
    const crf = Math.round(35 - (quality * 17));

    // Encode to MP4 using H.264
    await this.ffmpeg.exec([
      '-framerate', fps.toString(),
      '-i', 'frame_%06d.jpg',
      '-c:v', 'libx264',
      '-preset', 'medium',
      '-crf', crf.toString(),
      '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart',
      '-vf', `scale=${width}:${height}:flags=lanczos`,
      '-y',
      'output.mp4'
    ]);

    // Clear the encoding callbacks and stop simulated progress
    currentProgressCallback = null;
    currentFrameCallback = null;
    this.stopFinalizingProgress();

    // Only report these if we haven't already transitioned (for short videos where
    // the frame callback already triggered the transition)
    if (!hasReachedFinalizing) {
      this.reportProgress('encoding', 100, 'Encoding complete');
    }

    // FFmpeg exec has returned - now we do actual file operations
    // Jump to near the end of finalizing since the heavy lifting is done
    this.reportProgress('finalizing', 85, 'Reading output file...');

    // Read the output file
    const data = await this.ffmpeg.readFile('output.mp4') as Uint8Array;

    this.reportProgress('finalizing', 50, 'Cleaning up...');

    // Clean up frames from virtual filesystem
    for (let i = 0; i < this.frameCount; i++) {
      const paddedIndex = i.toString().padStart(6, '0');
      try {
        await this.ffmpeg.deleteFile(`frame_${paddedIndex}.jpg`);
      } catch {
        // Ignore cleanup errors
      }
    }

    // Clean up file system frames if used
    if (this.useFileSystem && this.directoryHandle) {
      for (let i = 0; i < this.frameCount; i++) {
        const paddedIndex = i.toString().padStart(6, '0');
        try {
          await this.directoryHandle.removeEntry(`frame_${paddedIndex}.jpg`);
        } catch {
          // Ignore cleanup errors
        }
      }
    }

    try {
      await this.ffmpeg.deleteFile('output.mp4');
    } catch {
      // Ignore cleanup errors
    }

    // Clear frames from memory
    this.frames = [];

    this.reportProgress('finalizing', 90, 'Creating video file...');

    // Create blob from the data
    const buffer = new ArrayBuffer(data.length);
    const view = new Uint8Array(buffer);
    view.set(data);
    const blob = new Blob([buffer], { type: 'video/mp4' });
    const duration = this.frameCount / fps;

    this.reportProgress('complete', 100, 'Complete!');

    return { blob, duration };
  }

  abort(): void {
    this.aborted = true;
    this.frames = [];
    currentProgressCallback = null;
    currentFrameCallback = null;
    this.stopFinalizingProgress();
  }
}

// Helper to create FFmpeg encoder from VideoExportSettings
export function createFFmpegEncoderFromSettings(
  settings: VideoExportSettings,
  canvasWidth: number,
  canvasHeight: number,
  totalFrames: number,
  onProgress?: (progress: FFmpegProgress) => void
): FFmpegEncoder {
  const { width, height } = getResolutionDimensions(settings, canvasWidth, canvasHeight);

  return new FFmpegEncoder({
    width,
    height,
    fps: settings.fps,
    quality: settings.quality,
    totalFrames,
    onProgress,
  });
}

// Preload FFmpeg (call this when user opens export dialog)
export async function preloadFFmpeg(): Promise<boolean> {
  try {
    await loadFFmpeg();
    return true;
  } catch (error) {
    console.error('Failed to preload FFmpeg:', error);
    return false;
  }
}
