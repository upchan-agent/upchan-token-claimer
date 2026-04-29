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
  const [id, setId] = useState(params.get('token') || TOKENS[0]?.id);
  const { accounts, chainId, isConnected } = useUpProvider();

  const token = useMemo(() => TOKENS.find(t => t.id === id) || TOKENS[0], [id]);
  const user = accounts[0] || null;
  const st = useTokenStatus(token, user);
  const refresh = useCallback(() => st.refetch(), [st]);

  const chains = useMemo(() => {
    if (!isConnected || !chainId) return [...new Set(TOKENS.map(t => t.chainId))];
    return [chainId];
  }, [isConnected, chainId]);

  const chain = CHAINS[token?.chainId] || CHAINS[4201];

  if (!token) {
    return (
      <div className="app-shell">
        <Header />
        <div className="centered">
          <p className="text-micro">Not found</p>
        </div>
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
          {TOKENS.length > 1 && (
            <TokenSelector tokens={TOKENS} selected={id} onSelect={setId} enabledChainIds={chains} />
          )}

          {/* Token identity card */}
          <TokenCard token={token} />

          {/* Details + Properties */}
          <StatusCard token={token} status={st} chain={chain} onRefresh={refresh} />

          {/* Gate + Mint */}
          <ActionCard token={token} status={st} chain={chain} onRefetch={refresh} />

          {/* Holders */}
          <HoldersCard token={token} />
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
      </footer>
    </div>
  );
}
