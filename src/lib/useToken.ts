'use client';

import { useState, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ethers } from 'ethers';
import { TokenConfig, LSP26_ADDRESS, GATE_ABI, UP_ABI, CHAINS } from '@/config/tokens';
import { EIP1193Provider } from './up-provider';

export interface TokenStatus {
  totalSupply: number;
  supplyCap: number;
  userBalance: number;
  isMintable: boolean;
  mintingDisabled: boolean;
  isSoulbound: boolean;
  revokable: boolean;
  balanceCap: number;
  isSupplyCapFixed: boolean;
  isFollowing: boolean;
  mintGate: `0x${string}`;
  holdGate: `0x${string}`;
  isMintGateFixed: boolean;
  isHoldGateFixed: boolean;
  owner: `0x${string}`;
  canMint: boolean;
  isLoading: boolean;
  isUserDataReady: boolean;
  isFetching: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

interface ServerData {
  totalSupply: number;
  supplyCap: number;
  isMintable: boolean;
  mintingDisabled: boolean;
  isSoulbound: boolean;
  revokable: boolean;
  balanceCap: number;
  isSupplyCapFixed: boolean;
  mintGate: `0x${string}`;
  holdGate: `0x${string}`;
  isMintGateFixed: boolean;
  isHoldGateFixed: boolean;
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
  'function isSupplyCapFixed() view returns (bool)',
  'function mintGate() view returns (address)',
  'function owner() view returns (address)',
  'function balanceOf(address) view returns (uint256)',
  'function holdGate() view returns (address)',
  'function isMintGateFixed() view returns (bool)',
  'function isHoldGateFixed() view returns (bool)',
];

const DEFAULT_GATE = '0x0000000000000000000000000000000000000000' as const;

const SERVER_DEFAULTS: ServerData = {
  totalSupply: 0,
  supplyCap: 0,
  isMintable: false,
  mintingDisabled: false,
  isSoulbound: true,
  revokable: false,
  balanceCap: 0,
  isSupplyCapFixed: false,
  mintGate: DEFAULT_GATE,
  holdGate: DEFAULT_GATE,
  isMintGateFixed: false,
  isHoldGateFixed: false,
  owner: DEFAULT_GATE,
};

// ─── Server data: token-level state (no user dependency) ───

async function fetchServerData(token: TokenConfig): Promise<ServerData> {
  const chain = CHAINS[token.chainId];
  if (!chain) throw new Error('Unsupported chain');
  const p = new ethers.JsonRpcProvider(chain.rpc);
  const c = new ethers.Contract(token.proxy, TOKEN_ABI, p);

  const [ts, im, md, isb, rev, fsc, tbc, iscf, mg, hg, mgf, hgf, own] = await Promise.all([
    c.totalSupply().catch(() => 0),
    c.isMintable().catch(() => false),
    c.mintingDisabled().catch(() => false),
    c.isSoulbound().catch(() => true),
    c.revokable().catch(() => false),
    c.flexibleSupplyCap().catch(() => 0),
    c.tokenBalanceCap().catch(() => 0),
    c.isSupplyCapFixed().catch(() => false),
    c.mintGate().catch(() => DEFAULT_GATE),
    c.holdGate().catch(() => DEFAULT_GATE),
    c.isMintGateFixed().catch(() => false),
    c.isHoldGateFixed().catch(() => false),
    c.owner().catch(() => DEFAULT_GATE),
  ]);

  return {
    totalSupply: Number(ts),
    supplyCap: Number(fsc) || Infinity,
    isMintable: !!im,
    mintingDisabled: !!md,
    isSoulbound: !!isb,
    revokable: !!rev,
    balanceCap: Number(tbc),
    isSupplyCapFixed: !!iscf,
    mintGate: ethers.getAddress(mg) as `0x${string}`,
    holdGate: ethers.getAddress(hg) as `0x${string}`,
    isMintGateFixed: !!mgf,
    isHoldGateFixed: !!hgf,
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
  const userBalance = balanceQuery.data ?? 0;

  // Tier 3: Gate permissions (depends on server mintGate + userAddress)
  const gateQuery = useQuery({
    queryKey: ['token-gate', server.mintGate, token?.chainId, userAddress],
    queryFn: () => fetchGateCanMint(server.mintGate, userAddress!, token!.chainId),
    enabled: !!token && !!userAddress && server.mintGate !== DEFAULT_GATE,
  });
  const canMintViaGate = gateQuery.data ?? true;

  // ─── Merge all tiers into single TokenStatus ───
  const merged: TokenStatus = useMemo(() => ({
    ...server,
    userBalance,
    isFollowing: false,
    canMint:
      server.isMintable &&
      !server.mintingDisabled &&
      canMintViaGate &&
      (server.balanceCap === 0 || userBalance < server.balanceCap) &&
      server.totalSupply < server.supplyCap,
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

async function fetchUserBalance(token: TokenConfig, userAddress: string): Promise<number> {
  const chain = CHAINS[token.chainId];
  if (!chain) return 0;
  const p = new ethers.JsonRpcProvider(chain.rpc);
  const c = new ethers.Contract(token.proxy, TOKEN_ABI, p);
  const [bal] = await Promise.all([c.balanceOf(userAddress).catch(() => 0)]);
  return Number(bal);
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
  provider: EIP1193Provider | null,
  onDone?: () => void
) {
  const [isMinting, setIsMinting] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mint = useCallback(async () => {
    if (!token || !userAddress || !provider) { setError('Not connected'); return; }
    setIsMinting(true); setError(null); setTxHash(null);
    try {
      const mintIface = new ethers.Interface(['function mint(address,uint256,bool,bytes)']);
      const mintData = mintIface.encodeFunctionData('mint', [
        userAddress, BigInt(1), false, '0x',
      ]);
      const upIface = new ethers.Interface(UP_ABI);
      const execData = upIface.encodeFunctionData('execute', [
        BigInt(0), token.proxy, BigInt(0), mintData,
      ]);
      const txHashRaw = await provider.request({
        method: 'eth_sendTransaction',
        params: [{ from: userAddress, to: userAddress, data: execData }],
      });
      setTxHash(txHashRaw as string);

      const chain = CHAINS[token.chainId];
      if (chain) {
        const p = new ethers.JsonRpcProvider(chain.rpc);
        await p.waitForTransaction(txHashRaw as string, 1, 60_000);
      }

      onDone?.();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Mint failed');
    } finally {
      setIsMinting(false);
    }
  }, [token, userAddress, provider, onDone]);

  return { mint, isMinting, txHash, error };
}

// ─── Follow ──────────────────────────────────────────────

export function useFollow(
  userAddress: `0x${string}` | null,
  provider: EIP1193Provider | null,
  targetProfile: `0x${string}` | null,
  onDone?: () => void
) {
  const [isFollowing, setIsFollowing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const follow = useCallback(async () => {
    if (!userAddress || !provider || !targetProfile) { setError('Not ready'); return; }
    setIsFollowing(true); setError(null);
    try {
      const regIface = new ethers.Interface(['function follow(address addr) external']);
      const folData = regIface.encodeFunctionData('follow', [targetProfile]);
      const upIface = new ethers.Interface(UP_ABI);
      const execData = upIface.encodeFunctionData('execute', [
        BigInt(0), LSP26_ADDRESS, BigInt(0), folData,
      ]);
      const txHashRaw = await provider.request({
        method: 'eth_sendTransaction',
        params: [{ from: userAddress, to: userAddress, data: execData }],
      });

      if (targetProfile) {
        const chain = CHAINS[42]; // Follow is always mainnet
        const p = new ethers.JsonRpcProvider(chain.rpc);
        await p.waitForTransaction(txHashRaw as string, 1, 60_000);
      }

      onDone?.();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Follow failed');
    } finally {
      setIsFollowing(false);
    }
  }, [userAddress, provider, targetProfile, onDone]);

  return { follow, isFollowing, error };
}
