'use client';

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
// Dynamic import — only loads on client (avoids SSR build error)

interface UPContextValue {
  provider: any;
  accounts: `0x${string}`[];
  chainId: number | null;
  isConnected: boolean;
  isDetecting: boolean;
  isConnecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  setChainId: (id: number) => void;
}

const Ctx = createContext<UPContextValue>({
  provider: null, accounts: [], chainId: null,
  isConnected: false, isDetecting: true, isConnecting: false,
  connect: async () => {}, disconnect: () => {}, setChainId: () => {},
});

export function UPProvider({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [provider, setProvider] = useState<any>(null);
  const [accounts, setAccounts] = useState<`0x${string}`[]>([]);
  const [chainId, setChainId] = useState<number | null>(null);
  const [isDetecting, setIsDetecting] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted) return;
    let cancelled = false;
    let pollInterval: ReturnType<typeof setInterval> | undefined = undefined;
    const forceTimer = setTimeout(() => { if (!cancelled) setIsDetecting(false); }, 4000);

    const init = async () => {
      try {
        const w = window as any;
        const luksoProvider = w.lukso;

        // 1. Grid (UP Browser)
        let gridProvider: any = null;
        try {
          const mod = await import('@lukso/up-provider');
          gridProvider = mod.createClientUPProvider();
        } catch {}

        if (gridProvider && !cancelled) {
          const miniApp = await Promise.race([
            gridProvider.isMiniApp,
            new Promise<boolean>(r => setTimeout(() => r(false), 1500)),
          ]);
          if (miniApp) {
            setProvider(gridProvider);
            setIsDetecting(false);
            setAccounts((gridProvider.accounts || []) as `0x${string}`[]);
            setChainId(gridProvider.chainId || null);
            gridProvider.on('accountsChanged', (a: string[]) => setAccounts(a as `0x${string}`[]));
            gridProvider.on('chainChanged', (id: number) => setChainId(id));
            return;
          }
        }

        // 2. Standalone UP extension
        if (luksoProvider && !cancelled) {
          setProvider(luksoProvider);
          setIsDetecting(false);
          try {
            const a = await luksoProvider.request({ method: 'eth_accounts' });
            if (a?.length) setAccounts(a as `0x${string}`[]);
          } catch {}
          try {
            const c = await luksoProvider.request({ method: 'eth_chainId' });
            if (c) setChainId(Number(c));
          } catch {}
          luksoProvider.on('accountsChanged', (a: string[]) => setAccounts(a as `0x${string}`[]));
          luksoProvider.on('chainChanged', (id: number) => setChainId(id));
          return;
        }

        // 3. window.ethereum fallback
        if (w.ethereum?.isUniversalProfile && !cancelled) {
          setProvider(w.ethereum);
          setIsDetecting(false);
          try {
            const a = await w.ethereum.request({ method: 'eth_accounts' });
            if (a?.length) setAccounts(a as `0x${string}`[]);
          } catch {}
          try {
            const c = await w.ethereum.request({ method: 'eth_chainId' });
            if (c) setChainId(Number(c));
          } catch {}
          w.ethereum.on('chainChanged', (id: string) => setChainId(Number(id)));
          return;
        }

        // 4. No provider
        if (!cancelled) setIsDetecting(false);
      } catch {
        if (!cancelled) setIsDetecting(false);
      }
    };

    init();
    return () => {
      cancelled = true;
      clearTimeout(forceTimer);
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [mounted]);

  const connect = useCallback(async () => {
    const w = window as any;
    const p = w.lukso || w.ethereum;
    if (!p) return;
    setIsConnecting(true);
    try {
      const a = await p.request({ method: 'eth_requestAccounts' });
      setAccounts(a as `0x${string}`[]);
      const c = await p.request({ method: 'eth_chainId' });
      console.log('[UP] connect eth_chainId raw:', c, 'parsed:', c ? Number(c) : null);
      if (c) setChainId(Number(c));
    } catch (e) { console.log('[UP] connect error:', e); } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => { setAccounts([]); setChainId(null); }, []);

  return (
    <Ctx.Provider value={{
      provider, accounts, chainId,
      isConnected: accounts.length > 0,
      isDetecting, isConnecting, connect, disconnect, setChainId,
    }}>
      {children}
    </Ctx.Provider>
  );
}

export function useUpProvider() { return useContext(Ctx); }
