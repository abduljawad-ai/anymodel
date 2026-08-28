import { useState } from 'react';
import { BookOpen } from 'lucide-react';
import { Dialog } from '../../ui/Dialog';

const PROMPTS = [
  { label: 'Explain...', content: 'Please explain the following in simple terms:\n\n' },
  { label: 'Write...', content: 'Please write the following:\n\n' },
  { label: 'Debug...', content: 'Please help me debug the following code. Explain what is wrong and how to fix it:\n\n' },
  { label: 'Summarize...', content: 'Please summarize the following text in bullet points:\n\n' },
  { label: 'Compare...', content: 'Please compare and contrast the following:\n\n' },
  { label: 'Translate...', content: 'Please translate the following to English:\n\n' },
  { label: 'Design...', content: 'Please design the following:\n\n' },
  { label: 'Review...', content: 'Please review the following and suggest improvements:\n\n' },
];

export function PromptLibrary({ onSelect }: { onSelect: (prompt: string) => void }) {
  const [open, setOpen] = useState(false);

  function handleSelect(content: string) {
    onSelect(content);
    setOpen(false);
  }

  return (
    <>
      <button
        className="icon-btn"
        title="Prompt library"
        aria-label="Open prompt library"
        onClick={() => setOpen(true)}
      >
        <BookOpen size={16} aria-hidden />
      </button>

      <Dialog open={open} onClose={() => setOpen(false)} title="Prompt Library" width={480}>
        <div className="prompt-list">
          {PROMPTS.map((prompt) => (
            <button
              key={prompt.label}
              className="prompt-item"
              onClick={() => handleSelect(prompt.content)}
            >
              <span className="prompt-label">{prompt.label}</span>
              <span className="prompt-preview">{prompt.content}</span>
            </button>
          ))}
        </div>
      </Dialog>
    </>
  );
}
