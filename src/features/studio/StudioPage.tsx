import { ImagePlus, Video } from 'lucide-react';

/**
 * Studio — image & video generation surface.
 * Phase 2 wires the generation engine into this page; for now it
 * renders the empty state so the route is real, not a dead link.
 */
export function StudioPage() {
  return (
    <div className="studio-page">
      <div className="studio-head">
        <h2>Studio</h2>
        <p>Generate images and videos with your own models — straight from your keys.</p>
      </div>

      <div className="studio-empty">
        <div className="studio-empty-icons" aria-hidden>
          <span className="studio-icon-tile"><ImagePlus size={22} /></span>
          <span className="studio-icon-tile"><Video size={22} /></span>
        </div>
        <h3>No generations yet</h3>
        <p>
          Add an OpenAI key (DALL·E / gpt-image-1 / Sora) or a Google key (Veo) in
          Settings, then create from the composer's <strong>Image</strong> or{' '}
          <strong>Video</strong> action. Everything you make lands here.
        </p>
      </div>
    </div>
  );
}
