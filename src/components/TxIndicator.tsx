'use client';

import { useState, useRef, useEffect } from 'react';
import { useTxContext, TxRecord } from '@/lib/tx-context';
import { CHAINS } from '@/config/tokens';

// ─── Single tx row ──────────────────────────────────────

function TxRow({ tx }: { tx: TxRecord }) {
  const chain = CHAINS[tx.chainId];
  const explorerUrl = chain && tx.txHash
    ? `${chain.explorer}/tx/${tx.txHash}`
    : null;

  const icon = tx.status === 'pending' ? '◉' : tx.status === 'confirmed' ? '✓' : '✗';
  const ago = formatAgo(tx.timestamp);

  const inner = (
    <div className={`tx-row tx-row--${tx.status}`}>
      <span className="tx-row-icon">{icon}</span>
      <div className="tx-row-body">
        <span className="tx-row-label">{tx.label}</span>
        {tx.status === 'failed' && tx.error && (
          <span className="tx-row-error">{tx.error}</span>
        )}
        {tx.txHash && (
          <span className="tx-row-hash">
            {tx.txHash.slice(0, 8)}&hellip;{tx.txHash.slice(-6)}
          </span>
        )}
      </div>
      <span className="tx-row-ago">{ago}</span>
    </div>
  );

  if (explorerUrl) {
    return (
      <a href={explorerUrl} target="_blank" rel="noopener noreferrer" className="tx-row-link">
        {inner}
      </a>
    );
  }
  return inner;
}

// ─── Time formatting ────────────────────────────────────

function formatAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 5) return 'now';
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h`;
}

// ─── Indicator + dropdown ───────────────────────────────

export function TxIndicator() {
  const { recentTxs, isAnyPending } = useTxContext();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const pendingCount = recentTxs.filter(t => t.status === 'pending').length;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        className={`btn-icon tx-trigger${isAnyPending ? ' tx-trigger--active' : ''}`}
        title={isAnyPending ? `${pendingCount} pending` : 'Transactions'}
      >
        <span className={`tx-dot${isAnyPending ? ' tx-dot--pending' : ''}`} />
        {pendingCount > 0 && (
          <span className="tx-count">{pendingCount}</span>
        )}
      </button>

      {open && (
        <div className="tx-dropdown">
          {recentTxs.length === 0 ? (
            <div className="tx-empty">No transactions</div>
          ) : (
            recentTxs.slice(0, 10).map(tx => <TxRow key={tx.id} tx={tx} />)
          )}
        </div>
      )}
    </div>
  );
}
