/** Global rule: exactly one audio plays at a time. */
let current: HTMLAudioElement | null = null;

export function stopAudio(): void {
  if (current) {
    current.pause();
    current.src = '';
    current = null;
  }
}

export async function playBlob(blob: Blob): Promise<void> {
  stopAudio();
  const url = URL.createObjectURL(blob);
  const el = new Audio(url);
  current = el;
  el.onended = () => {
    if (current === el) current = null;
    URL.revokeObjectURL(url);
  };
  await el.play();
}
