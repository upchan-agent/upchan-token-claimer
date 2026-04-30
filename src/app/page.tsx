'use client';

import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useState, useMemo } from 'react';
import { TOKENS, CHAINS } from '@/config/tokens';
import { useUpProvider } from '@/lib/up-provider';
import { useTokenStatus } from '@/lib/useToken';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { TokenSelector } from '@/components/TokenSelector';
import { TokenCard } from '@/components/TokenCard';
import { StatusCard } from '@/components/StatusCard';
import { ActionCard } from '@/components/ActionCard';
import { HoldersCard } from '@/components/HoldersCard';

export default function HomePage() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [id, setId] = useState<string | null>(params.get('token') || TOKENS[0]?.id || null);
  const { accounts, chainId, isConnected } = useUpProvider();

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
  const refresh = st.refetch;

  // Use UP's actual chain for display if available, else fallback to token config
  const chain = displayToken
    ? (CHAINS[displayToken.chainId] || CHAINS[4201])
    : (chainId ? (CHAINS[Number(chainId)] || CHAINS[4201]) : CHAINS[4201]);

  if (!displayToken) {
    return (
      <div className="app-shell">
        <Header />
        <Footer />
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
            <TokenSelector tokens={enabledTokens} selected={id || ''} onSelect={(newId) => {
              setId(newId);
              router.replace(`${pathname}?token=${newId}`, { scroll: false });
            }} />
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

      <Footer />
    </div>
  );
}
