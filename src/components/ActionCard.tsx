'use client';

import { useUpProvider } from '@/lib/up-provider';
import { useMint, useBurn, TokenStatus } from '@/lib/useToken';
import { TokenConfig } from '@/config/tokens';
import { EmojiText } from './EmojiText';
import { GateRenderer } from './gates/GateRenderer';
import { HoldGateInfo } from './HoldGateInfo';

interface Props {
  token: TokenConfig;
  status: TokenStatus;
  chain: { name: string; explorer: string };
  onRefetch: () => void;
  displayAddress?: `0x${string}` | null;
  walletAddress?: `0x${string}` | null;
}

export function ActionCard({ token, status, chain, onRefetch, displayAddress, walletAddress }: Props) {
  const { accounts, isConnected } = useUpProvider();
  const connectedWallet = accounts[0] || null;
  const actionUser = connectedWallet;

  const { mint, isPending: mintPending } = useMint(token, actionUser, onRefetch);
  const { burn, isPending: burnPending } = useBurn(token, actionUser, onRefetch);

  // ─── Derived state ───
  const hasMintGate = status.mintGate !== '0x0000000000000000000000000000000000000000';
  const hasHoldGate = status.holdGate !== '0x0000000000000000000000000000000000000000';
  const isAtMaxBalance = status.balanceCap > 0 && status.userBalance >= status.balanceCap;
  const hasTokens = status.userBalance > 0;
  const isSoldOut = status.supplyCap > 0 && status.totalSupply >= status.supplyCap;

  // ─── Mint button (always in DOM, disabled states controlled) ───
  const mintDisabled = !connectedWallet || isAtMaxBalance || status.mintingDisabled || isSoldOut || !status.isMintable || mintPending;
  const mintLabel = !connectedWallet
    ? 'Mint NFT'
    : mintPending
      ? 'Minting...'
      : isAtMaxBalance
        ? 'Max Reached'
        : status.mintingDisabled
          ? 'Minting Closed'
          : isSoldOut
            ? 'Sold Out'
            : !status.isMintable
              ? 'Not Available'
              : 'Mint NFT';

  // ─── Burn button ───
  const burnDisabled = !connectedWallet || !hasTokens || burnPending;
  const burnLabel = !connectedWallet
    ? 'Burn'
    : burnPending
      ? 'Burning...'
      : !hasTokens
        ? 'Burn'
        : 'Burn 1';

  // ─── Status line text (always present) ───
  const statusLine = !connectedWallet
    ? 'Connect wallet to interact'
    : `Connected · You hold ${status.userBalance}${status.balanceCap > 0 ? ` / ${status.balanceCap}` : ''}`;

  return (
    <div className="card anim anim-d3">
      {/* ═══════════════════════════════════════════════════════
           Eligibility — mint + hold conditions, fixed 200px
           ═══════════════════════════════════════════════════════ */}
      <div className="card-section card-section--center card-block--xl">
        <span className="section-label"><EmojiText>🦄 Eligibility 🦄</EmojiText></span>

        <div className="conditions-area">
          {/* ─── Mint conditions ─── */}
          <span className="conditions-group-header">Mint</span>
          <div className="conditions-group">
            {hasMintGate ? (
              <GateRenderer token={token} status={status} onRefetch={onRefetch} userAddress={displayAddress} />
            ) : (
              <div className="data-row" style={{ border: 'none' }}>
                <span className="data-label" style={{ color: 'var(--c-text-secondary)' }}>
                  No mint restrictions
                </span>
              </div>
            )}
          </div>

          {/* ─── Divider ─── */}
          <div className="conditions-divider" />

          {/* ─── Hold conditions ─── */}
          <span className="conditions-group-header" style={{ marginTop: 'var(--space-xs)' }}>Hold</span>
          <div className="conditions-group">
            {hasHoldGate ? (
              <HoldGateInfo
                gateAddress={status.holdGate}
                chainId={token.chainId}
                userAddress={displayAddress || actionUser}
                isSoulbound={status.isSoulbound}
                isRevokable={status.revokable}
              />
            ) : (
              <div>
                <div className="data-row" style={{ border: 'none' }}>
                  <span className="data-label" style={{ color: 'var(--c-text-secondary)' }}>
                    No holding restrictions
                  </span>
                </div>
                {status.isSoulbound && (
                  <div className="data-row" style={{ border: 'none' }}>
                    <span className="data-label">Soulbound</span>
                    <span className="status-icon--yes">
                      <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
                        <circle cx="12" cy="12" r="10" /><path d="M8 12l3 3 5-5" />
                      </svg>
                    </span>
                    <span className="data-value">Not transferable</span>
                  </div>
                )}
                {status.revokable && (
                  <div className="data-row" style={{ border: 'none' }}>
                    <span className="data-label">Revokable</span>
                    <span className="status-icon--yes" style={{ color: 'var(--c-accent)' }}>
                      <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
                        <circle cx="12" cy="12" r="10" /><path d="M8 12l3 3 5-5" />
                      </svg>
                    </span>
                    <span className="data-value" style={{ color: 'var(--c-text-secondary)' }}>May lose tokens</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════
           Actions — mint + burn buttons, fixed 80px
           ═══════════════════════════════════════════════════════ */}
      <div className="card-section card-section--center card-block--action">
        <span className="section-label"><EmojiText>🐰 Actions 🐰</EmojiText></span>

        <div className="action-bar">
          <button
            onClick={mint}
            disabled={mintDisabled}
            className="btn btn-primary btn-sm"
          >
            {mintLabel}
          </button>

          <button
            onClick={() => burn(1)}
            disabled={burnDisabled}
            className="btn btn-secondary btn-sm"
          >
            {burnLabel}
          </button>
        </div>

        <p className="action-status">{statusLine}</p>
      </div>
    </div>
  );
}
