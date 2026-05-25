'use client';

import { ethers } from 'ethers';
import { useMint, useBurn, TokenStatus } from '@/hooks/useTokenStatus';
import { TokenConfig, LSP26_ADDRESS } from '@/config/tokens';
import { EmojiText } from './EmojiText';
import { GateConditions } from './gates/GateConditions';
import { useTxContext } from '@/providers/TxContext';

interface Props {
  token: TokenConfig;
  status: TokenStatus;
  onRefetch: () => void;
  displayAddress?: `0x${string}` | null;
}

export function ActionCard({ token, status, onRefetch, displayAddress }: Props) {
  const { sendTx } = useTxContext();

  const addr = displayAddress ?? null;
  const { mint, isPending: mintPending } = useMint(token, addr, onRefetch);
  const { burn, isPending: burnPending } = useBurn(token, addr, onRefetch);

  // ─── Derived state ───
  const hasMintGate = status.mintExtensionCount > 0;
  const hasHoldGate = status.holdExtensionCount > 0;
  const isAtMaxBalance = status.balanceCap > 0n && status.userBalance >= status.balanceCap;
  const hasTokens = status.userBalance > 0n;
  const userBal = Number(status.userBalance);
  const balCap = status.balanceCap > 0n ? Number(status.balanceCap) : null;
  const isSoldOut = status.supplyCap > 0n && status.totalSupply >= status.supplyCap;

  // ─── Mint button ───
  const mintDisabled = !displayAddress || mintPending || (status.isUserDataReady && !status.canMint) || status.isLoading;
  const mintLabel = !displayAddress
    ? 'Mint NFT'
    : mintPending
      ? 'Minting...'
      : status.isLoading
        ? 'Mint NFT'
        : status.mintingDisabled
          ? 'Minting Closed'
          : isAtMaxBalance
            ? 'Max Reached'
            : isSoldOut
              ? 'Sold Out'
              : !status.isMintable
                ? 'Paused'
                : 'Mint NFT';

  // ─── Burn button ───
  const burnDisabled = !displayAddress || !hasTokens || burnPending || status.isLoading;
  const burnLabel = !displayAddress
    ? 'Burn'
    : burnPending
      ? 'Burning...'
      : status.isLoading
        ? 'Burn'
        : 'Burn 1';

  // ─── Status line ───
  const statusLine = !displayAddress
    ? 'Connect to interact'
    : status.isLoading
      ? 'Connected · —'
      : `Connected · You hold ${userBal}${balCap ? ` / ${balCap}` : ''}`;

  return (
    <div className="card anim anim-d3">
      {/* ═══════════════════════════════════════════════════════
           Eligibility — mint + hold conditions in 2-col layout
           ═══════════════════════════════════════════════════════ */}
      <div className="card-section card-section--center card-block--xl">
        <span className="section-label"><EmojiText>🦄 Eligibility 🦄</EmojiText></span>

        <div className="conditions-area">
          <GateConditions
            gateAddress={status.mintGate}
            tokenProxy={token.proxy}
            mode="mint"
            chainId={token.chainId}
            userAddress={addr}
            label="Mint"
            onFollow={async (target: `0x${string}`) => {
              const iface = new ethers.Interface(['function follow(address addr) external']);
              await sendTx('Follow Profile', LSP26_ADDRESS, iface.encodeFunctionData('follow', [target]), token.chainId);
              onRefetch();
            }}
          />
          <GateConditions
            gateAddress={status.holdGate}
            tokenProxy={token.proxy}
            mode="hold"
            chainId={token.chainId}
            userAddress={addr}
            label="Hold"
            onFollow={async (target: `0x${string}`) => {
              const iface = new ethers.Interface(['function follow(address addr) external']);
              await sendTx('Follow Profile', LSP26_ADDRESS, iface.encodeFunctionData('follow', [target]), token.chainId);
              onRefetch();
            }}
          />
        </div>
        {hasHoldGate && status.revokable && (
          <p className="revoke-warning">
            {'\u26A0\uFE0F'} Revokable Token — Owner can revoke if hold conditions unmet
          </p>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════
           Actions — mint + burn buttons
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
