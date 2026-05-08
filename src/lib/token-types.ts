import { ethers } from 'ethers';

export interface TokenStatus {
  totalSupply: bigint;
  supplyCap: bigint;
  userBalance: bigint;
  isMintable: boolean;
  mintingDisabled: boolean;
  isSoulbound: boolean;
  isTransferable: boolean;
  revokable: boolean;
  balanceCap: bigint;
  isSupplyCapLocked: boolean;
  isFollowing: boolean;
  mintGate: `0x${string}`;
  holdGate: `0x${string}`;
  isMintGateLocked: boolean;
  isHoldGateLocked: boolean;
  owner: `0x${string}`;
  transferLockStart: bigint;
  transferLockEnd: bigint;
  transferLockEnabled: boolean;
  canMint: boolean;
  isLoading: boolean;
  isUserDataReady: boolean;
  isFetching: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export interface ServerData {
  totalSupply: bigint;
  supplyCap: bigint;
  isMintable: boolean;
  mintingDisabled: boolean;
  isSoulbound: boolean;
  isTransferable: boolean;
  revokable: boolean;
  balanceCap: bigint;
  isSupplyCapLocked: boolean;
  mintGate: `0x${string}`;
  holdGate: `0x${string}`;
  isMintGateLocked: boolean;
  isHoldGateLocked: boolean;
  owner: `0x${string}`;
  transferLockStart: bigint;
  transferLockEnd: bigint;
  transferLockEnabled: boolean;
}

export interface OnChainTokenData {
  name: string;
  symbol: string;
  description: string;
  image: string;
  isLoading: boolean;
  error: string | null;
}

export const DEFAULT_GATE = '0x0000000000000000000000000000000000000000' as const;

export const TOKEN_ABI = [
  'function totalSupply() view returns (uint256)',
  'function isMintable() view returns (bool)',
  'function mintingDisabled() view returns (bool)',
  'function isSoulbound() view returns (bool)',
  'function isTransferable() view returns (bool)',
  'function revokable() view returns (bool)',
  'function flexibleSupplyCap() view returns (uint256)',
  'function tokenBalanceCap() view returns (uint256)',
  'function isSupplyCapLocked() view returns (bool)',
  'function mintGate() view returns (address)',
  'function owner() view returns (address)',
  'function balanceOf(address) view returns (uint256)',
  'function holdGate() view returns (address)',
  'function isMintGateLocked() view returns (bool)',
  'function isHoldGateLocked() view returns (bool)',
  'function transferLockStart() view returns (uint256)',
  'function transferLockEnd() view returns (uint256)',
  'function transferLockEnabled() view returns (bool)',
];

export const GATE_ABI = [
  'function gateType() view returns (string)',
  'function check(address user) view returns (bool, string, string)',
  'function canMint(address caller, address to, uint256 amount) view returns (bool)',
];

export const SERVER_DEFAULTS: ServerData = {
  totalSupply: 0n,
  supplyCap: 0n,
  isMintable: false,
  mintingDisabled: false,
  isSoulbound: true,
  isTransferable: true,
  revokable: false,
  balanceCap: 0n,
  isSupplyCapLocked: false,
  mintGate: DEFAULT_GATE,
  holdGate: DEFAULT_GATE,
  isMintGateLocked: false,
  isHoldGateLocked: false,
  owner: DEFAULT_GATE,
  transferLockStart: 0n,
  transferLockEnd: 0n,
  transferLockEnabled: false,
};
