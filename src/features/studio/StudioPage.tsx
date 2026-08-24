import { useEffect, useMemo, useState } from 'react';
import { Image as ImageIcon, Video, LoaderCircle, CircleAlert, Trash2, Download } from 'lucide-react';
import { Button } from '../../ui/Button';
import { Textarea } from '../../ui/Textarea';
import { useStudioStore } from '../../studio/studioStore';
import { startGeneration } from '../../studio/engine';
import { createAdapter } from '../../adapters/factory';
import { resolveDeps } from '../../vault/gate';
import { cachedModels, ensureModels, isLoaded } from '../../catalog';
import { useVaultStore } from '../../vault/vaultStore';
import { PROVIDERS, listProviders } from '../../catalog/providers';
import { toast } from '../../lib/toast';
import type { ModelInfo, ProviderId } from '../../catalog/types';

type GenType = 'image' | 'video';

function hasCap(models: ModelInfo[], cap: 'image' | 'video'): ModelInfo[] {
  return models.filter((m) => m.caps.includes(cap));
}

/** Providers with a stored key, in display order. */
function keyedProviders() {
  const keys = useVaultStore.getState().keys;
  return listProviders().filter((p) => keys[p.id]);
}

export function StudioPage() {
  const jobs = useStudioStore((s) => s.jobs);
  const [type, setType] = useState<GenType>('image');
  const [prompt, setPrompt] = useState('');
  const [providerId, setProviderId] = useState<ProviderId>('');
  const [model, setModel] = useState('');
  const [loadingModels, setLoadingModels] = useState(false);
  const [modelsTick, setModelsTick] = useState(0);

  const providers = useMemo(
    () => keyedProviders().map((p) => p.id),
    [jobs.length, modelsTick],
  );
  const cap: 'image' | 'video' = type;
  const models = useMemo(
    () => (providerId ? hasCap(cachedModels(providerId), cap) : []),
    [providerId, cap, modelsTick],
  );

  // Default provider/model once keys or capability change.
  useEffect(() => {
    if (!providers.length) return;
    if (!providerId || !providers.includes(providerId)) {
      setProviderId(providers[0]);
    }
  }, [providers, providerId]);

  useEffect(() => {
    if (!providerId) return;
    const load = async () => {
      if (!isLoaded(providerId)) {
        setLoadingModels(true);
        try {
          await ensureModels(providerId);
        } catch {
          toast(`Could not load ${PROVIDERS[providerId]?.name ?? providerId} models`);
        } finally {
          setLoadingModels(false);
        }
      }
      setModelsTick((t) => t + 1);
    };
    void load();
    const onChange = () => setModelsTick((t) => t + 1);
    window.addEventListener('relay-models-changed', onChange);
    return () => window.removeEventListener('relay-models-changed', onChange);
  }, [providerId]);

  useEffect(() => {
    // Pick a sensible model for the chosen type.
    if (models.length && !models.some((m) => m.id === model)) {
      setModel(models[0].id);
    } else if (!models.length) {
      setModel('');
    }
  }, [models, model]);

  const canGenerate = Boolean(prompt.trim() && providerId && model && !loadingModels);

  function generate() {
    if (!canGenerate || !providerId || !model) return;
    const adapter = createAdapter(providerId, resolveDeps(providerId));
    const supports =
      type === 'image'
        ? typeof adapter.generateImage === 'function'
        : typeof adapter.generateVideo === 'function';
    if (!supports) {
      toast(`${PROVIDERS[providerId]?.name ?? providerId} does not support ${type} generation`);
      return;
    }
    startGeneration({ type, prompt: prompt.trim(), model, providerId, adapter });
    setPrompt('');
    toast(type === 'image' ? 'Generating image…' : 'Generating video — this can take a minute…');
  }

  if (providers.length === 0) {
    return (
      <div className="studio-page">
        <div className="studio-head">
          <h2>Studio</h2>
          <p>Generate images and videos with your own models — straight from your keys.</p>
        </div>
        <div className="studio-empty">
          <div className="studio-empty-icons" aria-hidden>
            <span className="studio-icon-tile"><ImageIcon size={22} /></span>
            <span className="studio-icon-tile"><Video size={22} /></span>
          </div>
          <h3>No API keys yet</h3>
          <p>
            Studio needs a key from a provider that offers generation — OpenAI
            (gpt-image-1, dall-e-3, Sora) or Google (Veo). Add one in Settings → Keys.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="studio-page">
      <div className="studio-head">
        <h2>Studio</h2>
        <p>Generate images and videos with your own models — nothing leaves this browser except calls to your provider.</p>
      </div>

      <div className="studio-form">
        <div className="studio-type-row" role="tablist" aria-label="Generation type">
          {(['image', 'video'] as const).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={type === t}
              className={`studio-type-btn ${type === t ? 'on' : ''}`}
              onClick={() => setType(t)}
            >
              {t === 'image' ? <ImageIcon size={15} aria-hidden /> : <Video size={15} aria-hidden />}
              {t === 'image' ? 'Image' : 'Video'}
            </button>
          ))}
        </div>

        <div className="studio-form-grid">
          <label className="ui-field">
            <span className="ui-label">Provider</span>
            <select className="ui-input" value={providerId} onChange={(e) => setProviderId(e.target.value)} aria-label="Provider">
              {providers.map((p) => (
                <option key={p} value={p}>{PROVIDERS[p]?.name ?? p}</option>
              ))}
            </select>
          </label>

          <label className="ui-field">
            <span className="ui-label">
              {type === 'image' ? 'Image models' : 'Video models'}
              {loadingModels && <span className="dots" aria-label="loading"><i /><i /><i /></span>}
            </span>
            <select className="ui-input" value={model} onChange={(e) => setModel(e.target.value)} aria-label="Model" disabled={loadingModels || models.length === 0}>
              {models.length === 0 && <option value="">{loadingModels ? 'Loading models…' : `No ${type} models found`}</option>}
              {models.map((m) => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
          </label>
        </div>

        <Textarea
          label="Prompt"
          placeholder={type === 'image' ? 'Describe the image you want to create…' : 'Describe the video you want to create…'}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={3}
        />

        <div className="studio-form-actions">
          <Button onClick={generate} disabled={!canGenerate}>
            {type === 'image' ? <ImageIcon size={15} aria-hidden /> : <Video size={15} aria-hidden />}
            Generate {type}
          </Button>
          {models.length === 0 && !loadingModels && (
            <span className="studio-hint">
              No {type}-capable models on {PROVIDERS[providerId]?.name ?? 'this provider'} — its live model list has no {type} models.
            </span>
          )}
        </div>
      </div>

      {jobs.length > 0 && (
        <>
          <div className="rail-section-header">GENERATIONS</div>
          <div className="studio-grid">
            {jobs.map((j) => (
              <JobCard key={j.id} job={j} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function JobCard({ job }: { job: ReturnType<typeof useStudioStore.getState>['jobs'][number] }) {
  const removeJob = useStudioStore((s) => s.removeJob);
  const cancelJob = useStudioStore((s) => s.cancelJob);
  const active = job.status === 'queued' || job.status === 'running' || job.status === 'polling';

  function download() {
    if (!job.result) return;
    const a = document.createElement('a');
    a.href = job.result;
    a.download = `relay-${job.type}-${job.id}.${job.type === 'image' ? 'png' : 'mp4'}`;
    a.click();
  }

  return (
    <div className="studio-card">
      {job.status === 'completed' && job.result && (
        job.type === 'image' ? (
          <img src={job.result} alt={job.prompt} loading="lazy" />
        ) : (
          <video src={job.result} controls preload="metadata" />
        )
      )}
      {active && (
        <div className="studio-card-loading">
          <LoaderCircle className="spin" size={22} aria-hidden />
          <span>{job.status === 'polling' ? `${Math.round(job.progress ?? 0)}%` : 'Working…'}</span>
          <button className="btn btn-sm" onClick={() => cancelJob(job.id)}>Cancel</button>
        </div>
      )}
      {job.status === 'failed' && (
        <div className="studio-card-error">
          <CircleAlert size={18} aria-hidden />
          <span>{job.error ?? 'Failed'}</span>
        </div>
      )}
      <div className="meta">
        <span title={job.prompt}>{job.prompt.slice(0, 42)}{job.prompt.length > 42 ? '…' : ''}</span>
        <span className="studio-card-actions">
          {job.status === 'completed' && (
            <button className="icon-btn" title="Download" aria-label="Download" onClick={download}>
              <Download size={13} aria-hidden />
            </button>
          )}
          <button className="icon-btn" title="Remove" aria-label="Remove" onClick={() => removeJob(job.id)}>
            <Trash2 size={13} aria-hidden />
          </button>
        </span>
      </div>
    </div>
  );
}
