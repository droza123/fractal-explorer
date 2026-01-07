// MP4 encoder using WebCodecs API and mp4-muxer
import { Muxer, ArrayBufferTarget } from 'mp4-muxer';
import type { VideoExportSettings } from '../../types';
import { getResolutionDimensions } from './frameRenderer';

export interface MP4EncoderConfig {
  width: number;
  height: number;
  fps: number;
  bitrate?: number; // bits per second
}

export interface MP4EncoderResult {
  blob: Blob;
  duration: number;
}

// Check if WebCodecs is available
export function isMP4EncoderSupported(): boolean {
  return typeof VideoEncoder !== 'undefined' && typeof VideoEncoder.isConfigSupported === 'function';
}

export class MP4Encoder {
  private muxer: Muxer<ArrayBufferTarget> | null = null;
  private encoder: VideoEncoder | null = null;
  private config: MP4EncoderConfig;
  private frameCount: number = 0;
  private isFinalized: boolean = false;
  private encoderReady: Promise<void>;
  private resolveEncoderReady!: () => void;

  constructor(config: MP4EncoderConfig) {
    this.config = config;
    this.encoderReady = new Promise((resolve) => {
      this.resolveEncoderReady = resolve;
    });
  }

  async start(): Promise<void> {
    const { width, height, fps, bitrate } = this.config;

    // Calculate bitrate if not provided (roughly 5 Mbps for 1080p)
    const calculatedBitrate = bitrate ?? Math.round((width * height * fps * 0.1));

    // Create muxer
    this.muxer = new Muxer({
      target: new ArrayBufferTarget(),
      video: {
        codec: 'avc',
        width,
        height,
      },
      fastStart: 'in-memory', // Puts moov atom at start for streaming
    });

    // Create encoder
    this.encoder = new VideoEncoder({
      output: (chunk, metadata) => {
        this.muxer?.addVideoChunk(chunk, metadata);
      },
      error: (error) => {
        console.error('VideoEncoder error:', error);
      },
    });

    // Try different H.264 codec configurations in order of preference
    // Different browsers support different profiles/levels
    const codecsToTry = [
      'avc1.42001f', // Baseline Profile Level 3.1 (most compatible)
      'avc1.42E01E', // Baseline Profile Level 3.0
      'avc1.4D401F', // Main Profile Level 3.1
      'avc1.64001F', // High Profile Level 3.1
    ];

    let supportedConfig: VideoEncoderConfig | null = null;

    for (const codec of codecsToTry) {
      const config: VideoEncoderConfig = {
        codec,
        width,
        height,
        bitrate: calculatedBitrate,
        framerate: fps,
        avc: { format: 'avc' }, // Required for mp4-muxer
      };

      try {
        const support = await VideoEncoder.isConfigSupported(config);
        if (support.supported) {
          supportedConfig = config;
          console.log(`Using H.264 codec: ${codec}`);
          break;
        }
      } catch (e) {
        // Some browsers throw instead of returning unsupported
        continue;
      }
    }

    // If no config with avc format works, try without it (will use annexb)
    if (!supportedConfig) {
      for (const codec of codecsToTry) {
        const config: VideoEncoderConfig = {
          codec,
          width,
          height,
          bitrate: calculatedBitrate,
          framerate: fps,
        };

        try {
          const support = await VideoEncoder.isConfigSupported(config);
          if (support.supported) {
            supportedConfig = config;
            console.log(`Using H.264 codec (annexb): ${codec}`);
            break;
          }
        } catch (e) {
          continue;
        }
      }
    }

    if (!supportedConfig) {
      throw new Error(
        'H.264 encoding not supported by your browser. ' +
        'Please try using WebM format instead, or use Chrome/Edge.'
      );
    }

    this.encoder.configure(supportedConfig);
    this.resolveEncoderReady();
  }

  async addFrame(canvas: HTMLCanvasElement, frameIndex: number): Promise<void> {
    await this.encoderReady;

    if (!this.encoder || this.isFinalized) {
      throw new Error('Encoder not ready or already finalized');
    }

    // Create VideoFrame from canvas
    const frame = new VideoFrame(canvas, {
      timestamp: (frameIndex / this.config.fps) * 1_000_000, // microseconds
      duration: (1 / this.config.fps) * 1_000_000, // microseconds
    });

    // Determine if this should be a keyframe (every 2 seconds or first frame)
    const keyframeInterval = this.config.fps * 2;
    const isKeyframe = frameIndex === 0 || frameIndex % keyframeInterval === 0;

    // Encode frame
    this.encoder.encode(frame, { keyFrame: isKeyframe });
    frame.close();

    this.frameCount++;
  }

  async finish(): Promise<MP4EncoderResult> {
    if (!this.encoder || !this.muxer || this.isFinalized) {
      throw new Error('Encoder not ready or already finalized');
    }

    this.isFinalized = true;

    // Flush encoder
    await this.encoder.flush();
    this.encoder.close();

    // Finalize muxer
    this.muxer.finalize();

    // Get the MP4 data
    const { buffer } = this.muxer.target;
    const blob = new Blob([buffer], { type: 'video/mp4' });

    const duration = this.frameCount / this.config.fps;

    return { blob, duration };
  }

  abort(): void {
    if (this.encoder && this.encoder.state !== 'closed') {
      this.encoder.close();
    }
    this.isFinalized = true;
  }
}

// Helper to create MP4 encoder from VideoExportSettings
export function createMP4EncoderFromSettings(
  settings: VideoExportSettings,
  canvasWidth: number,
  canvasHeight: number
): MP4Encoder {
  const { width, height } = getResolutionDimensions(settings, canvasWidth, canvasHeight);

  // Calculate bitrate based on resolution and quality setting
  // Base: ~8 Mbps for 1080p at quality 1.0
  const pixelCount = width * height;
  const baseBitrate = (pixelCount / (1920 * 1080)) * 8_000_000;
  const bitrate = Math.round(baseBitrate * settings.quality);

  return new MP4Encoder({
    width,
    height,
    fps: settings.fps,
    bitrate,
  });
}
