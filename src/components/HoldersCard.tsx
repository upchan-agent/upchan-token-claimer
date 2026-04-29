'use client';

import { useHolders } from '@/lib/useHolders';
import { TokenConfig } from '@/config/tokens';

function ipfs(url: string) {
  return url?.replace('ipfs://', 'https://ipfs.io/ipfs/') || '';
}

export function HoldersCard({ token }: { token: TokenConfig }) {
  const { holders, isLoading } = useHolders(token);

  return (
    <div className="card anim anim-d4">
      <div style={{
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', marginBottom: 12,
      }}>
        <span className="section-label">Holders</span>
        <span className="text-micro-bold">{holders.length}</span>
      </div>

      {isLoading ? (
        <div className="empty-state">
          <p className="text-caption">Loading...</p>
        </div>
      ) : holders.length === 0 ? (
        <div className="empty-state">
          <p className="text-caption">No holders yet</p>
        </div>
      ) : (
        <div className="holders-scroll">
          {holders.map((h) => (
            <a
              key={h.address}
              href={`https://universalprofile.cloud/${h.address}`}
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
                  <div className="font-mono text-micro" style={{
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
        </div>
      )}
    </div>
  );
}
