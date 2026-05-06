'use client';

import { ethers } from 'ethers';
import { useUpProvider } from '@/lib/up-provider';
import { useMint, useBurn, TokenStatus } from '@/lib/useToken';
import { TokenConfig, LSP26_ADDRESS } from '@/config/tokens';
import { EmojiText } from './EmojiText';
import { DashIcon } from './Icons';
import { GateRenderer } from './gates/GateRenderer';
import { HoldGateInfo } from './HoldGateInfo';
import { useTxContext } from '@/lib/tx-context';

interface Props {
  token: TokenConfig;
  status: TokenStatus;
  chain: { name: string; explorer: string };
  onRefetch: () => void;
  displayAddress?: `0x${string}` | null;
  walletAddress?: `0x${string}` | null;
}

export function ActionCard({ token, status, chain, onRefetch, displayAddress, walletAddress }: Props) {
  const { accounts } = useUpProvider();
  const connectedWallet = accounts[0] || null;
  const actionUser = connectedWallet;
  const { sendTx } = useTxContext();

  const { mint, isPending: mintPending } = useMint(token, actionUser, onRefetch);
  const { burn, isPending: burnPending } = useBurn(token, actionUser, onRefetch);

  // ─── Derived state ───
  const hasMintGate = status.mintGate !== '0x0000000000000000000000000000000000000000';
  const hasHoldGate = status.holdGate !== '0x0000000000000000000000000000000000000000';
  const isAtMaxBalance = status.balanceCap > 0n && status.userBalance >= status.balanceCap;
  const hasTokens = status.userBalance > 0n;
  const userBal = Number(status.userBalance);
  const balCap = status.balanceCap > 0n ? Number(status.balanceCap) : null;
  const isSoldOut = status.supplyCap > 0n && status.totalSupply >= status.supplyCap;

  // ─── Mint button (always in DOM, disabled states controlled) ───
  const mintDisabled = !connectedWallet || mintPending || !status.canMint;
  const mintLabel = !connectedWallet
    ? 'Mint NFT'
    : mintPending
      ? 'Minting...'
      : status.mintingDisabled
        ? 'Minting Closed'
        : isAtMaxBalance
          ? 'Max Reached'
          : isSoldOut
            ? 'Sold Out'
            : !status.isMintable
              ? 'Paused'
              : status.canMint
                ? 'Mint NFT'
                : 'Locked';

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
    ? 'Connect to interact'
    : `Connected · You hold ${userBal}${balCap ? ` / ${balCap}` : ''}`;

  return (
    <div className="card anim anim-d3">
      {/* ═══════════════════════════════════════════════════════
           Eligibility — mint + hold conditions, fixed 200px
           ═══════════════════════════════════════════════════════ */}
      <div className="card-section card-section--center card-block--xl">
        <span className="section-label"><EmojiText>🦄 Eligibility 🦄</EmojiText></span>

        <div className="conditions-area">
          <div className="conditions-block">
          <span className="conditions-group-header">Mint</span>
          <div className="conditions-group">
            {hasMintGate ? (
              <GateRenderer token={token} status={status} onRefetch={onRefetch} userAddress={displayAddress} onFollow={async (target: `0x${string}`) => {
                  const lsp26Iface = new ethers.Interface(['function follow(address addr) external']);
                  const data = lsp26Iface.encodeFunctionData('follow', [target]);
                  await sendTx('Follow Profile', LSP26_ADDRESS, data, token.chainId);
                  onRefetch();
                }} />
            ) : (
              <div className="data-row" style={{ border: 'none' }}>
                <span className="data-label" style={{ color: 'var(--c-text-secondary)' }}>
                  No mint restrictions
                </span>
                <span className="status-icon--none"><DashIcon size={14} /></span>
                <span className="data-value" style={{ color: 'var(--c-text-tertiary)' }}>-</span>
              </div>
            )}
          </div>
          </div>
          <div className="conditions-block">
          <span className="conditions-group-header">Hold</span>
          <div className="conditions-group">
            {hasHoldGate ? (
              <HoldGateInfo
                gateAddress={status.holdGate}
                chainId={token.chainId}
                userAddress={displayAddress || actionUser}
                onFollow={async (target: `0x${string}`) => {
                  const lsp26Iface = new ethers.Interface(['function follow(address addr) external']);
                  const data = lsp26Iface.encodeFunctionData('follow', [target]);
                  await sendTx('Follow Profile', LSP26_ADDRESS, data, token.chainId);
                  onRefetch();
                }}
              />
            ) : (
              <>
                <div className="data-row" style={{ border: 'none' }}>
                  <span className="data-label" style={{ color: 'var(--c-text-secondary)' }}>No holding restrictions</span>
                  <span className="status-icon--none"><DashIcon size={14} /></span>
                  <span className="data-value" style={{ color: 'var(--c-text-tertiary)' }}>-</span>
                </div>
              </>
            )}
          </div>
          </div>
        </div>
        {hasHoldGate && status.revokable && (
          <p style={{
            margin: '4px 0 0', padding: '3px 8px',
            background: 'color-mix(in srgb, var(--c-error, #ef4444) 8%, transparent)',
            borderRadius: 'var(--radius-sm, 5px)',
            fontSize: 10, lineHeight: 1.3,
            color: 'var(--c-error, #ef4444)',
            flexShrink: 0,
          }}>
            {'\u26A0\uFE0F'} Revokable Token — Owner may revoke if hold conditions unmet
          </p>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════
           Actions — mint + burn buttons, fixed 80px
           ═══════════════════════════════════════════════════════ */}
      <div className="card-section card-section--center card-block--action">
        <span className="section-label"><EmojiText>🐰 Claim&Action 🐰</EmojiText></span>

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
