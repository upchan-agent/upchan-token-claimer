// ═══════════════════════════════════════════════
// 🆙chan Token Claimer — Token Configuration
// ═══════════════════════════════════════════════

export interface TokenConfig {
  id: string;
  name: string;
  symbol: string;
  proxy: `0x${string}`;
  targetProfile: `0x${string}`;
  supplyCap: number;
  image: string;
  description: string;
  chainId: number;
  mintGate: `0x${string}`;
  enabled: boolean;
  metadataUri: string;
}

// ─── Known Gate Types ───
export interface GateInfo {
  type: 'lsp26-follow' | 'none';
  label: string;
  actionLabel: string;
}

export const KNOWN_GATES: Record<string, GateInfo> = {
  // LSP26 Follow Gate
  '0x7592d3a04c9bfe0edf05630ca183b22bd1d2d811': {
    type: 'lsp26-follow',
    label: 'Follow 🆙chan on LUKSO',
    actionLabel: 'Follow 🆙chan',
  },
  // No gate
  '0x0000000000000000000000000000000000000000': {
    type: 'none',
    label: 'No conditions',
    actionLabel: '',
  },
};

export function getGateInfo(address: `0x${string}`): GateInfo {
  return KNOWN_GATES[address.toLowerCase() as `0x${string}`] || {
    type: 'lsp26-follow',
    label: 'Meet the conditions to mint',
    actionLabel: '',
  };
}

// ─── Tokens ───
export const TOKENS: TokenConfig[] = [
  {
    id: 'genesis-testnet',
    name: '',
    symbol: '',
    proxy: '0xb1bD0a759AD9b47C1E9813B75877A503FcD95a3D',
    targetProfile: '0x8D71cE18088c687502B8F8477a2B7892b6Aac0AC',
    supplyCap: 42,
    image: '',
    description: '',
    chainId: 4201,
    mintGate: '0x7592d3A04c9BfE0eDf05630ca183B22Bd1D2D811',
    enabled: true,
    metadataUri: 'ipfs://QmTkzLEWs9P4Eh8r5m4NeWeVAL7wgopgtsVCkYFx7BZrvj',
  },
];

// ─── Chains ───
export const CHAINS: Record<number, { name: string; rpc: string; explorer: string }> = {
  4201: {
    name: 'LUKSO Testnet',
    rpc: 'https://rpc.testnet.lukso.network',
    explorer: 'https://explorer.execution.testnet.lukso.network',
  },
  42: {
    name: 'LUKSO',
    rpc: 'https://rpc.mainnet.lukso.network',
    explorer: 'https://explorer.execution.mainnet.lukso.network',
  },
};

// ─── Constants ───
export const LSP26_ADDRESS = '0xf01103E5a9909Fc0DBe8166dA7085e0285daDDcA';

export const LSP26_ABI = [
  'function follow(address addr) external',
  'function unfollow(address addr) external',
  'function isFollowing(address follower, address addr) view returns (bool)',
  'function followerCount(address addr) view returns (uint256)',
  'function followingCount(address addr) view returns (uint256)',
];

export const UP_ABI = [
  'function execute(uint256 operation, address target, uint256 value, bytes data) payable returns (bytes)',
  'function owner() view returns (address)',
];

// ─── Selectors ───
export const SELECTORS = {
  getData: '0x54f6127f',
  totalSupply: '0x18160ddd',
  balanceOf: '0x70a08231',
  isMintable: '0x46b45af7',
  owner: '0x8da5cb5b',
  mintGate: '0xe5c2d4ca',
  isFollowing: '0x99ec3a42',
  execute: '0x44c028fe',
} as const;
