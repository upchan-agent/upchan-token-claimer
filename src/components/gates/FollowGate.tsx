'use client';

import { useUpProvider } from '@/lib/up-provider';
import { useFollow } from '@/lib/useToken';

interface Props {
  gatePassed: boolean;
  gateLabel: string;
  gateTarget: string | null;
  onRefetch: () => void;
}

export function FollowGate({ gatePassed, gateLabel, gateTarget, onRefetch }: Props) {
  const { provider, accounts, isConnected } = useUpProvider();
  const walletUser = accounts[0] || null;

  const { follow: doFollow, isFollowing: followLoading, error: fe } = useFollow(
    walletUser, provider, gateTarget as `0x${string}`, onRefetch
  );

  return (
    <>
      <p className="text-caption" style={{ margin: 'var(--space-2xs) 0', lineHeight: 1.4 }}>
        {gateLabel}
      </p>

      <p className="text-micro" style={{
        margin: 'var(--space-2xs) 0',
        color: gatePassed ? 'var(--c-success)' : 'var(--c-text-tertiary)',
      }}>
        {gatePassed ? 'Following ✓' : 'Not following'}
      </p>

      {isConnected && !gatePassed && (
        <button
          onClick={doFollow}
          disabled={followLoading || !gateTarget}
          className="btn btn-secondary btn-lg"
        >
          {followLoading ? 'Following...' : 'Follow on LUKSO'}
        </button>
      )}

      {fe && <div className="error-box">{fe}</div>}
    </>
  );
}
