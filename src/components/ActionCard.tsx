'use client';

import { useUpProvider } from '@/lib/up-provider';
import { useMint, TokenStatus } from '@/lib/useToken';
import { TokenConfig } from '@/config/tokens';
import { StatusMessage } from './StatusMessage';
import { GateRenderer } from './gates/GateRenderer';

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
      {/* Gate section — delegated to GateRenderer per gate type */}
      <div className="card-section card-block--lg">
        <span className="section-label">Eligibility</span>

        {status.isLoading ? (
          <p className="text-caption" style={{ margin: 'var(--space-2xs) 0' }}>
            Checking eligibility…
          </p>
        ) : (
          <GateRenderer token={token} status={status} onRefetch={onRefetch} />
        )}
      </div>

      {/* Mint section */}
      <div className="card-block--md">
        <span className="section-label">Claim</span>
        {renderMintState()}
      </div>

      {/* TX hash */}
      {txHash && (
        <div className="tx-hash">
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
