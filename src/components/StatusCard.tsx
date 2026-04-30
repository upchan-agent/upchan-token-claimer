'use client';

import { ethers } from 'ethers';
import { TokenConfig, assetUrl } from '@/config/tokens';
import { TokenStatus } from '@/lib/useToken';
import { YesIcon, NoIcon, DashIcon } from './Icons';
import { EmojiText } from './EmojiText';

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

function StatusIcon({ value }: { value: PropValue }) {
  const cls = `status-icon--${value}`;
  const size = 14;
  switch (value) {
    case 'yes':
      return <span className={cls}><YesIcon size={size} /></span>;
    case 'no':
      return <span className={cls}><NoIcon size={size} /></span>;
    case 'none':
      return <span className={cls}><DashIcon size={size} /></span>;
  }
  return null;
}

export function StatusCard({ token, status, chain }: Props) {
  const displayCap = status.supplyCap;
  const pct = displayCap > 0
    ? Math.min((status.totalSupply / displayCap) * 100, 100)
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

  // All properties always shown — card size maintains stable layout
  // Loading state shows dashes for visual consistency
  const load = status.isLoading;
  const properties: PropRow[] = [
    {
      label: 'Soulbound',
      value: load ? 'none' : (status.isSoulbound ? 'yes' : 'no'),
      display: load ? '-' : (status.isSoulbound ? 'Yes' : 'No'),
    },
    {
      label: 'Revokable',
      value: load ? 'none' : (status.revokable ? 'yes' : 'no'),
      display: load ? '-' : (status.revokable ? 'Yes' : 'No'),
    },
    {
      label: 'Balance Cap',
      value: load ? 'none' : (status.balanceCap > 0 ? 'yes' : 'none'),
      display: load ? '-' : (status.balanceCap > 0 ? String(status.balanceCap) : '-'),
    },
    {
      label: 'Cap Status',
      value: load ? 'none' : (status.isSupplyCapFixed ? 'yes' : 'none'),
      display: load ? '-' : (status.isSupplyCapFixed ? 'Fixed' : 'Flexible'),
    },
  ];

  return (
    <div className="card anim anim-d2">
      <span className="section-label"><EmojiText>🍭 Details 🍭</EmojiText></span>

      {/* Contract — link to universaleverything.io */}
      <div className="data-row">
        <span className="data-label">Contract</span>
        <a
          href={assetUrl(ethers.getAddress(token.proxy), token.chainId)}
          target="_blank"
          rel="noopener noreferrer"
          className="data-value link"
        >
          {ethers.getAddress(token.proxy).slice(0, 10)}…{ethers.getAddress(token.proxy).slice(-6)} ↗
        </a>
      </div>

      {/* Network */}
      <div className="data-row">
        <span className="data-label">Network</span>
        <span className="data-value">{chain.name}</span>
      </div>

      {/* Status */}
      <div className="data-row">
        <span className="data-label">Status</span>
        <span className="data-value">
          <span className={`status-pill ${statusClass}`}>{statusLabel}</span>
        </span>
      </div>

      {/* Supply */}
      <div className="data-row data-row--supply" style={{ border: 'none' }}>
        <span className="data-label">Supply</span>
        <span className="data-value">
          <div className="progress-fill" style={{ width: `${pct}%` }} />
          <span>{status.totalSupply} / {displayCap}</span>
        </span>
      </div>

      {/* Properties — all 4 rows fixed, icon + value display */}
      <div className="card-section">
        <span className="section-label"><EmojiText>🍬 Properties 🍬</EmojiText></span>
        {properties.map((p) => (
          <div className="data-row" key={p.label}>
            <span className="data-label">{p.label}</span>
            <StatusIcon value={p.value} />
            <span className="data-value">{p.display}</span>
          </div>
        ))}
      </div>

      {/* Error */}
      {status.error && (
        <div className="error-box">{status.error}</div>
      )}
    </div>
  );
}
