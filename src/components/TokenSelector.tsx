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
            style={{
              flex: 1,
              padding: 'var(--space-xs) 18px',
              fontSize: 14, fontWeight: 600,
              lineHeight: 1.29, letterSpacing: '-0.016em',
              background: selected === t.id ? 'var(--c-accent)' : 'transparent',
              color: selected === t.id ? '#fff' : 'var(--c-text-tertiary)',
              border: 'none', borderRadius: 'var(--radius-pill)',
              cursor: 'pointer', fontFamily: 'inherit',
              transition: 'all 0.2s ease',
              whiteSpace: 'nowrap',
            }}
          >
            {t.name}
          </button>
        ))}
    </div>
  );
}
