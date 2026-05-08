'use client';

import { ethers } from 'ethers';
import { TokenConfig, assetUrl, profileUrl } from '@/config/tokens';
import { TokenStatus } from '@/hooks/useTokenStatus';
import { useProfileMetadata } from '@/hooks/useProfile';
import { YesIcon, NoIcon, DashIcon } from '../Icons';

function fmtSoulbound(s: TokenStatus): string {
  if (!s.isSoulbound) return 'No';
  if (!s.transferLockEnabled) return 'Free';
  if (s.transferLockStart === 0n && s.transferLockEnd > 2n ** 200n) return 'Forever';
  if (s.isTransferable) return 'Free';
  const fmt = (ts: bigint) => {
    const d = new Date(Number(ts) * 1000);
    return `'${d.getFullYear().toString().slice(-2)}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getDate().toString().padStart(2,'0')}`;
  };
  if (s.transferLockStart > 0n && s.transferLockEnd === 0n) return `${fmt(s.transferLockStart)}\u007e`;
  if (s.transferLockStart === 0n && s.transferLockEnd > 0n) return `\u007e${fmt(s.transferLockEnd)}`;
  return `${fmt(s.transferLockStart)}-${fmt(s.transferLockEnd)}`;
}
import { EmojiText } from '../EmojiText';

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
  const supplyCapNum = status.supplyCap === 0n || status.supplyCap >= (2n ** 256n - 1n) / 2n
    ? null
    : Number(status.supplyCap);
  const totalSupplyNum = Number(status.totalSupply);
  const pct = supplyCapNum
    ? Math.min((totalSupplyNum / supplyCapNum) * 100, 100)
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
  const ownerMeta = useProfileMetadata(status.owner, token.chainId);
  const properties: PropRow[] = [
    {
      label: 'Soulbound',
      value: load ? 'none' : (status.isSoulbound ? 'yes' : 'no'),
      display: load ? '-' : fmtSoulbound(status),
    },
    {
      label: 'Revokable',
      value: load ? 'none' : (status.revokable ? 'yes' : 'no'),
      display: load ? '-' : (
        !status.revokable ? 'No'
        : status.holdGate !== '0x0000000000000000000000000000000000000000' ? 'Yes'
        : 'Yes (no Hold Gate)'
      ),
    },
    {
      label: 'Balance Cap',
      value: load ? 'none' : (status.balanceCap > 0n ? 'yes' : 'none'),
      display: load ? '-' : (status.balanceCap > 0n ? String(status.balanceCap) : '-'),
    },
    {
      label: 'Cap Status',
      value: load ? 'none' : (status.isSupplyCapLocked ? 'yes' : 'none'),
      display: load ? '-' : (status.isSupplyCapLocked ? 'Locked' : 'Flexible'),
    },
  ];

  return (
    <div className="card anim anim-d2">
      <div className="card-section">
        <span className="section-label"><EmojiText>🍭 Details 🍭</EmojiText></span>

        {/* Contract */}
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

        {/* Owner */}
        <div className="data-row">
          <span className="data-label">Owner</span>
          {load ? (
            <span className="data-value">-</span>
          ) : (
            <a
              href={profileUrl(status.owner)}
              target="_blank"
              rel="noopener noreferrer"
              className="data-value link"
            >
              {ownerMeta.data?.image && (
                <img
                  src={ownerMeta.data.image.replace('ipfs://', 'https://ipfs.io/ipfs/')}
                  alt=""
                  style={{ width: 16, height: 16, borderRadius: '50%', display: 'inline-block', verticalAlign: 'middle', marginRight: 4 }}
                />
              )}
              {ownerMeta.data?.name || `${status.owner.slice(0, 10)}…${status.owner.slice(-4)}`} ↗
            </a>
          )}
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
        <div className="data-row data-row--supply">
          <span className="data-label">Supply</span>
          <span className="data-value">
            <div className="progress-fill" style={{ width: `${pct}%` }} />
            <span>{totalSupplyNum} / {supplyCapNum ?? '∞'}</span>
          </span>
        </div>
      </div>

      {/* Properties */}
      <div className="card-section">
        <span className="section-label"><EmojiText>🍬 Properties 🍬</EmojiText></span>
        {properties.map((p) => (
          <div className="data-row" key={p.label}>
            <span className="data-label">{p.label}</span>
            <StatusIcon value={p.value} />
            <span className="data-value">{p.display}</span>
          </div>
        ))}

        {/* Mint Gate */}
        <div className="data-row">
          <span className="data-label">Mint Gate</span>
          {load || status.mintGate === '0x0000000000000000000000000000000000000000' ? (
            <>
              <StatusIcon value="none" />
              <span className="data-value">-</span>
            </>
          ) : (
            <>
              <StatusIcon value="yes" />
              <a
                href={`${chain.explorer}/address/${status.mintGate}`}
                target="_blank"
                rel="noopener noreferrer"
                className="data-value link"
              >
                {status.mintGate.slice(0, 10)}…{status.mintGate.slice(-4)}{status.isMintGateLocked ? ' 🔒' : ''} ↗
              </a>
            </>
          )}
        </div>

        {/* Hold Gate */}
        <div className="data-row">
          <span className="data-label">Hold Gate</span>
          {load || status.holdGate === '0x0000000000000000000000000000000000000000' ? (
            <>
              <StatusIcon value="none" />
              <span className="data-value">-</span>
            </>
          ) : (
            <>
              <StatusIcon value="yes" />
              <a
                href={`${chain.explorer}/address/${status.holdGate}`}
                target="_blank"
                rel="noopener noreferrer"
                className="data-value link"
              >
                {status.holdGate.slice(0, 10)}…{status.holdGate.slice(-4)}{status.isHoldGateLocked ? ' 🔒' : ''} ↗
              </a>
            </>
          )}
        </div>
      </div>

      {/* Error */}
      {status.error && (
        <div className="error-box">{status.error}</div>
      )}
    </div>
  );
}
