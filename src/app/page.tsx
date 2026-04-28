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

  return (
    <div style={{ height: '100dvh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <Header />
      <div className="scrollable" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, padding: `0 var(--content-padding) 10px`, maxWidth: 'var(--content-max-width)', width: '100%', margin: '0 auto' }}>
        {!token ? (
          <div className="card" style={{ padding: 20, textAlign: 'center' }}><p style={{ color: 'var(--c-text-muted)' }}>Not found</p></div>
        ) : (
          <>
            <TokenSelector tokens={TOKENS} selected={id} onSelect={setId} enabledChainIds={chains} />
            <TokenCard token={token} />
            <StatusCard token={token} status={st} onRefresh={refresh} />
            <ActionCard token={token} status={st} chain={chain} onRefetch={refresh} />
            <HoldersCard token={token} />
          </>
        )}
      </div>
      <footer style={{
        height: 40, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: 6, fontSize: 12, color: 'var(--c-text-muted)',
        borderTop: '1px solid var(--c-border)',
        background: 'var(--c-surface)',
      }}>
        <span>Made with ♥ by</span>
        <a href="https://x.com/UPchan_lyx" target="_blank" style={{ color: 'var(--c-text)', fontWeight: 700, textDecoration: 'none' }}>🆙chan</a>
        <span>|</span>
        <a href="https://x.com/UPchan_lyx" target="_blank" style={{ color: 'var(--c-text-link)', textDecoration: 'none', fontWeight: 600 }}>𝕏</a>
      </footer>
    </div>
  );
}
