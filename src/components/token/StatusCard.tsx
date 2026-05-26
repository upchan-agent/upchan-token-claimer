'use client';

import { ethers } from 'ethers';
import { TokenConfig, assetUrl, profileUrl } from '@/config/tokens';
import { TokenStatus } from '@/hooks/useTokenStatus';
import { useProfileMetadata } from '@/hooks/useProfile';
import { YesIcon, NoIcon, DashIcon } from '../Icons';
import { EmojiText } from '../EmojiText';

function fmtSoulbound(s: TokenStatus): string {
  if (!s.transferLockEnabled) {
    if (s.isTransferable) return 'No';
    if (s.isSoulbound) return 'Yes';
    return '—';
  }
  if (!s.isSoulbound) return 'No';
  if (s.transferLockStart === 0n && s.transferLockEnd > 2n ** 200n) return 'Forever';
  if (s.isTransferable) return 'No';
  const fmt = (ts: bigint) => {
    const d = new Date(Number(ts) * 1000);
    return `'${d.getFullYear().toString().slice(-2)}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getDate().toString().padStart(2,'0')}`;
  };
  if (s.transferLockStart > 0n && s.transferLockEnd === 0n) return `${fmt(s.transferLockStart)}\u007e`;
  if (s.transferLockStart === 0n && s.transferLockEnd > 0n) return `\u007e${fmt(s.transferLockEnd)}`;
  return `${fmt(s.transferLockStart)}-${fmt(s.transferLockEnd)}`;
}

function fmtRevokable(s: TokenStatus): string {
  if (!s.revokable) return 'No';
  return s.holdExtensionCount > 0 ? 'Yes (By Hold Gates) 🛡' : 'Yes (No Hold Gates) 🔓';
}

function fmtLockStatus(locked: boolean, ruleCount = 0): string {
  const base = locked ? 'Fixed 🔏' : 'Editable 📝';
  return ruleCount > 0 ? `${base} ${ruleCount} Rules` : base;
}

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

/** Opacity fade only the VALUE part — labels stay visible.
 *  CSS transition is in .value-fade class; only opacity toggles inline. */
const fade = (ready: boolean) => ({
  opacity: ready ? 1 : 0,
});

export function StatusCard({ token, status, chain }: Props) {
  const load = status.isLoading;
  const ownerMeta = useProfileMetadata(status.owner, token.chainId);

  // contentReady = server data + owner profile metadata both available
  const contentReady = !load && !ownerMeta.isLoading;

  // ─── Supply (always computed from current props) ───
  const supplyCapNum = status.supplyCap === 0n || status.supplyCap >= (2n ** 256n - 1n) / 2n
    ? null
    : Number(status.supplyCap);
  const totalSupplyNum = Number(status.totalSupply);
  const pct = supplyCapNum
    ? Math.min((totalSupplyNum / supplyCapNum) * 100, 100)
    : 0;

  // ─── Status pill (always real value — invisible until ready) ───
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

  // ─── Properties (always real values — invisible until ready) ───
  const properties: PropRow[] = [
    {
      label: 'Soulbound',
      value: status.isSoulbound ? 'yes' : 'no',
      display: fmtSoulbound(status),
    },
    {
      label: 'Revokable',
      value: status.revokable ? 'yes' : 'no',
      display: fmtRevokable(status),
    },
    {
      label: 'Balance Cap',
      value: status.balanceCap > 0n ? 'yes' : 'none',
      display: status.balanceCap > 0n ? String(status.balanceCap) : '—',
    },
    {
      label: 'Cap Status',
      value: status.isSupplyCapLocked ? 'yes' : 'none',
      display: fmtLockStatus(status.isSupplyCapLocked),
    },
  ];

  return (
    <div className="card anim anim-d2">
      {/* ═══════════════════════════════════════════
          Details — labels always visible, values fade in
          ═══════════════════════════════════════════ */}
      <div className="card-section">
        <span className="section-label"><EmojiText>🍭 Details 🍭</EmojiText></span>

        {/* Contract — static from config */}
        <div className="data-row">
          <span className="data-label">Contract</span>
          <a
            href={assetUrl(ethers.getAddress(token.proxy), token.chainId)}
            target="_blank"
            rel="noopener noreferrer"
            className="data-value link"
          >
            {ethers.getAddress(token.proxy).slice(0, 10)}…{ethers.getAddress(token.proxy).slice(-6)}
          </a>
        </div>

        {/* Owner — label visible, value fades */}
        <div className="data-row">
          <span className="data-label">Owner</span>
          <a
            href={profileUrl(status.owner)}
            target="_blank"
            rel="noopener noreferrer"
            className="data-value link value-fade"
            style={fade(contentReady)}
          >
            {ownerMeta.data?.image && (
              <img
                src={ownerMeta.data.image.replace('ipfs://', 'https://ipfs.io/ipfs/')}
                alt=""
                style={{ width: 16, height: 16, borderRadius: '50%', display: 'inline-block', verticalAlign: 'middle', marginRight: 4 }}
              />
            )}
            {status.owner === ethers.ZeroAddress
              ? 'Renounced'
              : (ownerMeta.data?.name || `${status.owner.slice(0, 10)}…${status.owner.slice(-4)}`)}
          </a>
        </div>

        {/* Network — static from config */}
        <div className="data-row">
          <span className="data-label">Network</span>
          <span className="data-value">{chain.name}</span>
        </div>

        {/* Status — label visible, pill fades */}
        <div className="data-row">
          <span className="data-label">Status</span>
          <span className="data-value value-fade" style={fade(contentReady)}>
            <span className={`status-pill ${statusClass}`}>{statusLabel}</span>
          </span>
        </div>

        {/* Supply — label visible, bar + count fade */}
        <div className="data-row data-row--supply">
          <span className="data-label">Supply</span>
          <span className="data-value value-fade" style={fade(contentReady)}>
            <div className="progress-fill" style={{ width: `${pct}%` }} />
            <span>{totalSupplyNum} / {supplyCapNum ?? '∞'}</span>
          </span>
        </div>
      </div>

      {/* ═══════════════════════════════════════════
          Properties — labels always visible, values fade in
          ═══════════════════════════════════════════ */}
      <div className="card-section">
        <span className="section-label"><EmojiText>🍬 Properties 🍬</EmojiText></span>

        {properties.map((p) => (
          <div className="data-row" key={p.label}>
            <span className="data-label">{p.label}</span>
            <span style={fade(contentReady)}><StatusIcon value={p.value} /></span>
            <span className="data-value value-fade" style={fade(contentReady)}>{p.display}</span>
          </div>
        ))}

        {/* Mint Conditions — label visible, icon + value fade */}
        <div className="data-row">
          <span className="data-label">Mint Conditions</span>
          <span style={fade(contentReady)}>
            <StatusIcon value={status.mintConditionsLocked ? 'yes' : 'none'} />
          </span>
            <span className="data-value value-fade" style={fade(contentReady)}>
              {fmtLockStatus(status.mintConditionsLocked, status.mintExtensionCount)}
            </span>
          </div>

        {/* Hold Conditions */}
        <div className="data-row">
          <span className="data-label">Hold Conditions</span>
          <span style={fade(contentReady)}>
            <StatusIcon value={status.holdConditionsLocked ? 'yes' : 'none'} />
          </span>
            <span className="data-value value-fade" style={fade(contentReady)}>
              {fmtLockStatus(status.holdConditionsLocked, status.holdExtensionCount)}
            </span>
        </div>
      </div>

      {/* Error */}
      {status.error && (
        <div className="error-box">{status.error}</div>
      )}
    </div>
  );
}
