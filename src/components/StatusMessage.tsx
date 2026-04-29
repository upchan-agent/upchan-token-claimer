'use client';

/**
 * Unified status display for mint states.
 * All variants share the same structure: title + optional caption.
 */

type Variant = 'claimed' | 'soldout' | 'closed' | 'unavailable' | 'not-following';

interface Props {
  variant: Variant;
  title: string;
  caption?: string;
}

export function StatusMessage({ variant, title, caption }: Props) {
  return (
    <div className={`status-message status-message--${variant}`}>
      <p className="status-message-title">{title}</p>
      {caption && <p className="status-message-caption">{caption}</p>}
    </div>
  );
}
