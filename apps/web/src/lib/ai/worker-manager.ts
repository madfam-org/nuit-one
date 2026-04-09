export interface WorkerMessage<T = unknown> {
  type: string;
  payload: T;
}

export interface WorkerResult<T = unknown> {
  type: 'result' | 'progress' | 'error';
  payload: T;
}

export class WorkerManager {
  private worker: Worker | null = null;
  private pending = new Map<
    string,
    {
      resolve: (value: unknown) => void;
      reject: (reason: unknown) => void;
      onProgress?: (progress: number) => void;
    }
  >();

  constructor(private workerUrl: string) {}

  private ensureWorker(): Worker {
    if (!this.worker) {
      this.worker = new Worker(this.workerUrl);
      this.worker.onmessage = (e: MessageEvent<WorkerResult>) => {
        const { type, payload } = e.data;
        const id = (payload as { id?: string })?.id ?? 'default';
        const entry = this.pending.get(id);
        if (!entry) return;

        if (type === 'progress') {
          entry.onProgress?.((payload as { progress: number }).progress);
        } else if (type === 'result') {
          entry.resolve(payload);
          this.pending.delete(id);
        } else if (type === 'error') {
          entry.reject(new Error((payload as { message: string }).message));
          this.pending.delete(id);
        }
      };
      this.worker.onerror = (err) => {
        for (const [, entry] of this.pending) {
          entry.reject(err);
        }
        this.pending.clear();
      };
    }
    return this.worker;
  }

  async run<TResult>(
    type: string,
    payload: unknown,
    transferables: Transferable[] = [],
    onProgress?: (progress: number) => void,
  ): Promise<TResult> {
    const id = crypto.randomUUID();
    const worker = this.ensureWorker();

    return new Promise<TResult>((resolve, reject) => {
      this.pending.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
        onProgress,
      });
      worker.postMessage({ type, payload: { ...(payload as object), id } }, transferables);
    });
  }

  terminate(): void {
    this.worker?.terminate();
    this.worker = null;
    for (const [, entry] of this.pending) {
      entry.reject(new Error('Worker terminated'));
    }
    this.pending.clear();
  }
}
