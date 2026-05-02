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
  displayAddress?: `0x${string}` | null;
  walletAddress?: `0x${string}` | null;
}

export function ActionCard({ token, status, chain, onRefetch, displayAddress, walletAddress }: Props) {
  const { provider, accounts, isConnected } = useUpProvider();
  const connectedWallet = accounts[0] || null;

  // Actions always use the connected wallet
  const actionUser = connectedWallet;
  const { mint, isMinting, txHash, error: me } = useMint(token, actionUser, provider, onRefetch);

  // ─── Display context ───
  const isViewingOther = !!displayAddress && !!connectedWallet && displayAddress !== connectedWallet;
  const isAtMaxBalance = status.balanceCap > 0 && status.userBalance >= status.balanceCap;

  const renderMintState = () => {
    // Wallet connected but user data (balance, gate) still loading
    if (connectedWallet && !status.isUserDataReady && !status.error) {
      return (
        <p className="text-caption empty-state">
          Checking account...
        </p>
      );
    }

    // Not connected — show connect prompt
    if (!connectedWallet) {
      if (displayAddress) {
        // Searching without wallet: show claimed status + connect prompt
        if (status.userBalance > 0) {
          return (
            <StatusMessage
              variant="claimed"
              title="Claimed ✓"
              caption={`${displayAddress.slice(0, 6)}…${displayAddress.slice(-4)} owns ${status.userBalance}`}
            />
          );
        }
      }
      return (
        <p className="text-caption empty-state">
          <EmojiText>Connect 🆙</EmojiText>
        </p>
      );
    }

    // Connected but viewing someone else's profile
    if (isViewingOther) {
      // Show their claim status
      const otherContent = status.userBalance > 0
        ? (
          <StatusMessage
            variant="claimed"
            title="Claimed ✓"
            caption={`${displayAddress!.slice(0, 6)}…${displayAddress!.slice(-4)} owns ${status.userBalance}`}
          />
        )
        : (
          <StatusMessage
            variant="unavailable"
            title="Not Claimed"
            caption={`${displayAddress!.slice(0, 6)}…${displayAddress!.slice(-4)} hasn't claimed`}
          />
        );

      // If the connected wallet can also mint, show a mini action
      if (status.canMint && !isAtMaxBalance) {
        return (
          <>
            {otherContent}
            <div style={{ marginTop: 8 }}>
              <button
                onClick={mint}
                disabled={isMinting}
                className="btn btn-primary btn-sm"
              >
                {isMinting ? 'Claiming...' : 'Mint for Yourself'}
              </button>
            </div>
          </>
        );
      }

      return otherContent;
    }

    // Connected, viewing connected wallet — full mint UI
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
        className="btn btn-primary btn-sm"
      >
        {isMinting ? 'Claiming...' : 'Mint NFT'}
      </button>
    );
  };

  return (
    <div className="card anim anim-d3">
      {/* Eligibility — always visible */}
      <div className="card-section card-section--center card-block--lg">
        <span className="section-label"><EmojiText>🦄 Eligibility 🦄</EmojiText></span>
        {/* Wrapper div guarantees a stable 2nd child for :last-child CSS */}
        <div>
          <GateRenderer token={token} status={status} onRefetch={onRefetch} userAddress={displayAddress} />
        </div>
      </div>

      {/* Claim — shows loading state while user data is being fetched */}
      <div className="card-section card-section--center card-block--md">
        <span className="section-label"><EmojiText>🐰 Claim 🐰</EmojiText></span>
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
