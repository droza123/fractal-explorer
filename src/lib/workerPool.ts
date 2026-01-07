// Worker pool for parallel fractal rendering

import type { ViewBounds, Complex, FractalType } from '../types';

interface RenderTask {
  id: number;
  startY: number;
  endY: number;
  resolve: (data: Uint8ClampedArray) => void;
  reject: (error: Error) => void;
  message: unknown;
}

interface WorkerState {
  worker: Worker;
  busy: boolean;
  currentTask: RenderTask | null;
}

export interface RenderConfig {
  width: number;
  height: number;
  bounds: ViewBounds;
  maxIterations: number;
  fractalType: FractalType;
  juliaC?: Complex;
  equationId: number;
  palette?: number[];  // Flat array of RGB values (0-1), 64 colors = 192 values
  colorOffset?: number;  // Color offset for palette cycling (0-1)
  antiAlias?: number;  // Anti-aliasing samples per axis (1=off, 2=4x, 3=9x)
  onProgress?: (completed: number, total: number) => void;
}

export class WorkerPool {
  private workers: WorkerState[] = [];
  private taskQueue: RenderTask[] = [];
  private taskIdCounter = 0;
  private isDisposed = false;

  constructor(numWorkers?: number) {
    // Use navigator.hardwareConcurrency or default to 4
    const count = numWorkers ?? Math.min(navigator.hardwareConcurrency || 4, 8);

    for (let i = 0; i < count; i++) {
      const worker = new Worker(
        new URL('../workers/fractalWorker.ts', import.meta.url),
        { type: 'module' }
      );

      const state: WorkerState = {
        worker,
        busy: false,
        currentTask: null
      };

      worker.onmessage = (event) => this.handleWorkerMessage(state, event);
      worker.onerror = (error) => this.handleWorkerError(state, error);

      this.workers.push(state);
    }
  }

  private handleWorkerMessage(state: WorkerState, event: MessageEvent): void {
    const { type, id, data } = event.data;

    if (type === 'result' && state.currentTask && state.currentTask.id === id) {
      state.currentTask.resolve(data);
      state.currentTask = null;
      state.busy = false;
      this.processQueue();
    }
  }

  private handleWorkerError(state: WorkerState, error: ErrorEvent): void {
    // Extract detailed error info
    const errorMessage = error.message || 'Unknown worker error';
    const errorDetails = error.filename ? ` at ${error.filename}:${error.lineno}:${error.colno}` : '';
    console.error('[WorkerPool] Worker error:', errorMessage + errorDetails, error);

    if (state.currentTask) {
      state.currentTask.reject(new Error(errorMessage + errorDetails));
      state.currentTask = null;
      state.busy = false;
      this.processQueue();
    }
  }

  private processQueue(): void {
    if (this.taskQueue.length === 0) return;

    const availableWorker = this.workers.find(w => !w.busy);
    if (!availableWorker) return;

    const task = this.taskQueue.shift()!;
    availableWorker.busy = true;
    availableWorker.currentTask = task;

    availableWorker.worker.postMessage(task.message);
  }

  private submitTask(message: unknown): Promise<Uint8ClampedArray> {
    return new Promise((resolve, reject) => {
      const taskId = this.taskIdCounter++;
      const task: RenderTask = {
        id: taskId,
        startY: (message as { startY: number }).startY,
        endY: (message as { endY: number }).endY,
        resolve,
        reject,
        message: { ...(message as object), id: taskId }
      };

      this.taskQueue.push(task);
      this.processQueue();
    });
  }

  async render(config: RenderConfig): Promise<ImageData> {
    if (this.isDisposed) {
      throw new Error('WorkerPool has been disposed');
    }

    const { width, height, bounds, maxIterations, fractalType, juliaC, equationId, palette, colorOffset, antiAlias, onProgress } = config;

    // Divide the canvas into strips, one per worker
    const numStrips = this.workers.length * 2; // More strips for better load balancing
    const stripHeight = Math.ceil(height / numStrips);

    const strips: Array<{ startY: number; endY: number }> = [];
    for (let i = 0; i < numStrips; i++) {
      const startY = i * stripHeight;
      const endY = Math.min((i + 1) * stripHeight, height);
      if (startY < height) {
        strips.push({ startY, endY });
      }
    }

    let completedStrips = 0;
    const totalStrips = strips.length;

    // Submit all strips for rendering
    const renderPromises = strips.map(({ startY, endY }) => {
      const message = {
        type: 'render',
        startY,
        endY,
        width,
        height,
        bounds: {
          minReal: bounds.minReal,
          maxReal: bounds.maxReal,
          minImag: bounds.minImag,
          maxImag: bounds.maxImag
        },
        maxIterations,
        fractalType,
        juliaC,
        equationId,
        palette,
        colorOffset,
        antiAlias
      };

      return this.submitTask(message).then(data => {
        completedStrips++;
        onProgress?.(completedStrips, totalStrips);
        return { startY, endY, data };
      });
    });

    // Wait for all strips to complete
    const results = await Promise.all(renderPromises);

    // Combine results into final ImageData
    const imageData = new ImageData(width, height);
    const finalData = imageData.data;

    for (const { startY, endY, data } of results) {
      const stripHeight = endY - startY;
      for (let y = 0; y < stripHeight; y++) {
        const srcOffset = y * width * 4;
        const dstOffset = (startY + y) * width * 4;
        for (let i = 0; i < width * 4; i++) {
          finalData[dstOffset + i] = data[srcOffset + i];
        }
      }
    }

    return imageData;
  }

  dispose(): void {
    this.isDisposed = true;
    for (const { worker } of this.workers) {
      worker.terminate();
    }
    this.workers = [];
    this.taskQueue = [];
  }
}

// Singleton instance
let poolInstance: WorkerPool | null = null;

export function getWorkerPool(): WorkerPool {
  if (!poolInstance) {
    poolInstance = new WorkerPool();
  }
  return poolInstance;
}

export function disposeWorkerPool(): void {
  if (poolInstance) {
    poolInstance.dispose();
    poolInstance = null;
  }
}
