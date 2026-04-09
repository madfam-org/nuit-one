import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkerManager } from './worker-manager.js';

// Mock Worker
class MockWorker {
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: ((e: ErrorEvent) => void) | null = null;
  postMessage = vi.fn();
  terminate = vi.fn();
}

vi.stubGlobal('Worker', MockWorker);
vi.stubGlobal('crypto', { randomUUID: () => 'test-uuid' });

describe('WorkerManager', () => {
  it('creates a worker and posts a message', async () => {
    const manager = new WorkerManager('/test-worker.js');

    const promise = manager.run('test', { data: 1 });

    // Simulate worker response
    const worker = (manager as unknown as { worker: MockWorker }).worker;
    expect(worker).toBeDefined();
    expect(worker.postMessage).toHaveBeenCalled();

    // Trigger result
    const msg = worker.postMessage.mock.calls[0]![0] as { payload: { id: string } };
    worker.onmessage?.({
      data: {
        type: 'result',
        payload: { id: msg.payload.id, result: 42 },
      },
    } as MessageEvent);

    const result = await promise;
    expect(result).toEqual({ id: msg.payload.id, result: 42 });
  });

  it('handles errors from worker', async () => {
    const manager = new WorkerManager('/test-worker.js');
    const promise = manager.run('test', { data: 1 });

    const worker = (manager as unknown as { worker: MockWorker }).worker;
    const msg = worker.postMessage.mock.calls[0]![0] as { payload: { id: string } };

    worker.onmessage?.({
      data: {
        type: 'error',
        payload: { id: msg.payload.id, message: 'test error' },
      },
    } as MessageEvent);

    await expect(promise).rejects.toThrow('test error');
  });

  it('terminates worker and rejects pending', async () => {
    const manager = new WorkerManager('/test-worker.js');
    const promise = manager.run('test', { data: 1 });
    manager.terminate();
    await expect(promise).rejects.toThrow('Worker terminated');
  });

  it('calls progress callback', async () => {
    const manager = new WorkerManager('/test-worker.js');
    const onProgress = vi.fn();
    const promise = manager.run('test', { data: 1 }, [], onProgress);

    const worker = (manager as unknown as { worker: MockWorker }).worker;
    const msg = worker.postMessage.mock.calls[0]![0] as { payload: { id: string } };

    worker.onmessage?.({
      data: { type: 'progress', payload: { id: msg.payload.id, progress: 0.5 } },
    } as MessageEvent);

    expect(onProgress).toHaveBeenCalledWith(0.5);

    worker.onmessage?.({
      data: { type: 'result', payload: { id: msg.payload.id, done: true } },
    } as MessageEvent);

    await promise;
  });
});
