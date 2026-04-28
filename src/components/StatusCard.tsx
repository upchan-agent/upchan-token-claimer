'use client';

import { TokenConfig } from '@/config/tokens';
import { TokenStatus } from '@/lib/useToken';

interface Props {
  token: TokenConfig;
  status: TokenStatus;
  onRefresh: () => void;
}

export function StatusCard({ token, status, onRefresh }: Props) {
  const pct = token.supplyCap > 0 ? Math.min((status.totalSupply / token.supplyCap) * 100, 100) : 0;

  const rows = [
    { label: 'Supply', value: `${status.totalSupply} / ${token.supplyCap}`, bar: pct },
    ...[
      status.isSoulbound && { label: 'Soulbound', value: '✅ Yes' },
      status.revokable && { label: 'Revokable', value: '✅ Yes' },
      status.balanceCap > 0 && { label: 'Balance Cap', value: String(status.balanceCap) },
      { label: 'Cap Status', value: status.isSupplyCapFixed ? '🔒 Fixed' : 'Flexible' },
      { label: 'Mint Gate', value: status.mintGate !== '0x0000...0000' ? '✅ Set' : 'None' },
      { label: 'Gate Fixed', value: status.mintingDisabled ? '🔒' : status.mintGate !== '0x0000...0000' ? 'Flexible' : '—' },
      { label: 'Minting', value: status.mintingDisabled ? '🔒 Disabled' : status.isMintable ? '✅ Open' : '🔒 Closed' },
    ].filter(Boolean) as { label: string; value: string }[],
  ];

  return (
    <div className="card anim anim-d2" style={{ flexShrink: 0, position: 'relative', padding: 14 }}>
      <button onClick={onRefresh} disabled={status.isLoading}
        style={{
          position: 'absolute', top: 10, right: 10, width: 28, height: 28, padding: 0,
          border: 'none', borderRadius: '50%', background: 'var(--c-surface-secondary)',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, color: 'var(--c-text-muted)',
        }}>🔄</button>

      <h3 style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-text-muted)', marginBottom: 8, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
        Properties
      </h3>

      {rows.map((r, i) => (
        <div key={i} style={{ marginBottom: 2 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
            <span style={{ fontSize: 12, color: 'var(--c-text-muted)' }}>{r.label}</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-text)' }}>{r.value}</span>
          </div>
          {'bar' in r && r.bar !== undefined && (
            <div className="progress-track"><div className="progress-fill" style={{ width: `${r.bar}%` }} /></div>
          )}
        </div>
      ))}

      <a href={`https://universalprofile.cloud/${token.proxy}`} target="_blank" rel="noopener noreferrer"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 6, fontSize: 11, color: 'var(--c-text-link)', textDecoration: 'none', fontWeight: 600 }}>
        🆙 View on UP ↗
      </a>
    </div>
  );
}
