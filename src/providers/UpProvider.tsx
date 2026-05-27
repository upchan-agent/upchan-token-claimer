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

type ConnectionSource = 'grid' | 'modal' | 'extension' | null;

interface WindowWithProviders {
  lukso?: EIP1193Provider;
  ethereum?: EIP1193Provider & { isUniversalProfile?: boolean };
}

function getWindowProviders(): WindowWithProviders {
  return window as unknown as WindowWithProviders;
}

// ─── up-modal instance (standalone, shared across mounts) ───
let modalConnectorInstance: {
  wagmiConfig: any;
  showSignInModal: () => void;
  destroyModal: () => void;
} | null = null;

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
  connectionSource: ConnectionSource;
}

const Ctx = createContext<UPContextValue>({
  provider: null, accounts: [], chainId: null,
  isConnected: false, isDetecting: true, isConnecting: false,
  connect: async () => {}, disconnect: () => {}, setChainId: () => {},
  connectionSource: null,
});

export function UPProvider({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [provider, setProvider] = useState<EIP1193Provider | null>(null);
  const [accounts, setAccounts] = useState<`0x${string}`[]>([]);
  const [chainId, setChainId] = useState<number | null>(null);
  const [isDetecting, setIsDetecting] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionSource, setConnectionSource] = useState<ConnectionSource>(null);

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
            setConnectionSource('grid');
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

    // ─── Standalone: Initialize up-modal for Connect button ───
    // Grid でなかった場合のみ、モーダルを遅延初期化
    initStandaloneModal();

    return () => {
      cancelled = true;
      clearTimeout(forceTimer);
    };
  }, [mounted]);

  // ─── Standalone: up-modal の初期化 ───
  const initStandaloneModal = useCallback(async () => {
    if (connectionSource === 'grid') return; // Grid 内ではモーダル不要
    if (modalConnectorInstance) return; // 既に初期化済み
    try {
      const [{ setupLuksoConnector }, { luksoTestnet }] = await Promise.all([
        import('@lukso/up-modal'),
        import('viem/chains'),
      ]);
      const connector = await setupLuksoConnector({
        theme: 'dark',
        walletConnect: {
          projectId: '7d1af65dc2722192d9914b5d6eaeb421',
        },
        chains: {
          additional: [luksoTestnet],
        },
        connectors: {
          eoa: false, // UP 専用、EOA は許容しない
        },
        onConnect: async () => {
          const { getConnection } = await import('@wagmi/core');
          const conn = getConnection(connector.wagmiConfig);
          if (conn?.connector) {
            try {
              const wagmiProvider: any = await conn.connector.getProvider();
              // EIP-1193 ラッパー
              const eip1193: EIP1193Provider = {
                request: (args) => wagmiProvider.request(args.method, args.params),
                on: (event, handler) => wagmiProvider.on?.(event, handler),
                removeListener: (event, handler) => wagmiProvider.removeListener?.(event, handler),
                accounts: (conn.addresses ?? []) as `0x${string}`[],
                chainId: conn.chainId,
                isUniversalProfile: true,
              };
              setProvider(eip1193);
              setConnectionSource('modal');
              if (conn.addresses?.length) {
                setAccounts(conn.addresses as `0x${string}`[]);
              }
              if (conn.chainId) setChainId(conn.chainId);
            } catch (e) {
              console.warn('[UP] Failed to get provider from wagmi connector:', e);
            }
          }
        },
        onError: (event: CustomEvent) => {
          console.warn('[UP] Modal connection error:', event.detail);
        },
      });
      modalConnectorInstance = connector;
    } catch (e) {
      console.warn('[UP] up-modal not available:', e);
    }
  }, [connectionSource]);

  const connect = useCallback(async () => {
    // Grid 内では親からの自動接続を使う
    if (connectionSource === 'grid') return;

    // up-modal が利用可能ならモーダルを開く
    if (modalConnectorInstance) {
      modalConnectorInstance.showSignInModal();
      return;
    }

    // fallback: window.lukso 直接（UP Extension 直叩き）
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
  }, [connectionSource]);

  const disconnect = useCallback(async () => {
    // modal 経由の接続なら wagmi disconnect も呼ぶ
    if (connectionSource === 'modal' && modalConnectorInstance) {
      try {
        const { disconnect: wagmiDisconnect } = await import('@wagmi/core');
        await wagmiDisconnect(modalConnectorInstance.wagmiConfig);
      } catch (e) {
        console.warn('[UP] wagmi disconnect error:', e);
      }
    }
    setAccounts([]);
    setChainId(null);
    setConnectionSource(null);
  }, [connectionSource]);

  return (
    <Ctx.Provider value={{
      provider, accounts, chainId,
      isConnected: accounts.length > 0,
      isDetecting, isConnecting, connect, disconnect, setChainId,
      connectionSource,
    }}>
      {children}
    </Ctx.Provider>
  );
}

export function useUpProvider() { return useContext(Ctx); }
