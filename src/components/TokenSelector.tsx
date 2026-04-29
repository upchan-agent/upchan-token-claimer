'use client';

import { TokenConfig } from '@/config/tokens';

export function TokenSelector({
  tokens, selected, onSelect, enabledChainIds,
}: {
  tokens: TokenConfig[];
  selected: string;
  onSelect: (id: string) => void;
  enabledChainIds: number[];
}) {
  if (tokens.length <= 1) return null;

  return (
    <div className="pill-group">
      {tokens
        .filter(t => enabledChainIds.includes(t.chainId))
        .map(t => (
          <button
            key={t.id}
            onClick={() => onSelect(t.id)}
            className={`pill-item${selected === t.id ? ' pill-item--selected' : ''}`}
          >
            {t.name}
          </button>
        ))}
    </div>
  );
}
