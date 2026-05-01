// ═══════════════════════════════════════════════
// 🆙chan Token Claimer — Token Configuration
// ═══════════════════════════════════════════════

export interface TokenConfig {
  id: string;
  proxy: `0x${string}`;
  chainId: number;
  mintGate: `0x${string}`;
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
    id: 'genesis-old',
    proxy: '0xf1d14e985cf4d7e95ba95e47b24dac47a811ceef',
    chainId: 4201,
    mintGate: '0x0000000000000000000000000000000000000000',
  },
  {
    id: 'genesis-testnet',
    proxy: '0xb1bD0a759AD9b47C1E9813B75877A503FcD95a3D',
    chainId: 4201,
    mintGate: '0x7592d3A04c9BfE0eDf05630ca183B22Bd1D2D811',
  },
  {
    id: 'genesis-v2',
    proxy: '0x46f2c84D266eF835EC63a753A3E22065C74202d1',
    chainId: 4201,
    mintGate: '0x58bEa6a7e23ec74d4a93415bf950D72001EF1fac',
  },
  {
    id: 'phlametoken',
    proxy: '0xe8731f5d5002e2261175afb970517d4c5dad028c',
    chainId: 42,
    mintGate: '0x0000000000000000000000000000000000000000',
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


