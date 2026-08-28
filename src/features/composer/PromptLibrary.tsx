import { useState } from 'react';
import { X, BookOpen } from 'lucide-react';
import { IconButton } from '../../ui/IconButton';

interface Prompt {
  id: string;
  title: string;
  content: string;
  category: string;
}

const BUILT_IN_PROMPTS: Prompt[] = [
  {
    id: 'summarize',
    title: 'Summarize text',
    content: 'Please summarize the following text in bullet points:\n\n',
    category: 'Writing',
  },
  {
    id: 'improve',
    title: 'Improve writing',
    content: 'Please improve the writing of the following text, making it more clear and professional:\n\n',
    category: 'Writing',
  },
  {
    id: 'translate',
    title: 'Translate',
    content: 'Please translate the following text to English:\n\n',
    category: 'Writing',
  },
  {
    id: 'explain',
    title: 'Explain concept',
    content: 'Please explain the following concept in simple terms:\n\n',
    category: 'Learning',
  },
  {
    id: 'debug',
    title: 'Debug code',
    content: 'Please help me debug the following code. Explain what is wrong and how to fix it:\n\n',
    category: 'Coding',
  },
  {
    id: 'review',
    title: 'Code review',
    content: 'Please review the following code and suggest improvements:\n\n',
    category: 'Coding',
  },
  {
    id: 'brainstorm',
    title: 'Brainstorm ideas',
    content: 'Please brainstorm 5 creative ideas for:\n\n',
    category: 'Ideas',
  },
  {
    id: 'pros-cons',
    title: 'Pros and cons',
    content: 'Please list the pros and cons of:\n\n',
    category: 'Analysis',
  },
];

interface PromptLibraryProps {
  onSelect: (prompt: string) => void;
}

export function PromptLibrary({ onSelect }: PromptLibraryProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = BUILT_IN_PROMPTS.filter(
    (p) =>
      !search ||
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.category.toLowerCase().includes(search.toLowerCase())
  );

  const categories = [...new Set(filtered.map((p) => p.category))];

  if (!open) {
    return (
      <button
        className="icon-btn"
        title="Prompt library"
        aria-label="Open prompt library"
        onClick={() => setOpen(true)}
      >
        <BookOpen size={16} aria-hidden />
      </button>
    );
  }

  return (
    <div
      className="overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
      style={{ zIndex: 1000 }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Prompt library"
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'var(--surface)',
          border: '1px solid var(--hairline)',
          borderRadius: 12,
          padding: 24,
          maxWidth: 500,
          width: '90%',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>Prompt Library</h2>
          <IconButton
            icon={<X size={16} aria-hidden />}
            aria-label="Close"
            onClick={() => setOpen(false)}
          />
        </div>
        <input
          placeholder="Search prompts..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ marginBottom: 16 }}
          aria-label="Search prompts"
        />
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {categories.map((category) => (
            <div key={category} style={{ marginBottom: 16 }}>
              <h3 style={{ margin: '0 0 8px', fontSize: 14, color: 'var(--muted)' }}>{category}</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {filtered
                  .filter((p) => p.category === category)
                  .map((prompt) => (
                    <button
                      key={prompt.id}
                      onClick={() => {
                        onSelect(prompt.content);
                        setOpen(false);
                      }}
                      style={{
                        textAlign: 'left',
                        padding: '12px',
                        background: 'var(--paper)',
                        border: '1px solid var(--hairline)',
                        borderRadius: 8,
                        cursor: 'pointer',
                        transition: 'border-color 0.15s',
                      }}
                      onMouseEnter={(e) => {
                        (e.target as HTMLElement).style.borderColor = 'var(--accent)';
                      }}
                      onMouseLeave={(e) => {
                        (e.target as HTMLElement).style.borderColor = 'var(--hairline)';
                      }}
                    >
                      <div style={{ fontWeight: 500, marginBottom: 4 }}>{prompt.title}</div>
                      <div style={{ fontSize: 12, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {prompt.content}
                      </div>
                    </button>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
