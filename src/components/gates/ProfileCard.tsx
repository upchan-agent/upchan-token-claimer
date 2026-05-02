'use client';

import { useProfileMetadata } from '@/lib/useProfileMetadata';
import { useFollow } from '@/lib/useToken';
import { useUpProvider } from '@/lib/up-provider';
import { profileUrl } from '@/config/tokens';
import { EmojiText } from '../EmojiText';

interface Props {
  target: string | null | undefined;
  chainId: number;
  /** Called after follow completes */
  onFollowDone?: () => void;
}

function ipfs(url: string): string {
  return url?.replace('ipfs://', 'https://ipfs.io/ipfs/') || '';
}

/**
 * Profile card for follow gate conditions.
 * Horizontal layout: avatar (left) | name + address + follow button (right).
 * Reuses holder-* CSS classes for visual consistency.
 */
export function ProfileCard({ target, chainId, onFollowDone }: Props) {
  const { data: profile, isLoading } = useProfileMetadata(target, chainId);
  const { provider, accounts, isConnected } = useUpProvider();
  const walletUser = accounts[0] || null;
  const { follow, isFollowing, error } = useFollow(
    walletUser, provider, target as `0x${string}`, onFollowDone
  );

  if (!target) return null;

  return (
    <div className="eligibility-profile">
      {/* Avatar (left) */}
      <div className="holder-avatar">
        {isLoading ? (
          <div className="holder-avatar-fallback">⋯</div>
        ) : profile?.image ? (
          <img
            src={ipfs(profile.image)}
            alt=""
            className="holder-avatar-img"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        ) : (
          <div className="holder-avatar-fallback">👤</div>
        )}
      </div>

      {/* Name + address + follow button (right) */}
      <div className="holder-meta">
        <div className="holder-name text-caption-bold" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {isLoading ? 'Loading...' : (profile?.name || 'Unknown')}
        </div>
        <a
          href={profileUrl(target)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-micro link"
          style={{ lineHeight: 1.2 }}
        >
          {target.slice(0, 6)}…{target.slice(-4)} ↗
        </a>
        {isConnected && (
          <button
            onClick={follow}
            disabled={isFollowing}
            className="btn btn-primary btn-sm"
            style={{ marginTop: 4 }}
          >
            {isFollowing ? 'Following...' : <EmojiText>Follow</EmojiText>}
          </button>
        )}
      </div>

      {error && <div className="error-box">{error}</div>}
    </div>
  );
}
