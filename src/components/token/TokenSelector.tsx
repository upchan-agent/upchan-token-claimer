'use client';

import { TokenConfig } from '@/config/tokens';

export function TokenSelector({
  tokens, selected, onSelect,
}: {
  tokens: TokenConfig[];
  selected: string;
  onSelect: (id: string) => void;
}) {
  if (tokens.length <= 1) return null;

  return (
    <div className="pill-group">
      {tokens.map(t => (
        <button
          key={t.id}
          onClick={() => onSelect(t.id)}
          className={`pill-item${selected === t.id ? ' pill-item--selected' : ''}`}
        >
          {t.id}
        </button>
      ))}
    </div>
  );
}
