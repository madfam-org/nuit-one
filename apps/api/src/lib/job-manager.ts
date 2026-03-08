export type JobStatus = 'queued' | 'downloading' | 'processing' | 'uploading' | 'complete' | 'error';

export interface Job {
  id: string;
  trackId: string;
  status: JobStatus;
  progress: number;
  error?: string;
  createdAt: number;
}

const jobs = new Map<string, Job>();

export function createJob(trackId: string): Job {
  const id = crypto.randomUUID();
  const job: Job = {
    id,
    trackId,
    status: 'queued',
    progress: 0,
    createdAt: Date.now(),
  };
  jobs.set(id, job);
  return job;
}

export function updateJob(id: string, update: Partial<Pick<Job, 'status' | 'progress' | 'error'>>): void {
  const job = jobs.get(id);
  if (job) Object.assign(job, update);
}

export function getJob(id: string): Job | undefined {
  return jobs.get(id);
}

// Clean up old jobs (older than 1 hour)
setInterval(() => {
  const cutoff = Date.now() - 60 * 60 * 1000;
  for (const [id, job] of jobs) {
    if (job.createdAt < cutoff) jobs.delete(id);
  }
}, 10 * 60 * 1000);
