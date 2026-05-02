'use client';

import { useHolders } from '@/lib/useHolders';
import { TokenConfig, profileUrl } from '@/config/tokens';
import { EmojiText } from './EmojiText';

function ipfs(url: string) {
  return url?.replace('ipfs://', 'https://ipfs.io/ipfs/') || '';
}

export function HoldersCard({ token }: { token: TokenConfig }) {
  const { holders, isLoading, error } = useHolders(token);

  return (
    <div className="card anim anim-d4">
      <div className="card-section">
        <div className="data-row">
          <span className="data-label"><EmojiText>🐱 Holders 🐱</EmojiText></span>
          <span />
          <span className="data-value">{holders.length}</span>
        </div>

        <div className="holder-list">
        {error ? (
          <div className="error-box">{error}</div>
        ) : !isLoading && holders.length === 0 ? (
          <div className="empty-state">
            <p className="text-caption">No holders yet</p>
          </div>
        ) : (
          <>
            {holders.map((h) => (
              <a
                key={h.address}
                href={profileUrl(h.address)}
                target="_blank" rel="noopener noreferrer"
                className="hoverable-row"
              >
                {/* Avatar */}
                <div className="holder-avatar">
                  {h.profileImage ? (
                    <img src={ipfs(h.profileImage)} alt=""
                      className="holder-avatar-img"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  ) : (
                    <div className="holder-avatar-fallback">👤</div>
                  )}
                </div>

                {/* Name + address */}
                <div className="holder-meta">
                  <div className="text-caption-bold holder-name">
                    {h.profileName || `${h.address.slice(0, 8)}…${h.address.slice(-6)}`}
                  </div>
                  {h.profileName && (
                    <div className="text-micro" style={{ marginTop: 1, color: 'var(--c-text-tertiary)' }}>
                      {h.address.slice(0, 8)}…{h.address.slice(-6)}
                    </div>
                  )}
                </div>

                {/* Date */}
                {h.mintedAt && (
                  <span className="text-micro holder-date">
                    {new Date(h.mintedAt).toLocaleDateString('ja-JP')}
                  </span>
                )}
              </a>
            ))}
          </>
        )}
      </div>
      </div>
    </div>
  );
}
