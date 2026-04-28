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
    <div className="glass" style={{
      display: 'flex',
      gap: 4,
      padding: 4,
      flexShrink: 0,
    }}>
      {tokens
        .filter(t => enabledChainIds.includes(t.chainId))
        .map(t => (
          <button
            key={t.id}
            onClick={() => onSelect(t.id)}
            className="btn"
            style={{
              flex: 1,
              padding: '8px 14px',
              fontSize: 13,
              fontWeight: 600,
              background: selected === t.id
                ? 'linear-gradient(135deg, var(--c-brand-light), var(--c-brand))'
                : 'transparent',
              color: selected === t.id ? 'white' : 'var(--c-text-muted)',
              borderRadius: 'var(--radius-lg)',
              whiteSpace: 'nowrap',
              minHeight: 36,
            }}
          >
            {t.name}
          </button>
        ))}
    </div>
  );
}
