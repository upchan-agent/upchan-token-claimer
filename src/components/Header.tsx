'use client';

import { useState } from 'react';
import { useUpProvider } from '@/providers/UpProvider';
import { EmojiText } from './EmojiText';
import { SearchPopup } from './search/SearchPopup';
import { TxIndicator } from './TxIndicator';

export function Header({ onViewAddress, viewAddress }: {
  onViewAddress?: (addr: `0x${string}` | null) => void;
  viewAddress?: `0x${string}` | null;
}) {
  const [searchOpen, setSearchOpen] = useState(false);
  const { accounts, isConnected, isDetecting, isConnecting, connect, disconnect } = useUpProvider();
  const addr = accounts[0] || null;

  return (
    <>
      <SearchPopup
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
        onSelect={(a) => {
          onViewAddress?.(a);
          setSearchOpen(false);
        }}
      />
      <header className="app-header">
        <div style={{ fontSize: 17, fontWeight: 700 }}>
          <EmojiText>🆙chan</EmojiText> Token Claimer
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <button
            onClick={() => setSearchOpen(true)}
            className="btn-icon"
            title="View any address"
          >
            🔍
          </button>
          <TxIndicator />
        {viewAddress ? (
          <div className="view-badge">
            <span>{viewAddress.slice(0, 6)}…{viewAddress.slice(-4)}</span>
            <button onClick={() => onViewAddress?.(null)} className="btn-icon">✕</button>
          </div>
        ) : isDetecting ? (
          <span className="text-micro">...</span>
        ) : isConnected ? (
          <div className="app-badge">
            <span className="app-badge-dot" />
            <span className="text-caption-bold">
              {addr?.slice(0, 6)}…{addr?.slice(-4)}
            </span>
            <button onClick={disconnect} className="btn-icon">
              ✕
            </button>
          </div>
        ) : (
          <button
            onClick={connect}
            disabled={isConnecting}
            className="btn btn-primary btn-sm"
          >
            {isConnecting ? '...' : <EmojiText>Connect 🆙</EmojiText>}
          </button>
        )}
        </div>
      </header>
    </>
  );
}
