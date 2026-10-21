import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import { copyText } from '../utils/clipboard';

interface CopyButtonProps {
  text?: string;
  getText?: () => string;
  label: string;
  disabled?: boolean;
}

export function CopyButton({ text = '', getText, label, disabled = false }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      className="ghost-button"
      disabled={disabled}
      onClick={() => {
        const payload = getText ? getText() : text;
        void copyText(payload).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1200);
        });
      }}
    >
      {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
      {copied ? 'Copied' : label}
    </button>
  );
}
