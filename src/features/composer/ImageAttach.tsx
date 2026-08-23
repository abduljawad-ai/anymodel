import { useRef, useState } from 'react';
import { estimateTurnTokens } from '../../lib/tokens';

const MAX_EDGE = 1024;
const JPEG_QUALITY = 0.85;

/** Downscale an image file to ≤1024px JPEG data URL. */
export async function fileToDataUrl(file: File | Blob): Promise<string> {
  const bitmapUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = bitmapUrl;
    });
    const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
  } finally {
    URL.revokeObjectURL(bitmapUrl);
  }
}

/** Paperclip attach + paste support with preview chip and cancel. */
export function ImageAttach({
  image,
  setImage,
}: {
  image: string | null;
  setImage: (v: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function pick(files: FileList | null) {
    const f = files?.[0];
    if (!f || !f.type.startsWith('image/')) return;
    setBusy(true);
    try {
      setImage(await fileToDataUrl(f));
    } catch {
      setImage(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        className="icon-btn"
        title="Attach image (vision models)"
        aria-label="Attach image"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
      >
        📎
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => void pick(e.target.files)}
      />
      {image && (
        <div className="attach-preview">
          <img src={image} alt="preview" />
          <span>~{estimateTurnTokens({ content: '', imageUrl: image })} tok</span>
          <button className="icon-btn" aria-label="Remove attachment" onClick={() => setImage(null)}>
            ✕
          </button>
        </div>
      )}
    </>
  );
}
