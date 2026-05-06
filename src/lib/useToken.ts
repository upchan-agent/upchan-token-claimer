'use client';

import { useState, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ethers } from 'ethers';
import { TokenConfig, LSP26_ADDRESS, GATE_ABI, UP_ABI, CHAINS } from '@/config/tokens';
import { EIP1193Provider } from './up-provider';
import { useTxContext } from './tx-context';

export interface TokenStatus {
  totalSupply: bigint;
  supplyCap: bigint;
  userBalance: bigint;
  isMintable: boolean;
  mintingDisabled: boolean;
  isSoulbound: boolean;
  revokable: boolean;
  balanceCap: bigint;
  isSupplyCapLocked: boolean;
  isFollowing: boolean;
  mintGate: `0x${string}`;
  holdGate: `0x${string}`;
  isMintGateLocked: boolean;
  isHoldGateLocked: boolean;
  owner: `0x${string}`;
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
  revokable: boolean;
  balanceCap: bigint;
  isSupplyCapLocked: boolean;
  mintGate: `0x${string}`;
  holdGate: `0x${string}`;
  isMintGateLocked: boolean;
  isHoldGateLocked: boolean;
  owner: `0x${string}`;
}

const TOKEN_ABI = [
  'function totalSupply() view returns (uint256)',
  'function isMintable() view returns (bool)',
  'function mintingDisabled() view returns (bool)',
  'function isSoulbound() view returns (bool)',
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
];

const DEFAULT_GATE = '0x0000000000000000000000000000000000000000' as const;

const SERVER_DEFAULTS: ServerData = {
  totalSupply: 0n,
  supplyCap: 0n,
  isMintable: false,
  mintingDisabled: false,
  isSoulbound: true,
  revokable: false,
  balanceCap: 0n,
  isSupplyCapLocked: false,
  mintGate: DEFAULT_GATE,
  holdGate: DEFAULT_GATE,
  isMintGateLocked: false,
  isHoldGateLocked: false,
  owner: DEFAULT_GATE,
};

// ─── Server data: token-level state (no user dependency) ───

async function fetchServerData(token: TokenConfig): Promise<ServerData> {
  const chain = CHAINS[token.chainId];
  if (!chain) throw new Error('Unsupported chain');
  const p = new ethers.JsonRpcProvider(chain.rpc);
  const c = new ethers.Contract(token.proxy, TOKEN_ABI, p);

  const [ts, im, md, isb, rev, fsc, tbc, iscf, mg, hg, mgf, hgf, own] = await Promise.all([
    c.totalSupply().catch(() => 0n),
    c.isMintable().catch(() => false),
    c.mintingDisabled().catch(() => false),
    c.isSoulbound().catch(() => true),
    c.revokable().catch(() => false),
    c.flexibleSupplyCap().catch(() => 0n),
    c.tokenBalanceCap().catch(() => 0n),
    c.isSupplyCapLocked().catch(() => false),
    c.mintGate().catch(() => DEFAULT_GATE),
    c.holdGate().catch(() => DEFAULT_GATE),
    c.isMintGateLocked().catch(() => false),
    c.isHoldGateLocked().catch(() => false),
    c.owner().catch(() => DEFAULT_GATE),
  ]);

  return {
    totalSupply: ts as bigint,
    supplyCap: fsc as bigint,
    isMintable: !!im,
    mintingDisabled: !!md,
    isSoulbound: !!isb,
    revokable: !!rev,
    balanceCap: tbc as bigint,
    isSupplyCapLocked: !!iscf,
    mintGate: ethers.getAddress(mg) as `0x${string}`,
    holdGate: ethers.getAddress(hg) as `0x${string}`,
    isMintGateLocked: !!mgf,
    isHoldGateLocked: !!hgf,
    owner: ethers.getAddress(own) as `0x${string}`,
  };
}

// ─── Hook ────────────────────────────────────────────────

/**
 * useTokenStatus — token + user data with 3-tier caching:
 *
 * 1. Server query (['token-server', proxy, chainId]):
 *    Token-level state — re-fetched only when token changes
 *
 * 2. Balance query (['token-balance', proxy, chainId, userAddress]):
 *    User-specific balance — re-fetched when userAddress changes
 *
 * 3. Gate query (['token-gate', mintGate, userAddress, chainId]):
 *    Gate permission check — depends on server data, re-enabled when user changes
 *
 * Result: wallet connect/disconnect does NOT re-fetch token-level data.
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

  // Tier 3: Gate permissions (depends on server mintGate + userAddress)
  const gateQuery = useQuery({
    queryKey: ['token-gate', server.mintGate, token?.chainId, userAddress],
    queryFn: () => fetchGateCanMint(server.mintGate, userAddress!, token!.chainId),
    enabled: !!token && !!userAddress && server.mintGate !== DEFAULT_GATE,
  });
  const canMintViaGate = server.mintGate === DEFAULT_GATE ? true : (gateQuery.data ?? false);

  // ─── Merge all tiers into single TokenStatus ───
  const merged: TokenStatus = useMemo(() => ({
    ...server,
    userBalance,
    isFollowing: false,
    canMint:
      server.isMintable &&
      !server.mintingDisabled &&
      canMintViaGate &&
      (server.balanceCap === 0n || userBalance < server.balanceCap) &&
      (server.supplyCap === 0n || server.totalSupply < server.supplyCap),
    isLoading: serverQuery.isLoading,
    isUserDataReady: !balanceQuery.isLoading && !gateQuery.isLoading,
    isFetching:
      serverQuery.isFetching || balanceQuery.isFetching || gateQuery.isFetching,
    error:
      serverQuery.error?.message ??
      balanceQuery.error?.message ??
      gateQuery.error?.message ??
      null,
    refetch: async () => {
      await Promise.all([
        serverQuery.refetch(),
        balanceQuery.refetch(),
        gateQuery.refetch(),
      ]);
    },
  }), [server, userBalance, canMintViaGate, serverQuery.isLoading, serverQuery.isFetching,
      balanceQuery.isFetching, gateQuery.isLoading, gateQuery.isFetching,
      balanceQuery.isLoading, serverQuery.error,
      balanceQuery.error, gateQuery.error, serverQuery.refetch,
      balanceQuery.refetch, gateQuery.refetch]);

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

async function fetchGateCanMint(
  mintGate: string,
  userAddress: string,
  chainId: number
): Promise<boolean> {
  try {
    const chain = CHAINS[chainId];
    if (!chain) return false;
    const p = new ethers.JsonRpcProvider(chain.rpc);
    const gateContract = new ethers.Contract(mintGate, GATE_ABI, p);
    return await gateContract.canMint(userAddress, userAddress, 1);
  } catch {
    return false;
  }
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
