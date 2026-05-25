// ═══════════════════════════════════════════════
// 🆙chan Token Claimer — Token Configuration
//
// 📌 過渡的な静的コンフィグ
// 将来的には UP の LSP12IssuedAssets[] から
// 動的にトークン一覧を取得する方針。
// その時は TOKENS 配列は不要になり、
// 代わりに UP.getData(LSP12IssuedAssets) で
// 全トークンを列挙する。
//
// 現在は LSP12 に加えてこの静的リストを
// フォールバックとして維持。
// ═══════════════════════════════════════════════

export interface TokenConfig {
  id: string;
  label?: string;
  proxy: `0x${string}`;
  chainId: number;
}

// ─── Gate Contract Interfaces ───
// Layer 1: IMintGate — core, all gate contracts must implement
export const GATE_ABI = [
  'function gateType() view returns (string)',
  'function check(address user) view returns (bool, string, string)',
  'function canMint(address caller, address to, uint256 amount) view returns (bool)',
];

export const COMPOSITE_ABI = [
  'function getChildren() view returns (address[])',
  'function getOperator() view returns (string)',
];

// ─── Tokens ───
export const TOKENS: TokenConfig[] = [
  {
    id: 't6',
    label: '🆙chan T6',
    proxy: '0x38dD15D88fe08611C80b5b05c00908F687059CF8',
    chainId: 4201,
  },
  {
    id: 't7',
    label: '🆙chan T7',
    proxy: '0x8083360ca23223d653ee93C4aF2FB7f8a9a08aec',
    chainId: 4201,
  },
  {
    id: 'phlametoken',
    label: 'Phlame Token',
    proxy: '0xe8731f5d5002e2261175afb970517d4c5dad028c',
    chainId: 42,
  },
  {
    id: 'bs-test',
    label: '🆙chan BS Test',
    proxy: '0x8c93ca6dfe849EF8f8fAE0200A4E0038a635bD05',
    chainId: 4201,
  },
  {
    id: 'impltest',
    label: '🆙chan new impl Test',
    proxy: '0xc2c546929514cf14150ebf57ffc4b42fc226993d',
    chainId: 4201,
  },  
];

// ─── Chains ───
export const CHAINS: Record<number, { name: string; rpc: string; explorer: string }> = {
  4201: {
    name: 'LUKSO Testnet',
    rpc: 'https://4201.rpc.thirdweb.com/f20713774ede91090d43daf75243e8ca',
    explorer: 'https://explorer.execution.testnet.lukso.network',
  },
  42: {
    name: 'LUKSO',
    rpc: 'https://42.rpc.thirdweb.com/f20713774ede91090d43daf75243e8ca',
    explorer: 'https://explorer.execution.mainnet.lukso.network',
  },
};

// ─── Constants ───
export const LSP26_ADDRESS = '0xf01103E5a9909Fc0DBe8166dA7085e0285daDDcA';

export const UP_ABI = [
  'function execute(uint256 operation, address target, uint256 value, bytes data) payable returns (bytes)',
  'function owner() view returns (address)',
];

// ─── URL Helpers ───

/** Returns universaleverything.io asset page URL (token contract explorer) */
export function assetUrl(address: string, chainId: number): string {
  return `https://universaleverything.io/asset/${address}${chainId === 4201 ? '?network=testnet' : ''}`;
}

/** Returns universalprofile.cloud profile page URL (UP explorer) */
export function profileUrl(address: string): string {
  return `https://universalprofile.cloud/${address}`;
}
