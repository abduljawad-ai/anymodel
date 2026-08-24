import { create } from 'zustand';
import { uid as newId } from '../lib/id';

export type JobType = 'image' | 'video';
export type JobStatus = 'queued' | 'running' | 'polling' | 'completed' | 'failed' | 'cancelled';

export interface GenerationJob {
  id: string;
  type: JobType;
  prompt: string;
  model: string;
  providerId: string;
  status: JobStatus;
  progress?: number;
  /** data URL (image) or object URL (video) once complete */
  result?: string;
  revisedPrompt?: string;
  error?: string;
  createdAt: number;
  completedAt?: number;
}

const LS_JOBS = 'relay.studio.v1';

function loadJobs(): GenerationJob[] {
  try {
    const raw = localStorage.getItem(LS_JOBS);
    if (!raw) return [];
    const jobs = JSON.parse(raw) as GenerationJob[];
    // Only completed jobs survive reloads (running jobs die with the session).
    return jobs.filter((j) => j.status === 'completed' && j.result);
  } catch {
    return [];
  }
}

function saveJobs(jobs: GenerationJob[]): void {
  try {
    const done = jobs.filter((j) => j.status === 'completed' && j.result).slice(-100);
    localStorage.setItem(LS_JOBS, JSON.stringify(done));
  } catch {
    /* storage full — drop silently */
  }
}

interface StudioState {
  jobs: GenerationJob[];
  createJob(input: Omit<GenerationJob, 'id' | 'status' | 'createdAt'>): string;
  updateJob(id: string, patch: Partial<GenerationJob>): void;
  cancelJob(id: string): void;
  removeJob(id: string): void;
}

export const useStudioStore = create<StudioState>((set, get) => ({
  jobs: loadJobs(),
  createJob(input) {
    const job: GenerationJob = {
      ...input,
      id: newId(),
      status: 'queued',
      createdAt: Date.now(),
    };
    set((s) => ({ jobs: [job, ...s.jobs] }));
    return job.id;
  },
  updateJob(id, patch) {
    set((s) => ({
      jobs: s.jobs.map((j) => (j.id === id ? { ...j, ...patch } : j)),
    }));
    const finished = get().jobs.find((j) => j.id === id);
    if (finished?.status === 'completed' || finished?.status === 'failed') saveJobs(get().jobs);
  },
  cancelJob(id) {
    set((s) => ({
      jobs: s.jobs.map((j) => (j.id === id && (j.status === 'queued' || j.status === 'running' || j.status === 'polling') ? { ...j, status: 'cancelled' } : j)),
    }));
  },
  removeJob(id) {
    set((s) => ({ jobs: s.jobs.filter((j) => j.id !== id) }));
    saveJobs(get().jobs);
  },
}));
