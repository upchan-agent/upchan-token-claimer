'use client';

import { useState } from 'react';
import { TokenConfig } from '@/config/tokens';
import { useTokenOnChainData } from '@/lib/useTokenData';
import { Popup } from './Popup';

function ipfs(url: string): string {
  return url?.replace('ipfs://', 'https://ipfs.io/ipfs/') || '';
}

export function TokenCard({ token }: { token: TokenConfig }) {
  const onChain = useTokenOnChainData(token);
  const [popup, setPopup] = useState(false);

  const imgUrl = ipfs(onChain.image);
  const name = onChain.name || '—';
  const sym = onChain.symbol || '';
  const hasImg = Boolean(imgUrl);

  return (
    <>
      <div className="card anim anim-d1 token-card-body">
        {/* Token image — 88px, radius 12px */}
        <div
          className={`token-img-wrap${hasImg ? ' loaded' : ''}`}
          onClick={() => hasImg && setPopup(true)}
        >
          {(!hasImg || onChain.isLoading) && (
            <div className="token-img-loading">🆙</div>
          )}
          {hasImg && (
            <img
              src={imgUrl}
              alt={name}
              className="token-img-loaded"
              style={{ opacity: onChain.isLoading ? 0 : 1 }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          )}
        </div>

        {/* Card Title */}
        <div className="text-center">
          <h1 className="text-card-title" style={{ margin: 0 }}>
            {name}
          </h1>
          <p className="text-caption token-symbol" style={{ visibility: sym ? 'visible' : 'hidden' }}>
            {sym ? `$${sym}` : '—'}
          </p>
        </div>
      </div>

      <Popup isOpen={popup} onClose={() => setPopup(false)}>
        <img src={imgUrl} alt={name} style={{
          maxWidth: '85vw', maxHeight: '85vh',
          display: 'block', borderRadius: 'var(--radius-xl)',
        }} />
      </Popup>
    </>
  );
}
