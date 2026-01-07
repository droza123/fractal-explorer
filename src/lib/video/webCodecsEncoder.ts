// WebCodecs-based MP4 encoder for hardware-accelerated video export
import { Muxer, ArrayBufferTarget } from 'mp4-muxer';
import type { VideoExportSettings } from '../../types';
import { getResolutionDimensions } from './frameRenderer';

export interface WebCodecsProgress {
  phase: 'preparing' | 'rendering' | 'encoding' | 'finalizing' | 'complete';
  phasePercent: number;
  overallPercent: number;
  currentFrame?: number;
  totalFrames?: number;
  message: string;
}

export interface WebCodecsEncoderConfig {
  width: number;
  height: number;
  fps: number;
  quality: number; // 0-1, higher = better quality
  totalFrames: number;
  onProgress?: (progress: WebCodecsProgress) => void;
}

export interface WebCodecsEncoderResult {
  blob: Blob;
  duration: number;
}

// Check if WebCodecs is supported
export function isWebCodecsSupported(): boolean {
  return typeof VideoEncoder !== 'undefined' && typeof VideoFrame !== 'undefined';
}

interface CodecResult {
  codec: string;
  muxerCodec: 'avc' | 'vp9';
}

// Get supported codec
async function getSupportedCodec(width: number, height: number, fps: number): Promise<CodecResult | null> {
  // Try codecs in order of preference
  // H.264 codecs (best compatibility with players)
  // Format: avc1.PPCCLL where PP=profile, CC=constraints, LL=level
  const h264Codecs = [
    'avc1.640033', // H.264 High Profile Level 5.1 (for 4K@30)
    'avc1.640032', // H.264 High Profile Level 5.0
    'avc1.64002a', // H.264 High Profile Level 4.2
    'avc1.640028', // H.264 High Profile Level 4.0
    'avc1.4d0033', // H.264 Main Profile Level 5.1
    'avc1.4d0032', // H.264 Main Profile Level 5.0
    'avc1.4d002a', // H.264 Main Profile Level 4.2
    'avc1.4d0028', // H.264 Main Profile Level 4.0
    'avc1.42003d', // H.264 Baseline Profile Level 6.1
    'avc1.420033', // H.264 Baseline Profile Level 5.1
    'avc1.420032', // H.264 Baseline Profile Level 5.0
    'avc1.42002a', // H.264 Baseline Profile Level 4.2
    'avc1.420028', // H.264 Baseline Profile Level 4.0
  ];

  // VP9 codecs (good for high resolutions, software encoding fallback)
  const vp9Codecs = [
    'vp09.00.51.08', // VP9 Profile 0, Level 5.1, 8-bit
    'vp09.00.50.08', // VP9 Profile 0, Level 5.0, 8-bit
    'vp09.00.41.08', // VP9 Profile 0, Level 4.1, 8-bit
    'vp9',           // Generic VP9
  ];


  // Try H.264 first
  for (const codec of h264Codecs) {
    try {
      const config = {
        codec,
        width,
        height,
        bitrate: 10_000_000,
        framerate: fps,
      };
      const support = await VideoEncoder.isConfigSupported(config);
      if (support.supported) {
        console.log(`[WebCodecs] Using H.264 codec: ${codec}`);
        return { codec, muxerCodec: 'avc' };
      }
    } catch {
      // Codec not supported, try next
    }
  }

  console.log(`[WebCodecs] No H.264 codec supports ${width}x${height}, trying VP9...`);

  // Try VP9
  for (const codec of vp9Codecs) {
    try {
      const config = {
        codec,
        width,
        height,
        bitrate: 10_000_000,
        framerate: fps,
      };
      const support = await VideoEncoder.isConfigSupported(config);
      if (support.supported) {
        console.log(`[WebCodecs] Using VP9 codec: ${codec}`);
        return { codec, muxerCodec: 'vp9' };
      }
    } catch {
      // Codec not supported, try next
    }
  }

  // Check if a lower resolution would work to provide helpful feedback
  const lowerRes = [
    { w: 1920, h: 1080 },
    { w: 1280, h: 720 },
  ];

  for (const { w, h } of lowerRes) {
    try {
      const support = await VideoEncoder.isConfigSupported({
        codec: 'avc1.640028',
        width: w,
        height: h,
        bitrate: 10_000_000,
        framerate: fps,
      });
      if (support.supported) {
        console.log(`[WebCodecs] H.264 is supported at ${w}x${h} but not at ${width}x${height}`);
      }
    } catch {
      // Ignore
    }
  }

  return null;
}

export class WebCodecsEncoder {
  private config: WebCodecsEncoderConfig;
  private muxer: Muxer<ArrayBufferTarget> | null = null;
  private encoder: VideoEncoder | null = null;
  private frameCount: number = 0;
  private aborted: boolean = false;
  private encodedFrames: number = 0;
  private allFramesSubmitted: boolean = false;
  private encodeCompletePromise: Promise<void> | null = null;
  private encodeCompleteResolve: (() => void) | null = null;

  constructor(config: WebCodecsEncoderConfig) {
    this.config = config;
  }

  private reportProgress(
    phase: WebCodecsProgress['phase'],
    percent: number,
    message: string
  ) {
    // Simple 0-100% progress based on encoded frames
    this.config.onProgress?.({
      phase,
      phasePercent: Math.min(100, percent),
      overallPercent: Math.min(100, percent),
      currentFrame: this.encodedFrames,
      totalFrames: this.config.totalFrames,
      message,
    });
  }

  async start(): Promise<void> {
    // Show initial progress
    this.reportProgress('encoding', 0, 'Starting...');

    const { width, height, fps, quality } = this.config;

    // Get supported codec
    const codecResult = await getSupportedCodec(width, height, fps);
    if (!codecResult) {
      throw new Error(`No video codec supports ${width}x${height} encoding. Try a lower resolution (1080p or 720p).`);
    }

    // Calculate bitrate based on resolution and quality
    // Base: ~10 Mbps for 1080p at quality 1.0
    const pixelCount = width * height;
    const basePixels = 1920 * 1080;
    const baseBitrate = 10_000_000; // 10 Mbps
    const bitrate = Math.round(baseBitrate * (pixelCount / basePixels) * (0.5 + quality * 0.5));

    // Create promise for tracking when encoding is complete
    this.encodeCompletePromise = new Promise((resolve) => {
      this.encodeCompleteResolve = resolve;
    });

    // Create muxer with the appropriate codec
    this.muxer = new Muxer({
      target: new ArrayBufferTarget(),
      video: {
        codec: codecResult.muxerCodec,
        width,
        height,
      },
      fastStart: 'in-memory', // Optimize for streaming playback
    });

    const { codec } = codecResult;

    // Create encoder
    this.encoder = new VideoEncoder({
      output: (chunk, metadata) => {
        if (this.muxer && !this.aborted) {
          this.muxer.addVideoChunk(chunk, metadata);
          this.encodedFrames++;

          // Report progress based on encoded frames (the true completion metric)
          const percent = (this.encodedFrames / this.config.totalFrames) * 100;
          this.reportProgress(
            'encoding',
            percent,
            `Frame ${this.encodedFrames} of ${this.config.totalFrames}`
          );

          // Check if all frames have been encoded
          if (this.allFramesSubmitted && this.encodedFrames >= this.config.totalFrames) {
            this.encodeCompleteResolve?.();
          }
        }
      },
      error: (error) => {
        console.error('[WebCodecs] Encoder error:', error);
      },
    });

    // Configure encoder
    const encoderConfig: VideoEncoderConfig = {
      codec,
      width,
      height,
      bitrate,
      framerate: fps,
    };
    console.log('[WebCodecs] Configuring encoder with:', encoderConfig);
    this.encoder.configure(encoderConfig);

    this.frameCount = 0;
    this.encodedFrames = 0;
    this.aborted = false;
    this.allFramesSubmitted = false;
  }

  async addFrame(canvas: HTMLCanvasElement): Promise<void> {
    if (this.aborted || !this.encoder) return;

    // Throttle frame submission to prevent memory buildup
    // Wait if encoder queue has too many pending frames
    const MAX_QUEUE_SIZE = 3; // Keep queue small for 4K to avoid memory issues
    while (this.encoder.encodeQueueSize > MAX_QUEUE_SIZE && !this.aborted) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    if (this.aborted || !this.encoder) return;

    const { fps } = this.config;

    // Create VideoFrame from canvas
    // timestamp is in microseconds
    const timestamp = Math.round((this.frameCount / fps) * 1_000_000);
    const duration = Math.round((1 / fps) * 1_000_000);

    const frame = new VideoFrame(canvas, {
      timestamp,
      duration,
    });

    // Encode the frame
    // Use keyframe every 2 seconds for seeking
    const isKeyframe = this.frameCount % (fps * 2) === 0;
    this.encoder.encode(frame, { keyFrame: isKeyframe });

    // Close the frame to free memory immediately
    frame.close();

    this.frameCount++;

    // Flush periodically to ensure encoding keeps up and memory is released
    // This is especially important for high-resolution exports
    if (this.frameCount % 10 === 0) {
      await this.encoder.flush();
    }

    // Progress is reported by the encoding callback, not here
  }

  async finish(): Promise<WebCodecsEncoderResult> {
    if (!this.encoder || !this.muxer || this.aborted) {
      throw new Error('Encoder not ready or aborted');
    }

    // Mark that all frames have been submitted
    this.allFramesSubmitted = true;

    // Flush the encoder to ensure all frames are processed
    await this.encoder.flush();

    // Wait for all frames to be encoded (progress continues via encoding callback)
    if (this.encodedFrames < this.config.totalFrames) {
      await this.encodeCompletePromise;
    }

    // Finalize the muxer
    this.muxer.finalize();

    // Get the output buffer
    const { buffer } = this.muxer.target;

    // Create blob
    const blob = new Blob([buffer], { type: 'video/mp4' });
    const duration = this.frameCount / this.config.fps;

    // Cleanup
    this.encoder.close();
    this.encoder = null;
    this.muxer = null;

    // Final 100% progress
    this.reportProgress('encoding', 100, 'Complete!');

    return { blob, duration };
  }

  abort(): void {
    this.aborted = true;
    if (this.encoder && this.encoder.state !== 'closed') {
      this.encoder.close();
    }
    this.encoder = null;
    this.muxer = null;
  }
}

// Helper to create WebCodecs encoder from VideoExportSettings
export function createWebCodecsEncoderFromSettings(
  settings: VideoExportSettings,
  canvasWidth: number,
  canvasHeight: number,
  totalFrames: number,
  onProgress?: (progress: WebCodecsProgress) => void
): WebCodecsEncoder {
  const { width, height } = getResolutionDimensions(settings, canvasWidth, canvasHeight);

  return new WebCodecsEncoder({
    width,
    height,
    fps: settings.fps,
    quality: settings.quality,
    totalFrames,
    onProgress,
  });
}
