import { ApiError } from './types';

/** Map raw HTTP status → human copy (spec §6). */
export function humanize(status: number, detail: string): string {
  switch (status) {
    case 401:
      return `Key rejected — check it in Settings → Keys. ${detail}`.trim();
    case 403:
      return `Forbidden — your key may lack access here. ${detail}`.trim();
    case 404:
      return `Endpoint or model not found. ${detail}`.trim();
    case 429:
      return 'Rate limited — wait a moment and retry.';
    case 500:
    case 502:
    case 503:
      return `Provider server error (${status}) — retry shortly.`;
    default:
      return `Request failed (${status}). ${detail}`.trim();
  }
}

/** Throw a humanized ApiError unless the response is OK. */
export async function assertOk(res: Response): Promise<Response> {
  if (res.ok) return res;
  let detail = '';
  try {
    const j = await res.json();
    detail = j?.error?.message ?? String(JSON.stringify(j)).slice(0, 160);
  } catch {
    detail = res.statusText || '';
  }
  throw new ApiError(res.status, humanize(res.status, detail.trim()));
}
