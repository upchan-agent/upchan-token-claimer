'use client';

import { useState } from 'react';
import { TokenConfig } from '@/config/tokens';
import { useTokenOnChainData } from '@/lib/useTokenData';
import { EmojiText } from './EmojiText';
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
      <div className="card anim anim-d1">
        <div className="card-token">
          <div
            className="card-token-media"
            onClick={() => hasImg && setPopup(true)}
          >
            {hasImg ? (
              <img
                src={imgUrl}
                alt={name}
                className="card-media-img"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            ) : (
              <div className="card-media-skeleton" />
            )}
          </div>

          <div>
            <h1 className="text-card-title" style={{ margin: 0 }}>
              <EmojiText>{name}</EmojiText>
            </h1>
            <p className="text-caption" style={{ margin: 'var(--space-2xs) 0 0', visibility: sym ? 'visible' : 'hidden' }}>
              {sym ? `$${sym}` : '—'}
            </p>
          </div>
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
