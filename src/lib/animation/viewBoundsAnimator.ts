import type { ViewBounds } from '../../types';
import { interpolateViewBounds, easingFunctions } from './interpolation';

export interface ViewBoundsAnimatorConfig {
  onUpdate: (bounds: ViewBounds) => void;
  onComplete: (bounds: ViewBounds) => void;
  duration?: number; // Animation duration in ms
  easing?: 'linear' | 'ease-out' | 'ease-in-out';
}

const DEFAULT_DURATION = 150; // 150ms feels snappy but smooth
const DEFAULT_EASING = 'ease-out';

export class ViewBoundsAnimator {
  private onUpdate: (bounds: ViewBounds) => void;
  private onComplete: (bounds: ViewBounds) => void;
  private duration: number;
  private easing: 'linear' | 'ease-out' | 'ease-in-out';

  private animationFrameId: number | null = null;
  private startTime: number = 0;
  private startBounds: ViewBounds | null = null;
  private targetBounds: ViewBounds | null = null;
  private isAnimating: boolean = false;

  constructor(config: ViewBoundsAnimatorConfig) {
    this.onUpdate = config.onUpdate;
    this.onComplete = config.onComplete;
    this.duration = config.duration ?? DEFAULT_DURATION;
    this.easing = config.easing ?? DEFAULT_EASING;
  }

  /**
   * Animate from current bounds to target bounds.
   * If already animating, smoothly retargets to new destination.
   */
  public animateTo(fromBounds: ViewBounds, toBounds: ViewBounds): void {
    // If already animating, use current interpolated position as new start
    if (this.isAnimating && this.startBounds && this.targetBounds) {
      const elapsed = performance.now() - this.startTime;
      const rawProgress = Math.min(elapsed / this.duration, 1);
      const progress = easingFunctions[this.easing](rawProgress);

      // Current interpolated position becomes new start
      this.startBounds = interpolateViewBounds(this.startBounds, this.targetBounds, progress);
    } else {
      this.startBounds = { ...fromBounds };
    }

    this.targetBounds = { ...toBounds };
    this.startTime = performance.now();

    if (!this.isAnimating) {
      this.isAnimating = true;
      this.tick();
    }
  }

  /**
   * Update the target bounds mid-animation (for accumulating rapid scrolls).
   * This creates a smooth "chasing" effect.
   */
  public updateTarget(toBounds: ViewBounds): void {
    if (!this.isAnimating || !this.startBounds || !this.targetBounds) {
      return;
    }

    // Calculate current position
    const elapsed = performance.now() - this.startTime;
    const rawProgress = Math.min(elapsed / this.duration, 1);
    const progress = easingFunctions[this.easing](rawProgress);

    // Current position becomes new start, reset timer
    this.startBounds = interpolateViewBounds(this.startBounds, this.targetBounds, progress);
    this.targetBounds = { ...toBounds };
    this.startTime = performance.now();
  }

  /**
   * Stop the animation immediately.
   */
  public stop(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.isAnimating = false;
    this.startBounds = null;
    this.targetBounds = null;
  }

  /**
   * Check if animation is currently running.
   */
  public getIsAnimating(): boolean {
    return this.isAnimating;
  }

  /**
   * Get the current target bounds (if animating).
   */
  public getTargetBounds(): ViewBounds | null {
    return this.targetBounds;
  }

  /**
   * Update configuration.
   */
  public setConfig(config: Partial<ViewBoundsAnimatorConfig>): void {
    if (config.duration !== undefined) this.duration = config.duration;
    if (config.easing !== undefined) this.easing = config.easing;
    if (config.onUpdate !== undefined) this.onUpdate = config.onUpdate;
    if (config.onComplete !== undefined) this.onComplete = config.onComplete;
  }

  private tick = (): void => {
    if (!this.isAnimating || !this.startBounds || !this.targetBounds) {
      return;
    }

    const elapsed = performance.now() - this.startTime;
    const rawProgress = Math.min(elapsed / this.duration, 1);
    const progress = easingFunctions[this.easing](rawProgress);

    const currentBounds = interpolateViewBounds(this.startBounds, this.targetBounds, progress);
    this.onUpdate(currentBounds);

    if (rawProgress >= 1) {
      // Animation complete
      this.isAnimating = false;
      this.onComplete(this.targetBounds);
      this.startBounds = null;
      this.targetBounds = null;
      return;
    }

    this.animationFrameId = requestAnimationFrame(this.tick);
  };

  public destroy(): void {
    this.stop();
  }
}

// Singleton instance for global zoom animation
let globalAnimator: ViewBoundsAnimator | null = null;

export function getViewBoundsAnimator(): ViewBoundsAnimator | null {
  return globalAnimator;
}

export function createViewBoundsAnimator(config: ViewBoundsAnimatorConfig): ViewBoundsAnimator {
  if (globalAnimator) {
    globalAnimator.destroy();
  }
  globalAnimator = new ViewBoundsAnimator(config);
  return globalAnimator;
}

export function destroyViewBoundsAnimator(): void {
  if (globalAnimator) {
    globalAnimator.destroy();
    globalAnimator = null;
  }
}
