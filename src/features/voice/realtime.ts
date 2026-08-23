/**
 * Live voice chat over OpenAI Realtime (WebRTC).
 * Flow: API key → ephemeral client_secret → RTCPeerConnection w/ mic +
 * datachannel events → SDP answer. Transcript routed via callbacks.
 */
export interface LiveHandle {
  stop(): void;
  mute(m: boolean): void;
  sendText(text: string): void;
}

export interface LiveCallbacks {
  apiKey: string;
  model: string;
  onUser: (text: string) => void;
  onAssistant: (delta: string) => void;
  onState: (s: 'connecting' | 'listening') => void;
  onError: (msg: string) => void;
}

const REALTIME_BASE = 'https://api.openai.com/v1';

export async function startLive(o: LiveCallbacks): Promise<LiveHandle> {
  o.onState('connecting');

  const sres = await fetch(`${REALTIME_BASE}/realtime/sessions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${o.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: o.model, voice: 'alloy' }),
  });
  if (!sres.ok) throw new Error(`Realtime session rejected (${sres.status}). Check your OpenAI key/model.`);
  const secret = ((await sres.json()) as { client_secret?: { value?: string } }).client_secret?.value;
  if (!secret) throw new Error('No ephemeral secret returned.');

  const pc = new RTCPeerConnection();
  const audio = document.createElement('audio');
  audio.autoplay = true;
  pc.ontrack = (e) => {
    audio.srcObject = e.streams[0];
    void audio.play().catch(() => {});
  };

  const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
  mic.getAudioTracks().forEach((t) => pc.addTrack(t, mic));

  const dc = pc.createDataChannel('oai-events');
  dc.onopen = () => o.onState('listening');
  dc.onmessage = (ev) => {
    try {
      const j = JSON.parse(ev.data) as { type: string; delta?: string; transcript?: string; error?: { message: string } };
      if (j.type === 'response.audio_transcript.delta' && j.delta) o.onAssistant(j.delta);
      else if (j.type === 'conversation.item.input_audio_transcription.completed' && j.transcript) o.onUser(j.transcript);
      else if (j.type === 'error') o.onError(j.error?.message ?? 'Realtime error');
    } catch {
      /* ignore malformed frames */
    }
  };

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  // Wait for ICE candidates (bounded) so the SDP we send is complete.
  await new Promise<void>((res) => {
    if (pc.iceGatheringState === 'complete') return res();
    const t = setTimeout(res, 2000);
    pc.addEventListener('icegatheringstatechange', () => {
      if (pc.iceGatheringState === 'complete') {
        clearTimeout(t);
        res();
      }
    });
  });

  const ares = await fetch(`${REALTIME_BASE}/realtime?model=${encodeURIComponent(o.model)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/sdp' },
    body: pc.localDescription?.sdp ?? offer.sdp,
  });
  if (!ares.ok) {
    cleanup();
    throw new Error(`Realtime negotiation failed (${ares.status}).`);
  }
  await pc.setRemoteDescription({ type: 'answer', sdp: await ares.text() });

  function cleanup(): void {
    mic.getTracks().forEach((t) => t.stop());
    dc.close();
    pc.close();
    audio.remove();
  }

  return {
    stop: cleanup,
    mute: (m: boolean) => mic.getAudioTracks().forEach((t) => (t.enabled = !m)),
    sendText: (text: string) =>
      dc.send(JSON.stringify({ type: 'response.create', response: { instructions: text } })),
  };
}
