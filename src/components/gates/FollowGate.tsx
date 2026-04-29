'use client';

import { useUpProvider } from '@/lib/up-provider';
import { useFollow, TokenStatus } from '@/lib/useToken';
import { TokenConfig } from '@/config/tokens';

interface Props {
  token: TokenConfig;
  status: TokenStatus;
  onRefetch: () => void;
}

export function FollowGate({ token, status, onRefetch }: Props) {
  const { provider, accounts, isConnected } = useUpProvider();
  const user = accounts[0] || null;

  const { follow: doFollow, isFollowing: followLoading, error: fe } = useFollow(
    user, provider, token.targetProfile, onRefetch
  );

  return (
    <>
      <p className="text-caption" style={{ margin: 'var(--space-2xs) 0', lineHeight: 1.4 }}>
        Must follow {token.targetProfile?.slice(0, 10)}… on LUKSO
      </p>

      {isConnected && !status.isFetching && (
        <p className="text-micro" style={{
          margin: 'var(--space-2xs) 0',
          color: status.isFollowing ? 'var(--c-success)' : 'var(--c-text-tertiary)',
        }}>
          {status.isFollowing ? 'Following ✓' : 'Not following'}
        </p>
      )}

      {isConnected && !status.isFollowing && !status.isFetching && (
        <button
          onClick={doFollow}
          disabled={followLoading}
          className="btn btn-secondary btn-lg"
        >
          {followLoading ? 'Following...' : 'Follow on LUKSO'}
        </button>
      )}

      {fe && <div className="error-box">{fe}</div>}
    </>
  );
}
