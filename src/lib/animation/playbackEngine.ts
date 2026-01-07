import type { AnimationKeyframe } from '../../types';
import { getStateAtTime, calculateTotalDuration, type InterpolatedState } from './interpolation';

export interface PlaybackEngineConfig {
  keyframes: AnimationKeyframe[];
  onFrame: (state: InterpolatedState, timeMs: number) => void;
  onComplete: () => void;
  onTimeUpdate?: (timeMs: number) => void;
  playbackSpeed?: number;
}

export class PlaybackEngine {
  private keyframes: AnimationKeyframe[];
  private onFrame: (state: InterpolatedState, timeMs: number) => void;
  private onComplete: () => void;
  private onTimeUpdate?: (timeMs: number) => void;
  private playbackSpeed: number;

  private animationFrameId: number | null = null;
  private startTime: number = 0;
  private pausedAt: number = 0;
  private isPlaying: boolean = false;
  private totalDuration: number = 0;

  constructor(config: PlaybackEngineConfig) {
    this.keyframes = config.keyframes;
    this.onFrame = config.onFrame;
    this.onComplete = config.onComplete;
    this.onTimeUpdate = config.onTimeUpdate;
    this.playbackSpeed = config.playbackSpeed ?? 1;
    this.totalDuration = calculateTotalDuration(config.keyframes);
  }

  public play(): void {
    if (this.isPlaying) return;
    if (this.keyframes.length < 2) return;

    this.isPlaying = true;
    this.startTime = performance.now() - (this.pausedAt / this.playbackSpeed);
    this.tick();
  }

  public pause(): void {
    if (!this.isPlaying) return;
    this.isPlaying = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    // Store current time position
    this.pausedAt = this.getCurrentTime();
  }

  public stop(): void {
    this.isPlaying = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.pausedAt = 0;
    this.onTimeUpdate?.(0);

    // Apply first frame state
    const state = getStateAtTime(this.keyframes, 0);
    if (state) {
      this.onFrame(state, 0);
    }
  }

  public seek(timeMs: number): void {
    const clampedTime = Math.max(0, Math.min(timeMs, this.totalDuration));
    this.pausedAt = clampedTime;

    if (this.isPlaying) {
      // Adjust start time to maintain playback from new position
      this.startTime = performance.now() - (clampedTime / this.playbackSpeed);
    }

    // Apply the state at the seek position
    const state = getStateAtTime(this.keyframes, clampedTime);
    if (state) {
      this.onFrame(state, clampedTime);
    }
    this.onTimeUpdate?.(clampedTime);
  }

  public setSpeed(speed: number): void {
    const currentTime = this.getCurrentTime();
    this.playbackSpeed = speed;
    if (this.isPlaying) {
      this.startTime = performance.now() - (currentTime / speed);
    }
  }

  public getCurrentTime(): number {
    if (!this.isPlaying) {
      return this.pausedAt;
    }
    const elapsed = (performance.now() - this.startTime) * this.playbackSpeed;
    return Math.min(elapsed, this.totalDuration);
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  public getTotalDuration(): number {
    return this.totalDuration;
  }

  public updateKeyframes(keyframes: AnimationKeyframe[]): void {
    this.keyframes = keyframes;
    this.totalDuration = calculateTotalDuration(keyframes);
  }

  public destroy(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.isPlaying = false;
  }

  private tick = (): void => {
    if (!this.isPlaying) return;

    const currentTime = this.getCurrentTime();
    this.onTimeUpdate?.(currentTime);

    // Get interpolated state at current time
    const state = getStateAtTime(this.keyframes, currentTime);
    if (state) {
      this.onFrame(state, currentTime);
    }

    // Check if we've reached the end
    if (currentTime >= this.totalDuration) {
      this.isPlaying = false;
      this.pausedAt = this.totalDuration;
      this.onComplete();
      return;
    }

    // Schedule next frame
    this.animationFrameId = requestAnimationFrame(this.tick);
  };
}

// Singleton instance management for the global playback engine
let globalEngine: PlaybackEngine | null = null;

export function getPlaybackEngine(): PlaybackEngine | null {
  return globalEngine;
}

export function setPlaybackEngine(engine: PlaybackEngine | null): void {
  if (globalEngine) {
    globalEngine.destroy();
  }
  globalEngine = engine;
}

export function destroyPlaybackEngine(): void {
  if (globalEngine) {
    globalEngine.destroy();
    globalEngine = null;
  }
}
