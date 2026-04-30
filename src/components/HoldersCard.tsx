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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span className="section-label">
            <EmojiText>🐱 Holders 🐱</EmojiText>
          </span>
          <span className="section-label">
            {holders.length}
          </span>
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
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  overflow: 'hidden', flexShrink: 0,
                  background: 'rgba(0,0,0,0.05)',
                }}>
                  {h.profileImage ? (
                    <img src={ipfs(h.profileImage)} alt=""
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  ) : (
                    <div style={{
                      width: '100%', height: '100%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 14,
                    }}>👤</div>
                  )}
                </div>

                {/* Name + address */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="text-caption-bold" style={{
                    overflow: 'hidden', textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {h.profileName || `${h.address.slice(0, 8)}…${h.address.slice(-6)}`}
                  </div>
                  {h.profileName && (
                    <div className="text-micro" style={{
                      marginTop: 1, color: 'var(--c-text-tertiary)',
                    }}>
                      {h.address.slice(0, 8)}…{h.address.slice(-6)}
                    </div>
                  )}
                </div>

                {/* Date */}
                {h.mintedAt && (
                  <span className="text-micro" style={{ flexShrink: 0, color: 'var(--c-text-tertiary)' }}>
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
