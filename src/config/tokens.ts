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
    id: 't3',
    proxy: '0xcf628334541e1e71C64a75E0B8aC8139f6830744',
    chainId: 4201,
  },
  {
    id: 't4',
    proxy: '0x1d68e3EC3720800899503BC67047a76De97241fb',
    chainId: 4201,
  },
  {
    id: 't5',
    proxy: '0x06c196E45f96dFcda6618491506173372851a7B7',
    chainId: 4201,
  },
  {
    id: 't1',
    proxy: '0x74adA9383f15c96786f05F7A09D02899DFF605dA',
    chainId: 4201,
  },
  {
    id: 't2',
    proxy: '0xb6b0fa1d061d9bb2d36c84ad9a213fdb39d2f679',
    chainId: 4201,
  },
  {
    id: 'test-mint-v3',
    proxy: '0xc191eb1c0eb7bcf928fb55ada71285a1b01b8c36',
    chainId: 4201,
  },
  {
    id: 'phlametoken',
    proxy: '0xe8731f5d5002e2261175afb970517d4c5dad028c',
    chainId: 42,
  }
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
