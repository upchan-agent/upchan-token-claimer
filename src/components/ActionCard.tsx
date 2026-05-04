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
          <div className="conditions-group">
            <span className="conditions-group-header">Mint</span>
            {hasMintGate ? (
              <GateRenderer token={token} status={status} onRefetch={onRefetch} userAddress={displayAddress} />
            ) : (
              <p className="conditions-placeholder">No mint restrictions</p>
            )}
          </div>

          {/* ─── Divider ─── */}
          <div className="conditions-divider" />

          {/* ─── Hold conditions ─── */}
          <div className="conditions-group">
            <span className="conditions-group-header">Hold</span>
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
                <p className="conditions-placeholder">No holding restrictions</p>
                {status.isSoulbound && (
                  <div className="condition-row">
                    <span className="condition-dot condition-dot--pass" />
                    <span className="condition-label condition-label--pass">Soulbound · Not transferable</span>
                  </div>
                )}
                {status.revokable && (
                  <div className="condition-row">
                    <span className="condition-dot" style={{ background: 'var(--c-accent)' }} />
                    <span className="condition-label" style={{ color: 'var(--c-text-secondary)' }}>Revokable · May lose tokens</span>
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
