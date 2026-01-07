import type {
  EasingFunction,
  AnimationKeyframe,
  ViewBounds,
  Complex,
} from '../../types';

// Easing functions - take a value from 0-1 and return a value from 0-1
export const easingFunctions: Record<EasingFunction, (t: number) => number> = {
  'linear': (t) => t,
  'ease-in': (t) => t * t,
  'ease-out': (t) => t * (2 - t),
  'ease-in-out': (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
};

// Apply easing function to a progress value
export function applyEasing(t: number, easing: EasingFunction): number {
  return easingFunctions[easing](Math.max(0, Math.min(1, t)));
}

// Interpolate between two numbers
export function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

// Logarithmic interpolation - for values that should change exponentially (like zoom)
// This makes zoom feel perceptually smooth (constant rate of visual change)
export function lerpLog(from: number, to: number, t: number): number {
  // Handle edge cases where log would fail
  if (from <= 0 || to <= 0) {
    return lerp(from, to, t);
  }
  const logFrom = Math.log(from);
  const logTo = Math.log(to);
  return Math.exp(logFrom + (logTo - logFrom) * t);
}

// Interpolate ViewBounds with logarithmic scale interpolation
// This produces perceptually smooth zooming by:
// 1. Linearly interpolating the center point
// 2. Logarithmically interpolating the scale (zoom level)
// 3. Reconstructing bounds from center + scale
export function interpolateViewBounds(
  from: ViewBounds,
  to: ViewBounds,
  t: number
): ViewBounds {
  // Extract centers
  const fromCenterReal = (from.minReal + from.maxReal) / 2;
  const fromCenterImag = (from.minImag + from.maxImag) / 2;
  const toCenterReal = (to.minReal + to.maxReal) / 2;
  const toCenterImag = (to.minImag + to.maxImag) / 2;

  // Extract scales (half-ranges)
  const fromScaleReal = (from.maxReal - from.minReal) / 2;
  const fromScaleImag = (from.maxImag - from.minImag) / 2;
  const toScaleReal = (to.maxReal - to.minReal) / 2;
  const toScaleImag = (to.maxImag - to.minImag) / 2;

  // Linearly interpolate centers
  const centerReal = lerp(fromCenterReal, toCenterReal, t);
  const centerImag = lerp(fromCenterImag, toCenterImag, t);

  // Logarithmically interpolate scales for perceptually smooth zoom
  const scaleReal = lerpLog(fromScaleReal, toScaleReal, t);
  const scaleImag = lerpLog(fromScaleImag, toScaleImag, t);

  // Reconstruct bounds from center and scale
  return {
    minReal: centerReal - scaleReal,
    maxReal: centerReal + scaleReal,
    minImag: centerImag - scaleImag,
    maxImag: centerImag + scaleImag,
  };
}

// Interpolate Complex number (for Julia constant)
export function interpolateComplex(
  from: Complex,
  to: Complex,
  t: number
): Complex {
  return {
    real: lerp(from.real, to.real, t),
    imag: lerp(from.imag, to.imag, t),
  };
}

// Interpolated keyframe state (partial state used to update the store)
export interface InterpolatedState {
  viewBounds: ViewBounds;
  fractalType: 'mandelbrot' | 'julia';
  juliaConstant: Complex;
  equationId: number;
  juliaZoomFactor: number;
  maxIterations: number;
  currentPaletteId: string;
  colorTemperature: number;
}

// Interpolate full keyframe state between two keyframes
export function interpolateKeyframeState(
  from: AnimationKeyframe,
  to: AnimationKeyframe,
  progress: number, // 0-1 within this segment
  easing: EasingFunction
): InterpolatedState {
  const t = applyEasing(progress, easing);

  // Handle fractal type transition - snap at 50%
  const fractalType = progress < 0.5 ? from.fractalType : to.fractalType;

  // Handle discrete properties - snap at 50%
  const equationId = progress < 0.5 ? from.equationId : to.equationId;
  const currentPaletteId = progress < 0.5 ? from.currentPaletteId : to.currentPaletteId;

  // Handle continuous properties with interpolation
  return {
    viewBounds: interpolateViewBounds(from.viewBounds, to.viewBounds, t),
    fractalType,
    juliaConstant: interpolateComplex(from.juliaConstant, to.juliaConstant, t),
    equationId,
    // Use logarithmic interpolation for zoom factor (consistent with viewBounds)
    juliaZoomFactor: lerpLog(from.juliaZoomFactor, to.juliaZoomFactor, t),
    maxIterations: Math.round(lerp(from.maxIterations, to.maxIterations, t)),
    currentPaletteId,
    colorTemperature: lerp(from.colorTemperature, to.colorTemperature, t),
  };
}

// Result of finding keyframe pair at a given time
export interface KeyframePairResult {
  from: AnimationKeyframe;
  to: AnimationKeyframe;
  segmentProgress: number; // 0-1 within this segment
  fromIndex: number;
  toIndex: number;
}

// Find the keyframe pair for a given time in the animation
// Returns null if keyframes array is empty or has only one keyframe
export function getKeyframePairAtTime(
  keyframes: AnimationKeyframe[],
  timeMs: number
): KeyframePairResult | null {
  if (keyframes.length < 2) {
    return null;
  }

  // Clamp time to valid range
  const totalDuration = calculateTotalDuration(keyframes);
  const clampedTime = Math.max(0, Math.min(timeMs, totalDuration));

  // Find the segment we're in
  let accumulatedTime = 0;
  for (let i = 0; i < keyframes.length - 1; i++) {
    const segmentDuration = keyframes[i].duration;
    const segmentEnd = accumulatedTime + segmentDuration;

    if (clampedTime <= segmentEnd || i === keyframes.length - 2) {
      const segmentProgress = segmentDuration > 0
        ? (clampedTime - accumulatedTime) / segmentDuration
        : 0;

      return {
        from: keyframes[i],
        to: keyframes[i + 1],
        segmentProgress: Math.max(0, Math.min(1, segmentProgress)),
        fromIndex: i,
        toIndex: i + 1,
      };
    }

    accumulatedTime = segmentEnd;
  }

  // Should not reach here, but return last segment as fallback
  return {
    from: keyframes[keyframes.length - 2],
    to: keyframes[keyframes.length - 1],
    segmentProgress: 1,
    fromIndex: keyframes.length - 2,
    toIndex: keyframes.length - 1,
  };
}

// Calculate total duration of animation from keyframes
// The last keyframe's duration is ignored (nothing after it)
export function calculateTotalDuration(keyframes: AnimationKeyframe[]): number {
  if (keyframes.length < 2) return 0;

  return keyframes.slice(0, -1).reduce((sum, kf) => sum + kf.duration, 0);
}

// Get the interpolated state at a specific time in the animation
export function getStateAtTime(
  keyframes: AnimationKeyframe[],
  timeMs: number
): InterpolatedState | null {
  const pair = getKeyframePairAtTime(keyframes, timeMs);
  if (!pair) {
    // If only one keyframe, return its state
    if (keyframes.length === 1) {
      const kf = keyframes[0];
      return {
        viewBounds: kf.viewBounds,
        fractalType: kf.fractalType,
        juliaConstant: kf.juliaConstant,
        equationId: kf.equationId,
        juliaZoomFactor: kf.juliaZoomFactor,
        maxIterations: kf.maxIterations,
        currentPaletteId: kf.currentPaletteId,
        colorTemperature: kf.colorTemperature,
      };
    }
    return null;
  }

  return interpolateKeyframeState(
    pair.from,
    pair.to,
    pair.segmentProgress,
    pair.from.easing
  );
}

// Calculate timestamps for keyframes (recalculates based on durations)
export function recalculateTimestamps(keyframes: AnimationKeyframe[]): AnimationKeyframe[] {
  let timestamp = 0;
  return keyframes.map((kf, index) => {
    const updated = { ...kf, timestamp };
    if (index < keyframes.length - 1) {
      timestamp += kf.duration;
    }
    return updated;
  });
}

// Get frame times for video export at a specific FPS
export function getFrameTimes(
  totalDuration: number,
  fps: number
): number[] {
  const frameDuration = 1000 / fps;
  const frameCount = Math.ceil(totalDuration / frameDuration);
  const times: number[] = [];

  for (let i = 0; i < frameCount; i++) {
    times.push(i * frameDuration);
  }

  // Ensure we include the exact end time
  if (times.length > 0 && times[times.length - 1] < totalDuration) {
    times.push(totalDuration);
  }

  return times;
}
