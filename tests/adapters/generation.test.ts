import { OpenAIAdapter } from '../../src/adapters/openai';
import { GoogleAdapter } from '../../src/adapters/google';
import type { ProviderAdapter } from '../../src/adapters/types';

const oa = new OpenAIAdapter({ baseUrl: 'https://api.openai.test/v1', apiKey: () => 'sk-k' });
const ga = new GoogleAdapter({ baseUrl: 'https://gl.test/v1beta', apiKey: () => 'g-key' });

function mockFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  return vi
    .spyOn(globalThis, 'fetch')
    .mockImplementation(async (url, init) => handler(String(url), init));
}

describe('OpenAI image generation', () => {
  it('posts to /images/generations and returns data URLs from b64', async () => {
    const fm = mockFetch((url) => {
      expect(url).toBe('https://api.openai.test/v1/images/generations');
      return new Response(
        JSON.stringify({ data: [{ b64_json: 'QUJD' }, { url: 'https://img.test/a.png' }] }),
        { status: 200 },
      );
    });
    const res = await oa.generateImage({ prompt: 'robot', model: 'gpt-image-1', size: '1024x1024' });
    expect(res.images).toHaveLength(2);
    expect(res.images[0]).toBe('data:image/png;base64,QUJD');
    expect(res.images[1]).toBe('https://img.test/a.png');
    fm.mockRestore();
  });

  it('throws when the provider returns no images', async () => {
    const fm = mockFetch(() => new Response(JSON.stringify({ data: [] }), { status: 200 }));
    await expect(oa.generateImage({ prompt: 'x', model: 'gpt-image-1' })).rejects.toThrow(/no images/i);
    fm.mockRestore();
  });
});

describe('OpenAI video (Sora) jobs', () => {
  it('creates a job via multipart POST and polls status to completion', async () => {
    const fm = mockFetch((url) => {
      if (url.endsWith('/videos')) {
        return new Response(JSON.stringify({ id: 'job_1' }), { status: 200 });
      }
      if (url.endsWith('/videos/job_1')) {
        return new Response(JSON.stringify({ status: 'in_progress', progress: 42 }), { status: 200 });
      }
      throw new Error('unexpected ' + url);
    });
    const handle = await oa.generateVideo({ prompt: 'clock', model: 'sora-2', seconds: 4 });
    expect(handle.jobId).toBe('job_1');
    const st = await oa.getVideoStatus(handle);
    expect(st.status).toBe('processing');
    expect(st.progress).toBe(42);
    fm.mockRestore();
  });

  it('maps failed status with an error message', async () => {
    const fm = mockFetch(
      () => new Response(JSON.stringify({ status: 'failed', error: { message: 'policy' } }), { status: 200 }),
    );
    const st = await oa.getVideoStatus({ jobId: 'j' });
    expect(st.status).toBe('failed');
    expect(st.error).toBe('policy');
    fm.mockRestore();
  });

  it('downloads content as a blob', async () => {
    const fm = mockFetch((url) => {
      expect(url).toBe('https://api.openai.test/v1/videos/j/content');
      return new Response(new Uint8Array([1, 2, 3]), { status: 200 });
    });
    const blob = await oa.getVideoContent({ jobId: 'j' });
    expect(blob.size).toBe(3);
    fm.mockRestore();
  });
});

describe('Google Veo', () => {
  it('starts a long-running operation and polls it to a video URI', async () => {
    const fm = mockFetch((url) => {
      if (url.includes(':predictLongRunning')) {
        return new Response(JSON.stringify({ name: 'operations/abc' }), { status: 200 });
      }
      if (url.includes('operations/abc')) {
        return new Response(
          JSON.stringify({
            done: true,
            response: { generateVideoResponse: { generatedSamples: [{ video: { uri: 'https://video.test/v.mp4' } }] } },
          }),
          { status: 200 },
        );
      }
      if (url === 'https://video.test/v.mp4') {
        return new Response(new Uint8Array([9, 9, 9]), { status: 200 });
      }
      throw new Error('unexpected ' + url);
    });
    const handle = await ga.generateVideo({ prompt: 'waves', model: 'veo-3.0' });
    expect(handle.jobId).toBe('operations/abc');
    const st = await ga.getVideoStatus(handle);
    expect(st.status).toBe('completed');
    const blob = await ga.getVideoContent(handle);
    expect(blob.size).toBeGreaterThan(0);
    fm.mockRestore();
  });

  it('reports operation errors as failures', async () => {
    const fm = mockFetch(() => new Response(JSON.stringify({ done: true, error: { message: 'bad' } }), { status: 200 }));
    const st = await ga.getVideoStatus({ jobId: 'operations/x' });
    expect(st.status).toBe('failed');
    expect(st.error).toBe('bad');
    fm.mockRestore();
  });
});

describe('adapter capability surface', () => {
  it('anthropic exposes no generation methods', async () => {
    const { AnthropicAdapter } = await import('../../src/adapters/anthropic');
    const a: ProviderAdapter = new AnthropicAdapter({ baseUrl: 'https://a.test', apiKey: () => 'k' });
    expect(a.generateImage).toBeUndefined();
    expect(a.generateVideo).toBeUndefined();
  });
});
