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
 */
export function UnknownGate({ conditions }: Props) {
  const { provider, accounts, isConnected } = useUpProvider();
  const walletUser = accounts[0] || null;

  if (conditions.length === 0) return null;

  // Find follow condition for follow button
  const followCond = conditions.find(c => c.gateType === 'follow');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2xs)' }}>
      {conditions.map((c, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', gap: 'var(--space-xs)',
          minHeight: 28,
        }}>
          {/* Status dot */}
          <span style={{
            width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
            background: c.passed ? 'var(--c-success)' : 'var(--c-text-tertiary)',
          }} />

          {/* Label */}
          <span className="text-micro" style={{
            color: c.passed ? 'var(--c-success)' : 'var(--c-text-tertiary)',
          }}>
            {c.label}
          </span>

          {/* Progress (e.g. "5.0/5.0 LYX") */}
          {c.progress && (
            <span className="text-micro" style={{
              color: c.passed ? 'var(--c-success)' : 'var(--c-text-tertiary)',
              marginLeft: 'auto',
            }}>
              {c.progress}
            </span>
          )}
        </div>
      ))}

      {/* Follow button */}
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
        className="btn btn-secondary btn-lg"
      >
        {isFollowing ? 'Following...' : 'Follow on LUKSO'}
      </button>
      {error && <div className="error-box" style={{ marginTop: 4 }}>{error}</div>}
    </div>
  );
}
