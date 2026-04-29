'use client';

import { TokenConfig } from '@/config/tokens';
import { TokenStatus } from '@/lib/useToken';
import { YesIcon, NoIcon, DashIcon } from './Icons';

interface Props {
  token: TokenConfig;
  status: TokenStatus;
  chain: { name: string; explorer: string };
  onRefresh: () => void;
}

type PropValue = 'yes' | 'no' | 'none';

interface PropRow {
  label: string;
  value: PropValue;
  display: string;
}

function PropIcon({ value }: { value: PropValue }) {
  const cls = `prop-icon--${value}`;
  const size = 14;
  switch (value) {
    case 'yes':
      return <span className={cls}><YesIcon size={size} /></span>;
    case 'no':
      return <span className={cls}><NoIcon size={size} /></span>;
    case 'none':
      return <span className={cls}><DashIcon size={size} /></span>;
  }
}

export function StatusCard({ token, status, chain }: Props) {
  const pct = token.supplyCap > 0
    ? Math.min((status.totalSupply / token.supplyCap) * 100, 100)
    : 0;

  const statusClass = status.mintingDisabled
    ? 'status-pill--closed'
    : status.isMintable
      ? 'status-pill--open'
      : 'status-pill--paused';
  const statusLabel = status.mintingDisabled
    ? 'Minting Closed'
    : status.isMintable
      ? 'Minting Open'
      : 'Paused';

  /* All properties always shown — card size never changes per contract */
  const properties: PropRow[] = [
    {
      label: 'Soulbound',
      value: status.isSoulbound ? 'yes' : 'no',
      display: status.isSoulbound ? 'Yes' : 'No',
    },
    {
      label: 'Revokable',
      value: status.revokable ? 'yes' : 'no',
      display: status.revokable ? 'Yes' : 'No',
    },
    {
      label: 'Balance Cap',
      value: status.balanceCap > 0 ? 'yes' : 'none',
      display: status.balanceCap > 0 ? String(status.balanceCap) : '—',
    },
    {
      label: 'Cap Status',
      value: status.isSupplyCapFixed ? 'yes' : 'no',
      display: status.isSupplyCapFixed ? 'Fixed' : 'Flexible',
    },
  ];

  return (
    <div className="card anim anim-d2">
      <span className="section-label">Details</span>

      {/* Contract — link to Universal Explorer (no copy button) */}
      <div className="data-row">
        <span className="data-label">Contract</span>
        <a
          href={`https://universalprofile.cloud/${token.proxy}`}
          target="_blank"
          rel="noopener noreferrer"
          className="data-cell-link font-mono"
        >
          {token.proxy.slice(0, 8)}…{token.proxy.slice(-6)} ↗
        </a>
      </div>

      {/* Network */}
      <div className="data-row">
        <span className="data-label">Network</span>
        <span className="data-value">{chain.name}</span>
      </div>

      {/* Supply */}
      <div className="data-row">
        <span className="data-label">Supply</span>
        <span className="data-value">
          {status.totalSupply} / {token.supplyCap}
        </span>
      </div>
      <div className="progress-track" style={{ marginTop: 'var(--space-2xs)', marginBottom: 2 }}>
        <div className="progress-fill" style={{ width: `${pct}%` }} />
      </div>

      {/* Status */}
      <div className="data-row" style={{ border: 'none', paddingTop: 'var(--space-xs)' }}>
        <span className="data-label">Status</span>
        <span className={`status-pill ${statusClass}`}>{statusLabel}</span>
      </div>

      {/* Properties — all 4 rows fixed, icon + value display */}
      <div className="card-section">
        <span className="section-label">Properties</span>
        {properties.map((p) => (
          <div className="data-row" key={p.label}>
            <span className="data-label">{p.label}</span>
            <span className="prop-value">
              <PropIcon value={p.value} />
              <span>{p.display}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
