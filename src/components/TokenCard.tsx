'use client';

import { useState } from 'react';
import { TokenConfig } from '@/config/tokens';
import { useTokenOnChainData } from '@/lib/useTokenData';
import { Popup } from './Popup';

function ipfs(url: string): string { return url?.replace('ipfs://', 'https://ipfs.io/ipfs/') || ''; }

export function TokenCard({ token }: { token: TokenConfig }) {
  const onChain = useTokenOnChainData(token);
  const [popup, setPopup] = useState(false);

  const imgUrl = ipfs(onChain.image);
  const name = onChain.name || '—';
  const sym = onChain.symbol || '';
  const desc = onChain.description || 'No description';

  return (
    <>
      <div className="card anim anim-d1" style={{ flexShrink: 0, display: 'flex', gap: 'clamp(10px, 4vw, 14px)', padding: 14, minHeight: 130 }}>
        <div onClick={() => imgUrl && setPopup(true)}
          style={{ width: 'clamp(90px, 30vw, 130px)', height: 'clamp(90px, 30vw, 130px)', flexShrink: 0, borderRadius: 14, overflow: 'hidden', cursor: imgUrl ? 'pointer' : 'default', position: 'relative', background: '#f0e6ff', boxShadow: '0 1px 6px rgba(0,0,0,0.05)' }}>
          {onChain.isLoading && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0e6ff', fontSize: 28 }}>🆙</div>}
          <img src={imgUrl} alt={name} style={{ width: '100%', height: '100%', objectFit: 'contain', opacity: onChain.isLoading ? 0 : 1, transition: 'opacity 0.3s' }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexShrink: 0 }}>
            <h2 style={{ fontSize: 'clamp(14px, 4.5vw, 16px)', fontWeight: 700, color: 'var(--c-text)', margin: 0, lineHeight: 1.3, fontFamily: 'inherit' }}>{name}</h2>
            {sym && <span style={{ fontSize: 11, color: 'var(--c-text-muted)', fontWeight: 500, fontFamily: 'monospace' }}>${sym}</span>}
          </div>
          <div className="scrollable" style={{ flex: 1, marginTop: 6 }}>
            <p style={{ fontSize: 12, color: 'var(--c-text-secondary)', lineHeight: 1.5, whiteSpace: 'pre-wrap', margin: 0 }}>
              {onChain.isLoading ? 'Loading...' : onChain.error ? onChain.error : desc}
            </p>
          </div>
        </div>
      </div>
      <Popup isOpen={popup} onClose={() => setPopup(false)}>
        <img src={imgUrl} alt={name} style={{ maxWidth: '90vw', maxHeight: '90vh', display: 'block', background: '#f0e6ff' }} />
      </Popup>
    </>
  );
}
