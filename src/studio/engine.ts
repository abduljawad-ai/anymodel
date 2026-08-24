import type { ProviderAdapter, ImageGenOpts, VideoGenOpts } from '../adapters/types';
import { useStudioStore, type GenerationJob } from './studioStore';

const POLL_MS = 3000;
const MAX_POLLS = 200; // ~10 minutes ceiling

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Test hook — overrides the poll interval. */
let pollMs = POLL_MS;
export function setPollInterval(ms: number): void {
  pollMs = ms;
}

/** Run an image generation job end-to-end (single request). */
async function runImageJob(
  jobId: string,
  adapter: ProviderAdapter,
  opts: ImageGenOpts,
  signal: { cancelled(): boolean },
): Promise<void> {
  const store = useStudioStore.getState();
  store.updateJob(jobId, { status: 'running' });
  const result = await adapter.generateImage!(opts);
  if (signal.cancelled()) return;
  store.updateJob(jobId, {
    status: 'completed',
    result: result.images[0],
    revisedPrompt: result.revisedPrompt,
    completedAt: Date.now(),
    progress: 100,
  });
}

/** Run a video job: kick off, poll to completion, download content. */
async function runVideoJob(
  jobId: string,
  adapter: ProviderAdapter,
  opts: VideoGenOpts,
  signal: { cancelled(): boolean },
): Promise<void> {
  const store = useStudioStore.getState();
  store.updateJob(jobId, { status: 'running' });
  const handle = await adapter.generateVideo!(opts);
  if (signal.cancelled()) return;
  store.updateJob(jobId, { status: 'polling', progress: 0 });

  for (let i = 0; i < MAX_POLLS; i++) {
    if (signal.cancelled()) return;
    await sleep(pollMs);
    if (signal.cancelled()) return;
    const status = await adapter.getVideoStatus!(handle);
    if (status.status === 'completed') {
      const blob = await adapter.getVideoContent!(handle);
      if (signal.cancelled()) return;
      const url = URL.createObjectURL(blob);
      store.updateJob(jobId, { status: 'completed', result: url, progress: 100, completedAt: Date.now() });
      return;
    }
    if (status.status === 'failed') {
      store.updateJob(jobId, { status: 'failed', error: status.error ?? 'Generation failed' });
      return;
    }
    store.updateJob(jobId, { status: 'polling', progress: status.progress });
  }
  store.updateJob(jobId, { status: 'failed', error: 'Timed out waiting for the provider' });
}

/**
 * Fire a generation job. Resolves immediately with the job id; the job
 * progresses in the background and updates the studio store. Never throws —
 * failures land on the job record.
 */
export function startGeneration(input: {
  type: 'image' | 'video';
  prompt: string;
  model: string;
  providerId: string;
  adapter: ProviderAdapter;
  size?: string;
  quality?: string;
  seconds?: number;
}): string {
  const jobId = useStudioStore.getState().createJob({
    type: input.type,
    prompt: input.prompt,
    model: input.model,
    providerId: input.providerId,
  });

  const signal = {
    cancelled: () => {
      const j = useStudioStore.getState().jobs.find((x) => x.id === jobId);
      return !j || j.status === 'cancelled';
    },
  };

  void (async () => {
    try {
      if (input.type === 'image') {
        await runImageJob(jobId, input.adapter, {
          prompt: input.prompt,
          model: input.model,
          size: input.size,
          quality: input.quality,
        }, signal);
      } else {
        await runVideoJob(jobId, input.adapter, {
          prompt: input.prompt,
          model: input.model,
          seconds: input.seconds,
          size: input.size,
        }, signal);
      }
    } catch (e) {
      if (!signal.cancelled()) {
        useStudioStore.getState().updateJob(jobId, {
          status: 'failed',
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }
  })();

  return jobId;
}

/** Find a job by id (helper for consumers). */
export function getJob(id: string): GenerationJob | undefined {
  return useStudioStore.getState().jobs.find((j) => j.id === id);
}
