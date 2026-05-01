'use client';

import { useState } from 'react';
import { useUpProvider } from '@/lib/up-provider';
import { EmojiText } from './EmojiText';
import { SearchPopup } from './SearchPopup';

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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="text-caption-bold"><EmojiText>🆙chan</EmojiText> Token Claimer</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <button
            onClick={() => setSearchOpen(true)}
            className="btn-icon"
            title="Debug: View any address"
            style={{ fontSize: 16 }}
          >
            🔍
          </button>
        {viewAddress ? (
          <div className="view-badge">
            <span>{viewAddress.slice(0, 6)}…{viewAddress.slice(-4)}</span>
            <button onClick={() => onViewAddress?.(null)} className="btn-icon" style={{ fontSize: 10 }}>✕</button>
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
