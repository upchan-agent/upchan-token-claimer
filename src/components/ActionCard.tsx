'use client';

import { useUpProvider } from '@/lib/up-provider';
import { useMint, useFollow, TokenStatus } from '@/lib/useToken';
import { TokenConfig, getGateInfo } from '@/config/tokens';
import { StatusMessage } from './StatusMessage';

interface Props {
  token: TokenConfig;
  status: TokenStatus;
  chain: { name: string; explorer: string };
  onRefetch: () => void;
}

export function ActionCard({ token, status, chain, onRefetch }: Props) {
  const { provider, accounts, isConnected } = useUpProvider();
  const user = accounts[0] || null;

  const { mint, isMinting, txHash, error: me } = useMint(token, user, provider, onRefetch);
  const { follow: doFollow, isFollowing: followLoading, error: fe } = useFollow(
    user, provider, token.targetProfile, onRefetch
  );

  const gateInfo = getGateInfo(status.mintGate);
  const hasGate = status.mintGate !== '0x0000000000000000000000000000000000000000';
  const isFollowGate = gateInfo.type === 'lsp26-follow';
  const following = status.isFollowing;
  const showError = me || fe;

  /* ─── Mint state ─── */
  const renderMintState = () => {
    if (!isConnected) {
      return (
        <p className="text-caption empty-state">
          Connect wallet to check eligibility
        </p>
      );
    }

    if (status.userBalance > 0) {
      return (
        <StatusMessage
          variant="claimed"
          title="Claimed ✓"
          caption={`You own ${status.userBalance} token${status.userBalance > 1 ? 's' : ''}`}
        />
      );
    }

    if (status.mintingDisabled) {
      return (
        <StatusMessage
          variant="closed"
          title="Minting Closed"
          caption="Permanently disabled"
        />
      );
    }

    if (!status.isMintable) {
      return (
        <StatusMessage
          variant="unavailable"
          title="Not Available"
          caption="Minting is not open yet"
        />
      );
    }

    if (status.totalSupply >= token.supplyCap) {
      return (
        <StatusMessage
          variant="soldout"
          title="Sold Out"
          caption="All tokens claimed"
        />
      );
    }

    if (isFollowGate && !following) {
      return (
        <StatusMessage
          variant="not-following"
          title=""
          caption="Follow to unlock minting"
        />
      );
    }

    return (
      <button
        onClick={mint}
        disabled={isMinting}
        className="btn btn-primary btn-lg"
      >
        {isMinting ? 'Claiming...' : 'Mint NFT'}
      </button>
    );
  };

  return (
    <div className="card anim anim-d3">
      {/* Gate section — always rendered, shows loading/status */}
      <div className="card-section">
        <span className="section-label">Eligibility</span>

        {status.isLoading && !hasGate ? (
          <p className="text-caption" style={{ margin: 'var(--space-2xs) 0' }}>
            Checking eligibility…
          </p>
        ) : !hasGate ? (
          <p className="text-caption" style={{ margin: 'var(--space-2xs) 0' }}>
            No conditions — anyone can mint
          </p>
        ) : (
          <>
            <p className="text-caption" style={{ margin: 'var(--space-2xs) 0', lineHeight: 1.4 }}>
              {isFollowGate
                ? `Must follow ${token.targetProfile?.slice(0, 10)}… on LUKSO`
                : `Gate: ${status.mintGate.slice(0, 10)}…`
              }
            </p>

            {isConnected && (
              <p className="text-micro" style={{
                margin: 'var(--space-2xs) 0',
                color: following ? 'var(--c-success)' : 'var(--c-text-tertiary)',
              }}>
                {following ? 'Following ✓' : 'Not following'}
              </p>
            )}

            {isConnected && isFollowGate && !following && (
              <button
                onClick={doFollow}
                disabled={followLoading}
                className="btn btn-secondary btn-lg"
              >
                {followLoading ? 'Following...' : 'Follow on LUKSO'}
              </button>
            )}
          </>
        )}
      </div>

      {/* Mint section */}
      <div>
        <span className="section-label">Claim</span>
        {renderMintState()}
      </div>

      {/* TX hash */}
      {txHash && (
        <div className="tx-hash">
          <span className="text-micro font-mono">
            {txHash.slice(0, 10)}…{txHash.slice(-6)}
          </span>
          <a
            href={`${chain.explorer}/tx/${txHash}`}
            target="_blank"
            className="link text-micro"
          >
            ↗
          </a>
        </div>
      )}

      {/* Error */}
      {showError && (
        <div className="error-box">{showError}</div>
      )}
    </div>
  );
}
