// ═══════════════════════════════════════════════
// 🆙chan Token Claimer — Token Configuration
//
// フロントエンド起動用の最小コンフィグ。
// 基本はオンチェーンから情報を取得する方針。
// 管理用レジストリ（デプロイ記録・詳細パラメータ）は
// config/tokens.json を参照。
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
