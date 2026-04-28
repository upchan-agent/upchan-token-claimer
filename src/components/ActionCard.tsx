'use client';

import { useUpProvider } from '@/lib/up-provider';
import { useMint, useFollow, TokenStatus } from '@/lib/useToken';
import { TokenConfig, getGateInfo } from '@/config/tokens';
import { useState } from 'react';

interface Props {
  token: TokenConfig;
  status: TokenStatus;
  chain: { name: string; explorer: string };
  onRefetch: () => void;
}

export function ActionCard({ token, status, chain, onRefetch }: Props) {
  const { provider, accounts, isConnected } = useUpProvider();
  const user = accounts[0] || null;
  const [actionDone, setActionDone] = useState(false);

  const { mint, isMinting, txHash, error: me } = useMint(token, user, provider, () => { onRefetch(); setActionDone(true); });
  const { follow: doFollow, isFollowing: followLoading, error: fe } = useFollow(user, provider, token.targetProfile, () => { onRefetch(); setActionDone(true); });

  const gateInfo = getGateInfo(status.mintGate);
  const hasGate = status.mintGate !== '0x0000000000000000000000000000000000000000';
  const isFollowGate = gateInfo.type === 'lsp26-follow';
  const following = status.isFollowing;

  // Determine gate status message
  const gateStatus = !isConnected ? '—'
    : isFollowGate ? (following ? '✅ Following' : '❌ Not following')
    : hasGate ? `Active (${status.mintGate.slice(0, 10)}…)`
    : 'None';

  return (
    <div className="card anim anim-d3" style={{ flexShrink: 0, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>

      {/* 🚪 Gate Section */}
      {hasGate && (
        <div style={{ borderBottom: '1px solid #f0e8f8', paddingBottom: 10 }}>
          <h4 style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            🚪 Gate
          </h4>
          <div style={{ fontSize: 12, color: 'var(--c-text-secondary)', lineHeight: 1.5 }}>
            {isFollowGate ? `Must follow ${token.targetProfile?.slice(0, 10)}… on LUKSO` : `Gate: ${status.mintGate}`}
          </div>
          <div style={{ fontSize: 11, color: 'var(--c-text-muted)', marginTop: 4 }}>Status: {gateStatus}</div>

          {/* Follow button (only when not following) */}
          {isConnected && isFollowGate && !following && (
            <button onClick={doFollow} disabled={followLoading}
              className="btn btn-primary" style={{ width: '100%', padding: '12px 20px', fontSize: 14, marginTop: 8 }}>
              {followLoading ? 'Processing...' : '💫 Follow'}
            </button>
          )}
        </div>
      )}

      {/* 📦 Token Section */}
      <div>
        <h4 style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          📦 Token
        </h4>

        {!isConnected ? (
          <p style={{ fontSize: 12, color: 'var(--c-text-muted)' }}>Connect to check mint eligibility</p>
        ) : status.userBalance > 0 ? (
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--c-success)' }}>🎉 Claimed</p>
            <p style={{ fontSize: 12, color: 'var(--c-text-muted)', marginTop: 2 }}>You own {status.userBalance} token(s)</p>
          </div>
        ) : status.mintingDisabled ? (
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--c-text)' }}>🔒 Permanently Closed</p>
            <p style={{ fontSize: 12, color: 'var(--c-text-muted)', marginTop: 2 }}>Minting has been disabled</p>
          </div>
        ) : !status.isMintable ? (
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--c-text)' }}>🔒 Closed</p>
            <p style={{ fontSize: 12, color: 'var(--c-text-muted)', marginTop: 2 }}>Minting is not open</p>
          </div>
        ) : status.totalSupply >= token.supplyCap ? (
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--c-text)' }}>Sold Out</p>
            <p style={{ fontSize: 12, color: 'var(--c-text-muted)', marginTop: 2 }}>All tokens claimed</p>
          </div>
        ) : following || !isFollowGate ? (
          /* Can mint: following or no gate required */
          <button onClick={mint} disabled={isMinting}
            className="btn btn-primary pulse" style={{ width: '100%', padding: '15px 24px', fontSize: 16 }}>
            {isMinting ? 'Claiming...' : '🎉 Claim'}
          </button>
        ) : (
          <p style={{ fontSize: 12, color: 'var(--c-text-muted)' }}>Follow to unlock minting</p>
        )}
      </div>

      {/* TX */}
      {txHash && (
        <div style={{ padding: '6px 10px', background: '#faf5ff', borderRadius: 10, fontSize: 11, color: 'var(--c-text-muted)', fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: 6 }}>
          {txHash.slice(0, 10)}…{txHash.slice(-6)}
          <a href={`${chain.explorer}/tx/${txHash}`} target="_blank" style={{ color: 'var(--c-text-link)', textDecoration: 'none', fontWeight: 600 }}>↗</a>
        </div>
      )}

      {/* Error */}
      {(me || fe) && (
        <div style={{ padding: '6px 10px', background: 'rgba(239,68,68,0.06)', borderRadius: 10, fontSize: 11, color: 'var(--c-error)', width: '100%', textAlign: 'center' }}>
          {me || fe}
        </div>
      )}
    </div>
  );
}
