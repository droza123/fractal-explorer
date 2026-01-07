// Video codec support detection - simplified for FFmpeg.wasm only

// Check if FFmpeg.wasm can be loaded (requires WebAssembly)
export function isFFmpegWasmSupported(): boolean {
  return typeof WebAssembly !== 'undefined';
}

// Check if SharedArrayBuffer is available (needed for FFmpeg.wasm multi-threading)
export function isSharedArrayBufferSupported(): boolean {
  return typeof SharedArrayBuffer !== 'undefined';
}

// Get browser compatibility message
export function getBrowserCompatibilityMessage(): string {
  if (!isFFmpegWasmSupported()) {
    return 'Your browser does not support WebAssembly, which is required for video export.';
  }

  if (!isSharedArrayBufferSupported()) {
    return 'Video export requires specific server headers (COOP/COEP). Please ensure these are configured.';
  }

  return '';
}
