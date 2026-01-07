import { useRef, useCallback, useEffect } from 'react';

export interface TouchGestureHandlers {
  onPanStart?: (x: number, y: number) => void;
  onPanMove?: (x: number, y: number, deltaX: number, deltaY: number) => void;
  onPanEnd?: () => void;
  onPinchStart?: (centerX: number, centerY: number) => void;
  onPinchMove?: (centerX: number, centerY: number, scale: number) => void;
  onPinchEnd?: () => void;
  onDoubleTap?: (x: number, y: number) => void;
  onSingleTap?: (x: number, y: number) => void;
  // New handlers for Heatmap "explore" mode
  onSingleFingerMove?: (x: number, y: number) => void; // Fires on single-finger drag (before pan logic)
  onTwoFingerPanMove?: (deltaX: number, deltaY: number) => void; // Fires when two fingers move (for panning)
}

export interface TouchGestureOptions {
  // In 'explore' mode, single finger doesn't pan, just fires onSingleFingerMove
  // Two-finger touch handles both zoom (pinch) and pan (drag)
  singleFingerMode?: 'pan' | 'explore';
}

interface TouchState {
  isPanning: boolean;
  isPinching: boolean;
  lastTouchX: number;
  lastTouchY: number;
  initialPinchDistance: number;
  pinchCenterX: number;
  pinchCenterY: number;
  lastPinchCenterX: number; // For tracking two-finger pan
  lastPinchCenterY: number;
  lastTapTime: number;
  lastTapX: number;
  lastTapY: number;
}

function getDistance(touch1: Touch, touch2: Touch): number {
  const dx = touch1.clientX - touch2.clientX;
  const dy = touch1.clientY - touch2.clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

function getCenter(touch1: Touch, touch2: Touch): { x: number; y: number } {
  return {
    x: (touch1.clientX + touch2.clientX) / 2,
    y: (touch1.clientY + touch2.clientY) / 2,
  };
}

export function useTouchGestures(
  elementRef: React.RefObject<HTMLElement>,
  handlers: TouchGestureHandlers,
  options: TouchGestureOptions = {}
) {
  const stateRef = useRef<TouchState>({
    isPanning: false,
    isPinching: false,
    lastTouchX: 0,
    lastTouchY: 0,
    initialPinchDistance: 0,
    pinchCenterX: 0,
    pinchCenterY: 0,
    lastPinchCenterX: 0,
    lastPinchCenterY: 0,
    lastTapTime: 0,
    lastTapX: 0,
    lastTapY: 0,
  });

  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  const optionsRef = useRef(options);
  optionsRef.current = options;

  const getTouchCoords = useCallback((touch: Touch, element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    return {
      x: (touch.clientX - rect.left) * dpr,
      y: (touch.clientY - rect.top) * dpr,
    };
  }, []);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    const element = elementRef.current;
    if (!element) return;

    const state = stateRef.current;
    const touches = e.touches;
    const mode = optionsRef.current.singleFingerMode || 'pan';

    if (touches.length === 1) {
      // Single touch - could be pan, explore, or tap
      const touch = touches[0];
      const coords = getTouchCoords(touch, element);

      state.lastTouchX = coords.x;
      state.lastTouchY = coords.y;
      state.isPanning = true;
      state.isPinching = false;

      // Only fire pan start in pan mode
      if (mode === 'pan') {
        handlersRef.current.onPanStart?.(coords.x, coords.y);
      }
    } else if (touches.length === 2) {
      // Two touches - pinch/pan gesture
      e.preventDefault();

      state.isPanning = false;
      state.isPinching = true;
      state.initialPinchDistance = getDistance(touches[0], touches[1]);

      const center = getCenter(touches[0], touches[1]);
      const rect = element.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;

      state.pinchCenterX = (center.x - rect.left) * dpr;
      state.pinchCenterY = (center.y - rect.top) * dpr;
      // Track last center for two-finger panning
      state.lastPinchCenterX = state.pinchCenterX;
      state.lastPinchCenterY = state.pinchCenterY;

      handlersRef.current.onPinchStart?.(state.pinchCenterX, state.pinchCenterY);
    }
  }, [elementRef, getTouchCoords]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    const element = elementRef.current;
    if (!element) return;

    const state = stateRef.current;
    const touches = e.touches;
    const mode = optionsRef.current.singleFingerMode || 'pan';

    if (state.isPinching && touches.length === 2) {
      e.preventDefault();

      const currentDistance = getDistance(touches[0], touches[1]);
      const scale = currentDistance / state.initialPinchDistance;

      const center = getCenter(touches[0], touches[1]);
      const rect = element.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;

      const centerX = (center.x - rect.left) * dpr;
      const centerY = (center.y - rect.top) * dpr;

      // Fire pinch move for zoom
      handlersRef.current.onPinchMove?.(centerX, centerY, scale);

      // Fire two-finger pan move for panning (center point movement)
      const panDeltaX = centerX - state.lastPinchCenterX;
      const panDeltaY = centerY - state.lastPinchCenterY;
      if (Math.abs(panDeltaX) > 0.5 || Math.abs(panDeltaY) > 0.5) {
        handlersRef.current.onTwoFingerPanMove?.(panDeltaX, panDeltaY);
      }

      // Update for continuous pinching
      state.initialPinchDistance = currentDistance;
      state.lastPinchCenterX = centerX;
      state.lastPinchCenterY = centerY;
    } else if (state.isPanning && touches.length === 1) {
      const touch = touches[0];
      const coords = getTouchCoords(touch, element);

      const deltaX = coords.x - state.lastTouchX;
      const deltaY = coords.y - state.lastTouchY;

      if (mode === 'explore') {
        // In explore mode, fire single finger move (for preview)
        handlersRef.current.onSingleFingerMove?.(coords.x, coords.y);
      } else {
        // In pan mode, fire pan move
        handlersRef.current.onPanMove?.(coords.x, coords.y, deltaX, deltaY);
      }

      state.lastTouchX = coords.x;
      state.lastTouchY = coords.y;
    }
  }, [elementRef, getTouchCoords]);

  const handleTouchEnd = useCallback((e: TouchEvent) => {
    const element = elementRef.current;
    if (!element) return;

    const state = stateRef.current;
    const touches = e.touches;
    const changedTouches = e.changedTouches;
    const mode = optionsRef.current.singleFingerMode || 'pan';

    if (state.isPinching) {
      if (touches.length < 2) {
        state.isPinching = false;
        handlersRef.current.onPinchEnd?.();

        // If one finger still down, start panning/exploring
        if (touches.length === 1) {
          const touch = touches[0];
          const coords = getTouchCoords(touch, element);
          state.isPanning = true;
          state.lastTouchX = coords.x;
          state.lastTouchY = coords.y;
          if (mode === 'pan') {
            handlersRef.current.onPanStart?.(coords.x, coords.y);
          }
        }
      }
    } else if (state.isPanning) {
      if (touches.length === 0) {
        state.isPanning = false;

        // Check for tap / double tap
        const touch = changedTouches[0];
        const coords = getTouchCoords(touch, element);
        const now = Date.now();
        const timeSinceLastTap = now - state.lastTapTime;
        const distFromLastTap = Math.sqrt(
          Math.pow(coords.x - state.lastTapX, 2) +
          Math.pow(coords.y - state.lastTapY, 2)
        );

        // Check if this was a tap (minimal movement)
        const wasTap = Math.abs(coords.x - state.lastTouchX) < 20 &&
                       Math.abs(coords.y - state.lastTouchY) < 20;

        if (wasTap) {
          if (timeSinceLastTap < 300 && distFromLastTap < 50) {
            // Double tap
            handlersRef.current.onDoubleTap?.(coords.x, coords.y);
            state.lastTapTime = 0; // Reset to prevent triple-tap
          } else {
            // Single tap - store for potential double tap
            state.lastTapTime = now;
            state.lastTapX = coords.x;
            state.lastTapY = coords.y;

            // Fire single tap after delay if no double tap follows
            setTimeout(() => {
              if (state.lastTapTime === now) {
                handlersRef.current.onSingleTap?.(coords.x, coords.y);
              }
            }, 300);
          }
        }

        // Only fire pan end in pan mode
        if (mode === 'pan') {
          handlersRef.current.onPanEnd?.();
        }
      }
    }
  }, [elementRef, getTouchCoords]);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    // Use passive: false to allow preventDefault for pinch
    element.addEventListener('touchstart', handleTouchStart, { passive: false });
    element.addEventListener('touchmove', handleTouchMove, { passive: false });
    element.addEventListener('touchend', handleTouchEnd, { passive: true });
    element.addEventListener('touchcancel', handleTouchEnd, { passive: true });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
      element.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [elementRef, handleTouchStart, handleTouchMove, handleTouchEnd]);
}
