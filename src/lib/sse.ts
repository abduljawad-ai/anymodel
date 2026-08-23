export interface SSEEvent {
  event?: string;
  data: string;
}

/**
 * Incremental Server-Sent-Events frame parser.
 * Frames dispatch on a blank line; multi-line `data:` fields join with '\n';
 * `event:` is captured; comments and other fields are ignored.
 */
export class SSEFrameParser {
  private eventName?: string;
  private dataLines: string[] = [];

  push(line: string): SSEEvent | null {
    if (line === '') return this.flush();
    if (line.startsWith(':')) return null; // comment / keep-alive
    const colon = line.indexOf(':');
    const field = colon === -1 ? line : line.slice(0, colon);
    let value = colon === -1 ? '' : line.slice(colon + 1);
    if (value.startsWith(' ')) value = value.slice(1);
    if (field === 'event') {
      this.eventName = value;
    } else if (field === 'data') {
      this.dataLines.push(value);
    }
    return null;
  }

  /** Dispatch any pending frame (used at EOF when stream lacks trailing newline). */
  flush(): SSEEvent | null {
    if (this.dataLines.length === 0) {
      this.eventName = undefined;
      return null;
    }
    const ev: SSEEvent = { data: this.dataLines.join('\n') };
    if (this.eventName) ev.event = this.eventName;
    this.eventName = undefined;
    this.dataLines = [];
    return ev;
  }
}

/** Async-iterate SSE events from a fetch body. */
export async function* readSSE(body: ReadableStream<Uint8Array>): AsyncGenerator<SSEEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const parser = new SSEFrameParser();
  let buf = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buf.indexOf('\n')) !== -1) {
        const raw = buf.slice(0, nl);
        buf = buf.slice(nl + 1);
        const ev = parser.push(raw.endsWith('\r') ? raw.slice(0, -1) : raw);
        if (ev) yield ev;
      }
    }
    // Flush trailing partial line, then any pending frame.
    const tailRaw = buf.endsWith('\r') ? buf.slice(0, -1) : buf;
    const tail = tailRaw ? parser.push(tailRaw) : parser.flush();
    if (tail) {
      yield tail;
    } else {
      const flushed = parser.flush();
      if (flushed) yield flushed;
    }
  } finally {
    reader.releaseLock();
  }
}

/** Build a ReadableStream from string chunks — for tests and mock servers. */
export function streamFromStrings(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(c) {
      for (const chunk of chunks) c.enqueue(encoder.encode(chunk));
      c.close();
    },
  });
}
