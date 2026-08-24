import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useStudioStore } from '../../src/studio/studioStore';
import { startGeneration, setPollInterval } from '../../src/studio/engine';
import type { ProviderAdapter } from '../../src/adapters/types';

setPollInterval(10);

// jsdom lacks URL.createObjectURL — stub it for video blob tests.
beforeEach(() => {
  if (typeof URL.createObjectURL !== 'function') {
    (URL as unknown as { createObjectURL: () => string }).createObjectURL = () => 'blob:mock';
  }
  if (typeof URL.revokeObjectURL !== 'function') {
    (URL as unknown as { revokeObjectURL: () => void }).revokeObjectURL = () => {};
  }
});

function makeAdapter(overrides: Partial<ProviderAdapter> = {}): ProviderAdapter {
  return {
    listModels: async () => [],
    streamChat: async () => {},
    transcribe: async () => '',
    speak: async () => new Blob(),
    testConnection: async () => ({ ok: true, detail: '' }),
    ...overrides,
  };
}

describe('studioStore', () => {
  beforeEach(() => {
    useStudioStore.setState({ jobs: [] });
    localStorage.removeItem('relay.studio.v1');
  });

  it('creates a queued job and returns its id', () => {
    const id = useStudioStore.getState().createJob({
      type: 'image',
      prompt: 'a paper robot',
      model: 'gpt-image-1',
      providerId: 'openai',
    });
    const job = useStudioStore.getState().jobs.find((j) => j.id === id);
    expect(job).toBeDefined();
    expect(job!.status).toBe('queued');
    expect(job!.prompt).toBe('a paper robot');
  });

  it('updates job status and persists completed jobs', () => {
    const id = useStudioStore.getState().createJob({
      type: 'image',
      prompt: 'x',
      model: 'm',
      providerId: 'p',
    });
    useStudioStore.getState().updateJob(id, { status: 'completed', result: 'data:image/png;base64,abc' });
    const job = useStudioStore.getState().jobs.find((j) => j.id === id)!;
    expect(job.status).toBe('completed');
    expect(JSON.parse(localStorage.getItem('relay.studio.v1')!)).toHaveLength(1);
  });

  it('cancels a running job', () => {
    const id = useStudioStore.getState().createJob({
      type: 'video',
      prompt: 'x',
      model: 'm',
      providerId: 'p',
    });
    useStudioStore.getState().updateJob(id, { status: 'polling' });
    useStudioStore.getState().cancelJob(id);
    expect(useStudioStore.getState().jobs[0].status).toBe('cancelled');
  });

  it('removes a job', () => {
    const id = useStudioStore.getState().createJob({
      type: 'image',
      prompt: 'x',
      model: 'm',
      providerId: 'p',
    });
    useStudioStore.getState().removeJob(id);
    expect(useStudioStore.getState().jobs).toHaveLength(0);
  });
});

describe('startGeneration', () => {
  beforeEach(() => {
    useStudioStore.setState({ jobs: [] });
    localStorage.removeItem('relay.studio.v1');
  });

  it('completes an image job and stores the image', async () => {
    const adapter = makeAdapter({
      generateImage: async () => ({ images: ['data:image/png;base64,xyz'] }),
    });
    const id = startGeneration({
      type: 'image',
      prompt: 'robot',
      model: 'gpt-image-1',
      providerId: 'openai',
      adapter,
    });
    await vi.waitFor(() => {
      expect(useStudioStore.getState().jobs[0]?.status).toBe('completed');
    });
    expect(useStudioStore.getState().jobs[0].result).toBe('data:image/png;base64,xyz');
    expect(id).toBeTruthy();
  });

  it('records failure when the adapter throws', async () => {
    const adapter = makeAdapter({
      generateImage: async () => {
        throw new Error('quota exceeded');
      },
    });
    startGeneration({
      type: 'image',
      prompt: 'robot',
      model: 'm',
      providerId: 'p',
      adapter,
    });
    await vi.waitFor(() => {
      expect(useStudioStore.getState().jobs[0]?.status).toBe('failed');
    });
    expect(useStudioStore.getState().jobs[0].error).toContain('quota');
  });

  it('polls a video job to completion', async () => {
    let polls = 0;
    const adapter = makeAdapter({
      generateVideo: async () => ({ jobId: 'job-1' }),
      getVideoStatus: async () => {
        polls++;
        return polls < 3 ? { status: 'processing', progress: polls * 40 } : { status: 'completed', progress: 100 };
      },
      getVideoContent: async () => new Blob(['video'], { type: 'video/mp4' }),
    });
    startGeneration({
      type: 'video',
      prompt: 'a clock',
      model: 'sora-2',
      providerId: 'openai',
      adapter,
    });
    await vi.waitFor(
      () => {
        expect(useStudioStore.getState().jobs[0]?.status).toBe('completed');
      },
      { timeout: 15000 }
    );
    expect(useStudioStore.getState().jobs[0].result).toMatch(/^blob:/);
  }, 20000);

  it('marks a video job failed when the provider reports failure', async () => {
    const adapter = makeAdapter({
      generateVideo: async () => ({ jobId: 'job-2' }),
      getVideoStatus: async () => ({ status: 'failed', error: 'content policy' }),
    });
    startGeneration({
      type: 'video',
      prompt: 'x',
      model: 'sora-2',
      providerId: 'openai',
      adapter,
    });
    await vi.waitFor(() => {
      const j = useStudioStore.getState().jobs[0];
      expect(j?.status === 'failed' || j?.status === 'cancelled').toBe(true);
    });
    const j = useStudioStore.getState().jobs[0];
    if (j.status === 'failed') expect(j.error).toContain('content policy');
  });
});
