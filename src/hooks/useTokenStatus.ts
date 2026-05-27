'use client';

import { useState, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ethers } from 'ethers';
import { TokenConfig, lsp26Address, CHAINS } from '@/config/tokens';
import { useTxContext } from '../providers/TxContext';

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
  /** @deprecated Replaced by extension-based conditions */
  mintGate: `0x${string}`;
  /** @deprecated Replaced by extension-based conditions */
  holdGate: `0x${string}`;
  /** @deprecated Replaced by new conditionsLocked fields */
  isMintGateLocked: boolean;
  /** @deprecated Replaced by new conditionsLocked fields */
  isHoldGateLocked: boolean;
  owner: `0x${string}`;
  pendingOwner: `0x${string}`;
  transferLockStart: bigint;
  transferLockEnd: bigint;
  transferLockEnabled: boolean;
  /** Mint conditions locked (irreversible) */
  mintConditionsLocked: boolean;
  /** Hold conditions locked (irreversible) */
  holdConditionsLocked: boolean;
  /** Number of mint extension contracts */
  mintExtensionCount: number;
  /** Number of hold extension contracts */
  holdExtensionCount: number;
  /** Number of active mint condition rule groups */
  mintRuleCount: number;
  /** Number of active hold condition rule groups */
  holdRuleCount: number;
  /** Full mint condition settings for owner editing */
  mintConditions: TokenConditions;
  /** Full hold condition settings for owner editing */
  holdConditions: TokenConditions;
  /** Result of canCallerMint(userAddress); true when wallet is not connected */
  isMintableByConditions: boolean;
  canMint: boolean;
  isLoading: boolean;
  isUserDataReady: boolean;
  isFetching: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export interface ERC725YCondition {
  dataKey: string;
  minCount: string;
}

export interface TokenRequirement {
  token: string;
  minAmount: string;
  specificTokenId: string;
}

export interface TokenConditions {
  followTargets: string[];
  minBalance: string;
  minFollowing: string;
  minFollowers: string;
  erc725y: ERC725YCondition[];
  tokenReqs: TokenRequirement[];
  followUseOr: boolean;
  erc725yUseOr: boolean;
  tokenReqsUseOr: boolean;
  useOr: boolean;
  locked: boolean;
}

interface ServerData {
  totalSupply: bigint;
  supplyCap: bigint;
  isMintable: boolean;
  mintingDisabled: boolean;
  isSoulbound: boolean;
  isTransferable: boolean;
  revokable: boolean;
  balanceCap: bigint;
  isSupplyCapLocked: boolean;
  owner: `0x${string}`;
  pendingOwner: `0x${string}`;
  mintConditionsLocked: boolean;
  holdConditionsLocked: boolean;
  mintExtensionCount: number;
  holdExtensionCount: number;
  mintRuleCount: number;
  holdRuleCount: number;
  mintConditions: TokenConditions;
  holdConditions: TokenConditions;
}

const ZERO = '0x0000000000000000000000000000000000000000' as const;

const TOKEN_ABI = [
  'function totalSupply() view returns (uint256)',
  'function isMintable() view returns (bool)',
  'function mintingDisabled() view returns (bool)',
  'function isSoulbound() view returns (bool)',
  'function isTransferable() view returns (bool)',
  'function revokable() view returns (bool)',
  'function flexibleSupplyCap() view returns (uint256)',
  'function tokenBalanceCap() view returns (uint256)',
  'function isSupplyCapLocked() view returns (bool)',
  'function owner() view returns (address)',
  'function pendingOwner() view returns (address)',
  'function balanceOf(address) view returns (uint256)',
  'function canCallerMint(address) view returns (bool)',
  'function getMintConditions() view returns (uint256,uint256,uint256,uint256,uint256,uint256,bool,bool,bool,bool,bool,uint256)',
  'function getHoldConditions() view returns (uint256,uint256,uint256,uint256,uint256,uint256,bool,bool,bool,bool,bool,uint256)',
  'function mintFollowTarget(uint256) view returns (address)',
  'function holdFollowTarget(uint256) view returns (address)',
  'function mintERC725YCondition(uint256) view returns (bytes32,uint256)',
  'function holdERC725YCondition(uint256) view returns (bytes32,uint256)',
  'function mintTokenReq(uint256) view returns (address,uint256,bytes32)',
  'function holdTokenReq(uint256) view returns (address,uint256,bytes32)',
];

const EMPTY_CONDITIONS: TokenConditions = {
  followTargets: [],
  minBalance: '0',
  minFollowing: '0',
  minFollowers: '0',
  erc725y: [],
  tokenReqs: [],
  followUseOr: false,
  erc725yUseOr: false,
  tokenReqsUseOr: false,
  useOr: false,
  locked: false,
};

const SERVER_DEFAULTS: ServerData = {
  totalSupply: 0n,
  supplyCap: 0n,
  isMintable: false,
  mintingDisabled: false,
  isSoulbound: true,
  isTransferable: true,
  revokable: false,
  balanceCap: 0n,
  isSupplyCapLocked: false,
  owner: ZERO,
  pendingOwner: ZERO,
  mintConditionsLocked: false,
  holdConditionsLocked: false,
  mintExtensionCount: 0,
  holdExtensionCount: 0,
  mintRuleCount: 0,
  holdRuleCount: 0,
  mintConditions: EMPTY_CONDITIONS,
  holdConditions: EMPTY_CONDITIONS,
};

function countConditionRules(conds: unknown[]): number {
  const countIndexes = [0, 1, 2, 3, 4, 5, 11];
  return countIndexes.reduce((total, index) => {
    const value = conds[index];
    return total + (typeof value === 'bigint' && value > 0n ? 1 : 0);
  }, 0);
}

function asBigint(value: unknown): bigint {
  return typeof value === 'bigint' ? value : 0n;
}

function asBool(value: unknown): boolean {
  return typeof value === 'boolean' ? value : false;
}

async function readConditionDetails(
  c: ethers.Contract,
  mode: 'mint' | 'hold',
  conds: unknown[],
): Promise<TokenConditions> {
  const [
    followTargetsCount,
    minBalance,
    minFollowing,
    minFollowers,
    erc725yCount,
    tokenReqCount,
    followUseOr,
    erc725yUseOr,
    tokenReqsUseOr,
    useOr,
    locked,
  ] = conds;

  const followGetter = mode === 'mint' ? 'mintFollowTarget' : 'holdFollowTarget';
  const erc725yGetter = mode === 'mint' ? 'mintERC725YCondition' : 'holdERC725YCondition';
  const tokenReqGetter = mode === 'mint' ? 'mintTokenReq' : 'holdTokenReq';

  const followTargets = await Promise.all(
    Array.from({ length: Number(asBigint(followTargetsCount)) }, async (_, i) => {
      const value = await c[followGetter](i).catch(() => ZERO);
      return value === ZERO ? '' : ethers.getAddress(value);
    }),
  );

  const erc725y = await Promise.all(
    Array.from({ length: Number(asBigint(erc725yCount)) }, async (_, i) => {
      const value = await c[erc725yGetter](i).catch(() => null);
      if (!value) return null;
      const [dataKey, minCount] = value as [string, bigint];
      return { dataKey, minCount: minCount.toString() };
    }),
  );

  const tokenReqs = await Promise.all(
    Array.from({ length: Number(asBigint(tokenReqCount)) }, async (_, i) => {
      const value = await c[tokenReqGetter](i).catch(() => null);
      if (!value) return null;
      const [token, minAmount, specificTokenId] = value as [string, bigint, string];
      return { token: ethers.getAddress(token), minAmount: minAmount.toString(), specificTokenId };
    }),
  );

  return {
    followTargets: followTargets.filter(Boolean),
    minBalance: asBigint(minBalance).toString(),
    minFollowing: asBigint(minFollowing).toString(),
    minFollowers: asBigint(minFollowers).toString(),
    erc725y: erc725y.filter((v): v is ERC725YCondition => v !== null),
    tokenReqs: tokenReqs.filter((v): v is TokenRequirement => v !== null),
    followUseOr: asBool(followUseOr),
    erc725yUseOr: asBool(erc725yUseOr),
    tokenReqsUseOr: asBool(tokenReqsUseOr),
    useOr: asBool(useOr),
    locked: asBool(locked),
  };
}

// ─── Server data: token-level state (no user dependency) ───

async function fetchServerData(token: TokenConfig): Promise<ServerData> {
  const chain = CHAINS[token.chainId];
  if (!chain) throw new Error('Unsupported chain');
  const p = new ethers.JsonRpcProvider(chain.rpc);
  const c = new ethers.Contract(token.proxy, TOKEN_ABI, p);

  const [ts, im, md, isb, isTr, rev, fsc, tbc, iscf, own, po, mc, hc] = await Promise.all([
    c.totalSupply().catch(() => 0n),
    c.isMintable().catch(() => false),
    c.mintingDisabled().catch(() => false),
    c.isSoulbound().catch(() => true),
    c.isTransferable().catch(() => true),
    c.revokable().catch(() => false),
    c.flexibleSupplyCap().catch(() => 0n),
    c.tokenBalanceCap().catch(() => 0n),
    c.isSupplyCapLocked().catch(() => false),
    c.owner().catch(() => ZERO),
    c.pendingOwner().catch(() => ZERO),
    // getMintConditions() → [followTargetsCount, minBalance, minFollowing, minFollowers, erc725yCount, tokenReqCount, followUseOr, erc725yUseOr, tokenReqsUseOr, useOr, locked, extensionCount]
    c.getMintConditions().catch(() => [0n, 0n, 0n, 0n, 0n, 0n, false, false, false, false, false, 0n]),
    // getHoldConditions() → same structure
    c.getHoldConditions().catch(() => [0n, 0n, 0n, 0n, 0n, 0n, false, false, false, false, false, 0n]),
  ]);

  const mintConds = mc as unknown[];
  const holdConds = hc as unknown[];
  const [mintConditions, holdConditions] = await Promise.all([
    readConditionDetails(c, 'mint', mintConds).catch(() => ({
      ...EMPTY_CONDITIONS,
      minBalance: asBigint(mintConds[1]).toString(),
      minFollowing: asBigint(mintConds[2]).toString(),
      minFollowers: asBigint(mintConds[3]).toString(),
      followUseOr: asBool(mintConds[6]),
      erc725yUseOr: asBool(mintConds[7]),
      tokenReqsUseOr: asBool(mintConds[8]),
      useOr: asBool(mintConds[9]),
      locked: asBool(mintConds[10]),
    })),
    readConditionDetails(c, 'hold', holdConds).catch(() => ({
      ...EMPTY_CONDITIONS,
      minBalance: asBigint(holdConds[1]).toString(),
      minFollowing: asBigint(holdConds[2]).toString(),
      minFollowers: asBigint(holdConds[3]).toString(),
      followUseOr: asBool(holdConds[6]),
      erc725yUseOr: asBool(holdConds[7]),
      tokenReqsUseOr: asBool(holdConds[8]),
      useOr: asBool(holdConds[9]),
      locked: asBool(holdConds[10]),
    })),
  ]);

  return {
    totalSupply: ts as bigint,
    supplyCap: fsc as bigint,
    isMintable: !!im,
    mintingDisabled: !!md,
    isSoulbound: !!isb,
    isTransferable: !!isTr,
    revokable: !!rev,
    balanceCap: tbc as bigint,
    isSupplyCapLocked: !!iscf,
    owner: ethers.getAddress(own) as `0x${string}`,
    pendingOwner: ethers.getAddress(po) as `0x${string}`,
    mintConditionsLocked: !!mintConds[10],
    holdConditionsLocked: !!holdConds[10],
    mintExtensionCount: Number(mintConds[11]),
    holdExtensionCount: Number(holdConds[11]),
    mintRuleCount: countConditionRules(mintConds),
    holdRuleCount: countConditionRules(holdConds),
    mintConditions,
    holdConditions,
  };
}

// ─── Hook ────────────────────────────────────────────────

/**
 * useTokenStatus — token-level server data + user balance cache
 */
export function useTokenStatus(
  token: TokenConfig | null,
  userAddress: `0x${string}` | null
): TokenStatus {
  // Tier 1: Token-level server data (stable key — no userAddress dependency)
  const serverQuery = useQuery({
    queryKey: ['token-server', token?.proxy, token?.chainId],
    queryFn: () => fetchServerData(token!),
    enabled: !!token,
  });
  const server: ServerData = serverQuery.data ?? SERVER_DEFAULTS;

  // Tier 2: User balance (re-fetches when userAddress changes)
  const balanceQuery = useQuery({
    queryKey: ['token-balance', token?.proxy, token?.chainId, userAddress],
    queryFn: () => fetchUserBalance(token!, userAddress!),
    enabled: !!token && !!userAddress,
  });
  const userBalance = balanceQuery.data ?? 0n;

  // Tier 3: User-specific condition check. Default true when disconnected.
  const canMintQuery = useQuery({
    queryKey: ['token-can-mint', token?.proxy, token?.chainId, userAddress],
    queryFn: () => fetchCanCallerMint(token!, userAddress!),
    enabled: !!token && !!userAddress,
  });
  const isMintableByConditions = userAddress ? (canMintQuery.data ?? false) : true;

  // ─── Stable refetch — useCallback so it doesn't recreate on every isFetching toggle ───
  const refetch = useCallback(async () => {
    const queries: Promise<unknown>[] = [
      serverQuery.refetch(),
      balanceQuery.refetch(),
    ];
    if (token && userAddress) queries.push(canMintQuery.refetch());
    await Promise.all(queries);
  }, [serverQuery.refetch, balanceQuery.refetch, canMintQuery.refetch, token, userAddress]);

  // ─── Merge all tiers into single TokenStatus ───
  const merged: TokenStatus = useMemo(() => ({
    ...server,
    // Legacy gate fields — always zero for new impl (no external gates)
    mintGate: ZERO,
    holdGate: ZERO,
    isMintGateLocked: server.mintConditionsLocked,
    isHoldGateLocked: server.holdConditionsLocked,
    userBalance,
    isMintableByConditions,
    isFollowing: false,
    // Transfer lock fields — not directly readable in new impl, default to false
    transferLockStart: 0n,
    transferLockEnd: 0n,
    transferLockEnabled: false,
    canMint:
      server.isMintable &&
      !server.mintingDisabled &&
      (server.balanceCap === 0n || userBalance < server.balanceCap) &&
      (server.supplyCap === 0n || server.totalSupply < server.supplyCap) &&
      isMintableByConditions,
    isLoading: serverQuery.isLoading,
    isUserDataReady: !balanceQuery.isLoading,
    isFetching:
      serverQuery.isFetching || balanceQuery.isFetching || canMintQuery.isFetching,
    error:
      serverQuery.error?.message ??
      balanceQuery.error?.message ??
      canMintQuery.error?.message ??
      null,
    refetch,
  }), [server, userBalance, serverQuery.isLoading, serverQuery.isFetching,
      balanceQuery.isFetching, balanceQuery.isLoading, serverQuery.error,
      balanceQuery.error, canMintQuery.isFetching, canMintQuery.error,
      isMintableByConditions, refetch]);

  return merged;
}

// ─── Separate tiny fetchers for query isolation ───

async function fetchUserBalance(token: TokenConfig, userAddress: string): Promise<bigint> {
  const chain = CHAINS[token.chainId];
  if (!chain) return 0n;
  const p = new ethers.JsonRpcProvider(chain.rpc);
  const c = new ethers.Contract(token.proxy, TOKEN_ABI, p);
  const [bal] = await Promise.all([c.balanceOf(userAddress).catch(() => 0n)]);
  return bal as bigint;
}

async function fetchCanCallerMint(token: TokenConfig, userAddress: string): Promise<boolean> {
  const chain = CHAINS[token.chainId];
  if (!chain) return false;
  const p = new ethers.JsonRpcProvider(chain.rpc);
  const c = new ethers.Contract(token.proxy, TOKEN_ABI, p);
  return !!(await c.canCallerMint(userAddress).catch(() => false));
}

// ─── Mint ────────────────────────────────────────────────

export function useMint(
  token: TokenConfig | null,
  userAddress: `0x${string}` | null,
  onDone?: () => void
) {
  const { sendTx } = useTxContext();
  const [isPending, setIsPending] = useState(false);

  const mint = useCallback(async () => {
    if (!token || !userAddress) return;
    setIsPending(true);
    try {
      const mintIface = new ethers.Interface([
        'function mint(address,uint256,bool,bytes)',
      ]);
      const innerData = mintIface.encodeFunctionData('mint', [
        userAddress, BigInt(1), false, '0x',
      ]);
      await sendTx('Minting NFT', token.proxy, innerData, token.chainId);
      onDone?.();
    } catch {
      // sendTx writes failure to global TxContext
    } finally {
      setIsPending(false);
    }
  }, [token, userAddress, sendTx, onDone]);

  return { mint, isPending };
}

// ─── Burn ────────────────────────────────────────────────

export function useBurn(
  token: TokenConfig | null,
  userAddress: `0x${string}` | null,
  onDone?: () => void
) {
  const { sendTx } = useTxContext();
  const [isPending, setIsPending] = useState(false);

  const burn = useCallback(async (amount: number = 1) => {
    if (!token || !userAddress || amount <= 0) return;
    setIsPending(true);
    try {
      const burnIface = new ethers.Interface([
        'function burn(address,uint256,bytes)',
      ]);
      const innerData = burnIface.encodeFunctionData('burn', [
        userAddress, BigInt(amount), '0x',
      ]);
      await sendTx(`Burning ${amount} Token${amount > 1 ? 's' : ''}`, token.proxy, innerData, token.chainId);
      onDone?.();
    } catch {
      // sendTx writes failure to global TxContext
    } finally {
      setIsPending(false);
    }
  }, [token, userAddress, sendTx, onDone]);

  return { burn, isPending };
}

// ─── Follow ──────────────────────────────────────────────

export function useFollow(
  userAddress: `0x${string}` | null,
  targetProfile: `0x${string}` | null,
  chainId: number,
  onDone?: () => void
) {
  const { sendTx } = useTxContext();
  const [isPending, setIsPending] = useState(false);

  const follow = useCallback(async () => {
    if (!userAddress || !targetProfile) return;
    setIsPending(true);
    try {
      const regIface = new ethers.Interface(['function follow(address addr) external']);
      const innerData = regIface.encodeFunctionData('follow', [targetProfile]);
      await sendTx('Following Profile', lsp26Address(chainId), innerData, chainId);
      onDone?.();
    } catch {
      // sendTx writes failure to global TxContext
    } finally {
      setIsPending(false);
    }
  }, [userAddress, targetProfile, chainId, sendTx, onDone]);

  return { follow, isPending };
}
