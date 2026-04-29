'use client';

import { useUpProvider } from '@/lib/up-provider';

export function Header() {
  const { accounts, isConnected, isDetecting, isConnecting, connect, disconnect } = useUpProvider();
  const addr = accounts[0] || null;

  return (
    <header className="app-header">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className="header-logo">🆙</span>
        <span className="text-caption-bold">Token Claimer</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {isDetecting ? (
          <span className="text-micro">...</span>
        ) : isConnected ? (
          <div className="connected-badge">
            <span className="connected-dot" />
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
            className="btn btn-primary btn-header"
          >
            {isConnecting ? '...' : 'Connect Wallet'}
          </button>
        )}
      </div>
    </header>
  );
}
