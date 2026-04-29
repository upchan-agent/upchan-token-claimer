'use client';

import { useSearchParams } from 'next/navigation';
import { useState, useMemo, useCallback } from 'react';
import { TOKENS, CHAINS } from '@/config/tokens';
import { useUpProvider } from '@/lib/up-provider';
import { useTokenStatus } from '@/lib/useToken';
import { Header } from '@/components/Header';
import { TokenSelector } from '@/components/TokenSelector';
import { TokenCard } from '@/components/TokenCard';
import { StatusCard } from '@/components/StatusCard';
import { ActionCard } from '@/components/ActionCard';
import { HoldersCard } from '@/components/HoldersCard';

export default function HomePage() {
  const params = useSearchParams();
  const [id, setId] = useState<string | null>(params.get('token') || TOKENS[0]?.id || null);
  const { accounts, chainId, isConnected, setChainId } = useUpProvider();

  const chains = useMemo(() => {
    if (!isConnected || !chainId) return [...new Set(TOKENS.map(t => t.chainId))];
    const numericChainId = typeof chainId === 'string' ? parseInt(chainId, 10) : chainId;
    const chainTokens = TOKENS.filter(t => t.chainId === numericChainId);
    return chainTokens.length > 0 ? [numericChainId] : [];
  }, [isConnected, chainId]);

  const enabledTokens = useMemo(() =>
    TOKENS.filter(t => chains.includes(t.chainId)), [chains]);

  const displayToken = useMemo(() => {
    if (id && enabledTokens.some(t => t.id === id)) return TOKENS.find(t => t.id === id) || null;
    return enabledTokens[0] || null;
  }, [id, enabledTokens]);

  const user = accounts[0] || null;
  const st = useTokenStatus(displayToken, user);
  const refresh = useCallback(() => st.refetch(), [st]);

  /* Use wallet's actual chain for display if available, else fallback to token config */
  const chain = displayToken
    ? (CHAINS[displayToken.chainId] || CHAINS[4201])
    : (chainId ? (CHAINS[Number(chainId)] || CHAINS[4201]) : CHAINS[4201]);

  if (!displayToken) {
    return (
      <div className="app-shell">
        <Header />
        <footer className="app-footer">
          Made with ♥ by
          <a href="https://universalprofile.cloud/0xbcA4eEBea76926c49C64AB86A527CC833eFa3B2D" target="_blank" className="link footer-icon">🆙chan</a>
          <span className="footer-divider">|</span>
          <a href="https://x.com/UPchan_lyx" target="_blank" className="link footer-icon">
            <svg viewBox="0 0 24 24" width={9} height={9} fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
          </a>
          {chainId && (
            <span onClick={() => setChainId(chainId === 42 ? 4201 : 42)}
              style={{ cursor: 'pointer', fontSize: 9, color: 'var(--c-text-muted)', marginLeft: 4 }} title="Toggle network">[{chainId}]</span>
          )}
        </footer>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <Header />

      {/* Scrollable body */}
      <div className="scrollable" style={{ flex: 1 }}>
        <div className="section-content card-stack">
          {/* Token selector */}
          {enabledTokens.length > 1 && (
            <TokenSelector tokens={enabledTokens} selected={id || ''} onSelect={(newId) => setId(newId)} enabledChainIds={chains} />
          )}

          {/* Token identity card */}
          <TokenCard token={displayToken} />

          {/* Details + Properties */}
          <StatusCard token={displayToken} status={st} chain={chain} onRefresh={refresh} />

          {/* Gate + Mint */}
          <ActionCard token={displayToken} status={st} chain={chain} onRefetch={refresh} />

          {/* Holders */}
          <HoldersCard token={displayToken} />
        </div>
      </div>

      {/* Footer */}
      <footer className="app-footer">
        Made with ♥ by
        <a href="https://universalprofile.cloud/0xbcA4eEBea76926c49C64AB86A527CC833eFa3B2D" target="_blank" className="link footer-icon">
          🆙chan
        </a>
        <span className="footer-divider">|</span>
        <a href="https://x.com/UPchan_lyx" target="_blank" className="link footer-icon">
          <svg viewBox="0 0 24 24" width={9} height={9} fill="currentColor">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
        </a>
        {chainId && (
          <span onClick={() => setChainId(chainId === 42 ? 4201 : 42)}
            style={{ cursor: 'pointer', fontSize: 9, color: 'var(--c-text-muted)', marginLeft: 4 }} title="Toggle network">
            [{chainId}]
          </span>
        )}
      </footer>
    </div>
  );
}
