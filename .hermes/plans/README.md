# up-modal Connect 導入計画

> **実施者:** Codex CLI (codex exec)

**Goal:** Grid 外での `Connect 🆙` ボタンを `@lukso/up-modal` に対応させ、既存の Grid mini-app 接続は維持する

**Architecture:**
- Grid 内: `@lukso/up-provider` (`createClientUPProvider()`) + `isMiniApp` 検出 → **変更なし**
- Grid 外: 未接続時に `@lukso/up-modal` (`setupLuksoConnector()` + `showSignInModal()`) を開く
- 接続後: wagmi connector から EIP-1193 provider を取り出し、既存の `UpProvider` state に流す
- EOA接続は無効化し、UP専用にする

**注意点:**
- `@lukso/up-provider` は消さない（Grid 用に必須）
- LUKSO Testnet を `chains.additional` に追加
- 既存の `window.lukso` fallback は維持（タイミング問題回避用）

---

## Task 1: Install dependencies

```bash
npm install @lukso/up-modal @wagmi/core viem
```

- `@wagmi/core@^3.x`, `viem@^2.x` は peerDependencies
- `@lukso/up-modal@0.21.6` が自動で解決

## Task 2: Modify UpProvider.tsx

**ファイル:** `src/providers/UpProvider.tsx`

### 変更内容

**a) 型・定数の追加**

```typescript
// ファイル先頭付近に追加
type ConnectionSource = 'grid' | 'modal' | 'extension' | null;

// モーダルコネクタインスタンス（モジュールレベルのキャッシュ）
let modalConnectorInstance: {
  wagmiConfig: any;
  showSignInModal: () => void;
  destroyModal: () => void;
} | null = null;
```

**b) UPContextValue に connectionSource を追加**

```typescript
interface UPContextValue {
  // 既存フィールドは維持
  provider: EIP1193Provider | null;
  accounts: `0x${string}`[];
  chainId: number | null;
  isConnected: boolean;
  isDetecting: boolean;
  isConnecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  setChainId: (id: number) => void;
  // 新規: どの接続ソースを使っているか
  connectionSource: ConnectionSource;
}
```

**c) UPProvider component 内**

```typescript
// 状態追加
const [connectionSource, setConnectionSource] = useState<ConnectionSource>(null);
```

**d) 自動検出 useEffect 内（最初の useEffect）**

既存の Grid 検出ロジック（`createClientUPProvider()` → `isMiniApp` チェック）は完全維持。

Grid でなかった場合の処理を拡張:
- `window.lukso` の検出は維持（既存 extension すでに接続済みの場合のため）
- Grid でも extension でもなかった場合 → 遅延で up-modal 初期化

```typescript
// init() の Grid 分岐後、Grid でなかった場合に:
if (!gridProvider) {
  // 1. window.lukso 検出は並行で維持（既存の extension auto-detect 用）
  // 2. up-modal を初期化（connect ボタン用）
  initStandaloneModal();
}
```

**e) up-modal 初期化関数**

```typescript
async function initStandaloneModal() {
  try {
    const { setupLuksoConnector } = await import('@lukso/up-modal');
    const { luksoTestnet } = await import('viem/chains');
    
    modalConnectorInstance = await setupLuksoConnector({
      theme: 'dark',
      walletConnect: {
        projectId: '7d1af65dc2722192d9914b5d6eaeb421', // LUKSO default
      },
      chains: {
        additional: [luksoTestnet],
      },
      connectors: {
        eoa: false, // UP 専用、EOA は出さない
      },
      onConnect: async () => {
        // wagmi の connection から provider/accounts/chainId を取り出す
        const { getConnection } = await import('@wagmi/core');
        const conn = getConnection(modalConnectorInstance!.wagmiConfig);
        if (conn?.connector) {
          try {
            const wagmiProvider = await conn.connector.getProvider();
            // EIP-1193 にラップ
            const eip1193: EIP1193Provider = {
              request: async (args) => wagmiProvider.request(args),
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
  } catch (e) {
    console.warn('[UP] up-modal not available:', e);
    // fallback: window.lukso で接続するしかない
  }
}
```

**f) connect() の変更**

Grid 内なら何もしない。Grid 外なら up-modal を開く。modal が使えない場合は従来の `window.lukso` 直叩きにフォールバック。

```typescript
const connect = useCallback(async () => {
  // Grid 内では既に接続済み
  if (connectionSource === 'grid') return;
  
  // up-modal が利用可能なら開く
  const m = modalConnectorInstance;
  if (m) {
    m.showSignInModal();
    return;
  }
  
  // fallback: 従来通り window.lukso 直叩き
  const { lukso, ethereum } = getWindowProviders();
  const p = lukso || ethereum;
  if (!p) return;
  setIsConnecting(true);
  try {
    const a = await p.request({ method: 'eth_requestAccounts' });
    setAccounts(a as `0x${string}`[]);
    const c = await p.request({ method: 'eth_chainId' });
    if (c) setChainId(Number(c));
    setConnectionSource(null); // extension direct
  } catch (e) {
    if (e instanceof Error) console.log('[UP] connect error:', e.message);
  } finally {
    setIsConnecting(false);
  }
}, [connectionSource]);
```

**g) disconnect() の変更**

modal 経由で接続していたら wagmi disconnect も呼ぶ。

```typescript
const disconnect = useCallback(async () => {
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
```

**h) Context value に connectionSource を追加**

```typescript
<Ctx.Provider value={{
  provider, accounts, chainId,
  isConnected: accounts.length > 0,
  isDetecting, isConnecting, connect,
  disconnect: disconnectHandler, // 新しい disconnect
  setChainId,
  connectionSource,
}}>
```

## Task 3: Build & verify

```bash
npm run build
```

エラーなく通れば成功。

## 補足

- `package.json` の `@lukso/up-provider` は消さない（Grid 必須）
- `TxContext.tsx` は変更不要（provider インターフェースが同じ EIP-1193 のまま）
- `Header.tsx` の `connect` / `disconnect` / `isConnecting` / `isConnected` は変更なしで動く
