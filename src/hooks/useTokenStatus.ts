'use client';

import { useState, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ethers } from 'ethers';
import { TokenConfig, LSP26_ADDRESS, GATE_ABI, UP_ABI, CHAINS } from '@/config/tokens';
import { EIP1193Provider } from '../providers/UpProvider';
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
  canMint: boolean;
  isLoading: boolean;
  isUserDataReady: boolean;
  isFetching: boolean;
  error: string | null;
  refetch: () => Promise<void>;
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
  'function getMintConditions() view returns (uint256,uint256,uint256,uint256,uint256,uint256,bool,bool,bool,bool,bool,uint256)',
  'function getHoldConditions() view returns (uint256,uint256,uint256,uint256,uint256,uint256,bool,bool,bool,bool,bool,uint256)',
];

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
};

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
    // getMintConditions() → [followTargetsCount, minBal, minFol, minFolCount, erc725yCount, tokenReqCount, followUseOr, erc725yUseOr, tokenReqsUseOr, useOr, locked, extensionCount]
    c.getMintConditions().catch(() => [0n, 0n, 0n, 0n, 0n, 0n, false, false, false, false, false, 0n]),
    // getHoldConditions() → same structure
    c.getHoldConditions().catch(() => [0n, 0n, 0n, 0n, 0n, 0n, false, false, false, false, false, 0n]),
  ]);

  const mintConds = mc as unknown[];
  const holdConds = hc as unknown[];

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
  };
}

// ─── Hook ────────────────────────────────────────────────

/**
 * useTokenStatus — token + user data with 3-tier caching
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

  // ─── Stable refetch — useCallback so it doesn't recreate on every isFetching toggle ───
  const refetch = useCallback(async () => {
    await Promise.all([
      serverQuery.refetch(),
      balanceQuery.refetch(),
    ]);
  }, [serverQuery.refetch, balanceQuery.refetch]);

  // ─── Merge all tiers into single TokenStatus ───
  const merged: TokenStatus = useMemo(() => ({
    ...server,
    // Legacy gate fields — always zero for new impl (no external gates)
    mintGate: ZERO,
    holdGate: ZERO,
    isMintGateLocked: server.mintConditionsLocked,
    isHoldGateLocked: server.holdConditionsLocked,
    userBalance,
    isFollowing: false,
    // Transfer lock fields — not directly readable in new impl, default to false
    transferLockStart: 0n,
    transferLockEnd: 0n,
    transferLockEnabled: false,
    canMint:
      server.isMintable &&
      !server.mintingDisabled &&
      (server.balanceCap === 0n || userBalance < server.balanceCap) &&
      (server.supplyCap === 0n || server.totalSupply < server.supplyCap),
    isLoading: serverQuery.isLoading,
    isUserDataReady: !balanceQuery.isLoading,
    isFetching:
      serverQuery.isFetching || balanceQuery.isFetching,
    error:
      serverQuery.error?.message ??
      balanceQuery.error?.message ??
      null,
    refetch,
  }), [server, userBalance, serverQuery.isLoading, serverQuery.isFetching,
      balanceQuery.isFetching, balanceQuery.isLoading, serverQuery.error,
      balanceQuery.error, refetch]);

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
      await sendTx('Following Profile', LSP26_ADDRESS, innerData, chainId);
      onDone?.();
    } catch {
      // sendTx writes failure to global TxContext
    } finally {
      setIsPending(false);
    }
  }, [userAddress, targetProfile, chainId, sendTx, onDone]);

  return { follow, isPending };
}
