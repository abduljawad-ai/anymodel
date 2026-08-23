/** Collision-resistant id: time prefix + random hex. */
export function uid(prefix = ''): string {
  const rnd = crypto.getRandomValues(new Uint8Array(8));
  const hex = [...rnd].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${prefix}${Date.now().toString(36)}-${hex}`;
}
