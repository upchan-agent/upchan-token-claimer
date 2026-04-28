'use client';

import { useUpProvider } from '@/lib/up-provider';

export function Header() {
  const { accounts, isConnected, isDetecting, isConnecting, connect, disconnect } = useUpProvider();
  const addr = accounts[0] || null;

  return (
    <header style={{
      height: 52, flexShrink: 0,
      display: 'flex', alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 var(--content-padding)',
      background: 'linear-gradient(135deg, #fdf2f8, #f3e8ff)',
      borderBottom: '1px solid #e8e0f0',
    }}>
      {/* Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 20 }}>🆙</span>
        <span className="font-title" style={{
          fontSize: 16, fontWeight: 700, color: 'var(--c-text)',
          letterSpacing: '-0.02em',
        }}>
          Token Claimer
        </span>
        <span style={{ fontSize: 13 }}>✨</span>
      </div>

      {/* Account */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {isDetecting ? (
          <span style={{ fontSize: 11, color: 'var(--c-text-muted)' }}>...</span>
        ) : isConnected ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              display: 'inline-block', width: 8, height: 8,
              borderRadius: '50%', background: 'var(--c-success)',
            }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--c-text-secondary)', fontFamily: 'monospace' }}>
              {addr?.slice(0, 6)}…{addr?.slice(-4)}
            </span>
            {accounts.length > 0 && (
              <button onClick={disconnect}
                style={{
                  padding: '3px 8px', border: '1px solid #e8e0f0', borderRadius: 8,
                  background: 'white', fontSize: 11, color: '#888',
                  cursor: 'pointer', fontFamily: 'inherit',
                }}>
                ✕
              </button>
            )}
          </div>
        ) : (
          <button onClick={connect} disabled={isConnecting}
            style={{
              padding: '6px 14px', border: 'none', borderRadius: 10,
              background: 'linear-gradient(135deg, #f06292, #d94691)',
              color: 'white', fontSize: 12, fontWeight: 700, cursor: 'pointer',
              fontFamily: 'inherit', boxShadow: '0 1px 4px rgba(217,70,145,0.2)',
            }}>
            {isConnecting ? '...' : '🔗 Connect'}
          </button>
        )}
      </div>
    </header>
  );
}
