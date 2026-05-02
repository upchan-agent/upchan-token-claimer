'use client';

import { useUpProvider } from '@/lib/up-provider';
import { useFollow } from '@/lib/useToken';

export interface Condition {
  passed: boolean;
  label: string;
  progress?: string;
  gateType?: string;
  target?: string | null;
}

interface Props {
  conditions: Condition[];
}

/**
 * Unified condition list component.
 * Renders all gate types in the same format.
 * Follow button uses btn-primary (Apple Blue) for visual consistency.
 */
export function UnknownGate({ conditions }: Props) {
  const { isConnected } = useUpProvider();

  if (conditions.length === 0) return null;

  // Find follow condition for follow button
  const followCond = conditions.find(c => c.gateType === 'follow');

  return (
    <div className="condition-list">
      {conditions.map((c, i) => (
        <div key={i} className="condition-row">
          <span className={`condition-dot condition-dot--${c.passed ? 'pass' : 'fail'}`} />
          <span className={`condition-label condition-label--${c.passed ? 'pass' : 'fail'}`}>
            {c.label}
          </span>
          {c.progress && (
            <span className={`condition-progress condition-progress--${c.passed ? 'pass' : 'fail'}`}>
              {c.progress}
            </span>
          )}
        </div>
      ))}

      {/* Follow button — Apple Blue primary style */}
      {followCond && !followCond.passed && isConnected && (
        <FollowButton target={followCond.target} />
      )}
    </div>
  );
}

function FollowButton({ target }: { target: string | null | undefined }) {
  const { provider, accounts } = useUpProvider();
  const walletUser = accounts[0] || null;
  const { follow, isFollowing, error } = useFollow(
    walletUser, provider, target as `0x${string}`, () => {}
  );

  return (
    <div>
      <button
        onClick={follow}
        disabled={isFollowing || !target}
        className="btn btn-primary btn-sm"
      >
        {isFollowing ? 'Following...' : 'Follow on LUKSO'}
      </button>
      {error && <div className="error-box" style={{ marginTop: 4 }}>{error}</div>}
    </div>
  );
}
