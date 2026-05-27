'use client';

import { useEffect, useState } from 'react';
import { TokenConfig, ipfsUrl } from '@/config/tokens';
import { useTokenOnChainData } from '@/hooks/useTokenMeta';

/**
 * Token background art component.
 * Renders the token's LSP4 image as a full-screen blurred backdrop.
 * Wrapped in its own component so React can cleanly remount on token switch
 * via key={displayToken.proxy}, preventing stale image bleed-through.
 */
export function TokenBackground({ token }: { token: TokenConfig }) {
  const meta = useTokenOnChainData(token);
  const img = ipfsUrl(meta.image);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(false);
    if (!img) return;

    let active = true;
    const image = new Image();
    image.onload = () => {
      if (active) setLoaded(true);
    };
    image.onerror = () => {
      if (active) setLoaded(false);
    };
    image.src = img;

    return () => {
      active = false;
    };
  }, [img]);

  if (!img) return null;

  return (
    <div
      className={`token-hero-bg${loaded ? ' token-hero-bg--loaded' : ''}`}
      style={{ backgroundImage: `url("${img}")` }}
    />
  );
}
