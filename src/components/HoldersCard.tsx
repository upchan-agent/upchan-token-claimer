'use client';

import { useHolders } from '@/lib/useHolders';
import { TokenConfig } from '@/config/tokens';

function ipfs(url: string) { return url?.replace('ipfs://', 'https://ipfs.io/ipfs/') || ''; }

export function HoldersCard({ token }: { token: TokenConfig }) {
  const { holders, isLoading } = useHolders(token);

  return (
    <div className="card anim anim-d4" style={{ flexShrink: 0, padding: 14 }}>
      <h3 style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>
        Holders ({holders.length})
      </h3>

      {isLoading ? (
        <div style={{ fontSize: 12, color: 'var(--c-text-muted)', textAlign: 'center', padding: '12px 0' }}>Loading...</div>
      ) : holders.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--c-text-muted)', textAlign: 'center', padding: '12px 0' }}>No holders yet</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {holders.map((h, i) => (
            <a key={h.address} href={`https://universalprofile.cloud/${h.address}`} target="_blank" rel="noopener noreferrer"
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 10,
                textDecoration: 'none', background: i % 2 === 0 ? 'rgba(0,0,0,0.02)' : 'transparent',
              }}>
              {/* Avatar */}
              <div style={{ width: 28, height: 28, borderRadius: '50%', overflow: 'hidden', background: '#f0e6ff', flexShrink: 0 }}>
                {h.profileImage ? (
                  <img src={ipfs(h.profileImage)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>👤</div>
                )}
              </div>

              {/* Name + address */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {h.profileName || `${h.address.slice(0, 8)}...${h.address.slice(-6)}`}
                </div>
                {h.profileName && (
                  <div style={{ fontSize: 10, color: 'var(--c-text-muted)', fontFamily: 'monospace' }}>
                    {h.address.slice(0, 8)}...{h.address.slice(-6)}
                  </div>
                )}
              </div>

              <span style={{ fontSize: 10, color: 'var(--c-text-muted)', flexShrink: 0, fontFamily: 'monospace' }}>
                {h.mintedAt ? new Date(h.mintedAt).toLocaleDateString('ja-JP') : ''}
              </span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
