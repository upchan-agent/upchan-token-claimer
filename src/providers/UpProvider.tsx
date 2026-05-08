'use client';

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';

// ─── EIP-1193 Provider interface ───
export interface EIP1193Provider {
  request: (args: { method: string; params?: unknown[] | Record<string, unknown> }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
  accounts?: `0x${string}`[];
  chainId?: number;
  isMiniApp?: boolean | Promise<boolean>;
  isUniversalProfile?: boolean;
}

interface WindowWithProviders {
  lukso?: EIP1193Provider;
  ethereum?: EIP1193Provider & { isUniversalProfile?: boolean };
}

function getWindowProviders(): WindowWithProviders {
  return window as unknown as WindowWithProviders;
}

interface UPContextValue {
  provider: EIP1193Provider | null;
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
  const [provider, setProvider] = useState<EIP1193Provider | null>(null);
  const [accounts, setAccounts] = useState<`0x${string}`[]>([]);
  const [chainId, setChainId] = useState<number | null>(null);
  const [isDetecting, setIsDetecting] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted) return;
    let cancelled = false;
    const forceTimer = setTimeout(() => { if (!cancelled) setIsDetecting(false); }, 4000);

    const init = async () => {
      try {
        const { lukso, ethereum } = getWindowProviders();

        // 1. Grid (UP Browser)
        let gridProvider: EIP1193Provider | null = null;
        try {
          const mod = await import('@lukso/up-provider');
          gridProvider = mod.createClientUPProvider() as EIP1193Provider;
        } catch { /* no Grid provider */ }

        if (gridProvider && !cancelled) {
          const miniApp = await Promise.race([
            Promise.resolve(gridProvider.isMiniApp),
            new Promise<boolean>(r => setTimeout(() => r(false), 1500)),
          ]);
          if (miniApp) {
            setProvider(gridProvider);
            setIsDetecting(false);
            setAccounts((gridProvider.accounts || []) as `0x${string}`[]);
            setChainId(gridProvider.chainId ?? null);
            gridProvider.on?.('accountsChanged', (a: unknown) => setAccounts(a as `0x${string}`[]));
            gridProvider.on?.('chainChanged', (id: unknown) => setChainId(Number(id)));
            return;
          }
        }

        // 2. Standalone UP extension
        if (lukso && !cancelled) {
          setProvider(lukso);
          setIsDetecting(false);
          try {
            const a = await lukso.request({ method: 'eth_accounts' });
            if (Array.isArray(a) && a.length) setAccounts(a as `0x${string}`[]);
          } catch { /* no accounts */ }
          try {
            const c = await lukso.request({ method: 'eth_chainId' });
            if (c) setChainId(Number(c));
          } catch { /* no chainId */ }
          lukso.on?.('accountsChanged', (a: unknown) => setAccounts(a as `0x${string}`[]));
          lukso.on?.('chainChanged', (id: unknown) => setChainId(Number(id)));
          return;
        }

        // 3. window.ethereum fallback (Universal Profile detection)
        if (ethereum?.isUniversalProfile && !cancelled) {
          setProvider(ethereum);
          setIsDetecting(false);
          try {
            const a = await ethereum.request({ method: 'eth_accounts' });
            if (Array.isArray(a) && a.length) setAccounts(a as `0x${string}`[]);
          } catch { /* no accounts */ }
          try {
            const c = await ethereum.request({ method: 'eth_chainId' });
            if (c) setChainId(Number(c));
          } catch { /* no chainId */ }
          ethereum.on?.('chainChanged', (id: unknown) => setChainId(Number(id)));
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
    };
  }, [mounted]);

  const connect = useCallback(async () => {
    const { lukso, ethereum } = getWindowProviders();
    const p = lukso || ethereum;
    if (!p) return;
    setIsConnecting(true);
    try {
      const a = await p.request({ method: 'eth_requestAccounts' });
      setAccounts(a as `0x${string}`[]);
      const c = await p.request({ method: 'eth_chainId' });
      if (c) setChainId(Number(c));
    } catch (e: unknown) {
      if (e instanceof Error) console.log('[UP] connect error:', e.message);
    } finally {
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
