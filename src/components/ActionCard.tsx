'use client';

import { useUpProvider } from '@/lib/up-provider';
import { useMint, TokenStatus } from '@/lib/useToken';
import { TokenConfig } from '@/config/tokens';
import { EmojiText } from './EmojiText';
import { StatusMessage } from './StatusMessage';
import { GateRenderer } from './gates/GateRenderer';

interface Props {
  token: TokenConfig;
  status: TokenStatus;
  chain: { name: string; explorer: string };
  onRefetch: () => void;
  userAddress?: `0x${string}` | null;
  isViewMode?: boolean;
}

export function ActionCard({ token, status, chain, onRefetch, userAddress, isViewMode }: Props) {
  const { provider, accounts, isConnected } = useUpProvider();
  const walletUser = accounts[0] || null;
  const user = walletUser; // mint/execute always uses connected wallet only

  const { mint, isMinting, txHash, error: me } = useMint(token, user, provider, onRefetch);

  // ─── Mint state ───
  const isAtMaxBalance = status.balanceCap > 0 && status.userBalance >= status.balanceCap;
  const dataReady = !status.isLoading;

  const renderMintState = () => {
    if (!isConnected && !isViewMode) {
      return (
        <p className="text-caption empty-state">
          <EmojiText>Connect 🆙</EmojiText>
        </p>
      );
    }

    if (isViewMode) {
      if (status.userBalance > 0) {
        return (
          <StatusMessage
            variant="claimed"
            title="Claimed ✓"
            caption={`${status.userBalance} token${status.userBalance > 1 ? 's' : ''}`}
          />
        );
      }
      return (
        <StatusMessage
          variant="unavailable"
          title="View Mode"
          caption={`${userAddress?.slice(0, 6)}…${userAddress?.slice(-4)} — not claimed`}
        />
      );
    }

    if (isAtMaxBalance) {
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

    if (status.totalSupply >= status.supplyCap) {
      return (
        <StatusMessage
          variant="soldout"
          title="Sold Out"
          caption="All tokens claimed"
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

  const fadeClass = dataReady ? 'content-fade--visible' : '';

  return (
    <div className="card anim anim-d3">
      {/* Gate section — delegated to GateRenderer per gate type */}
      <div className="card-section card-section--center card-block--lg">
        <span className="section-label"><EmojiText>🦄 Eligibility 🦄</EmojiText></span>

        <div className={`content-fade ${fadeClass}`}>
          {dataReady ? (
            <GateRenderer token={token} status={status} onRefetch={onRefetch} userAddress={userAddress} />
          ) : (
            <div className="skeleton" style={{ height: 60, marginTop: 'var(--space-xs)' }} />
          )}
        </div>
      </div>

      {/* Mint section */}
      <div className="card-section card-block--md">
        <span className="section-label"><EmojiText>🐰 Claim 🐰</EmojiText></span>
        {!isConnected && !isViewMode ? (
          <div className="content-fade content-fade--visible">
            {renderMintState()}
          </div>
        ) : (
          <div className={`content-fade ${fadeClass}`}>
            {dataReady ? renderMintState() : (
              <div className="skeleton" style={{ height: 48 }} />
            )}
          </div>
        )}
      </div>

      {/* TX hash */}
      {txHash && (
        <div style={{
          marginTop: 'var(--space-xs)',
          padding: 'var(--space-xs) 10px',
          background: 'rgba(0, 0, 0, 0.03)',
          borderRadius: 'var(--radius-md)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-xs)',
        }}>
          <span className="text-micro">
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
      {me && (
        <div className="error-box">{me}</div>
      )}
    </div>
  );
}
