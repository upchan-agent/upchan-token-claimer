'use client';

import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ethers } from 'ethers';
import { TokenConfig, SELECTORS, LSP26_ADDRESS, UP_ABI, CHAINS, getGateInfo } from '@/config/tokens';

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
  gateInfo: ReturnType<typeof getGateInfo>;
  canMint: boolean;
  isLoading: boolean;
  isFetching: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const TOKEN_ABI = [
  'function totalSupply() view returns (uint256)',
  'function isMintable() view returns (bool)',
  'function mintingDisabled() view returns (bool)',
  'function isSoulbound() view returns (bool)',
  'function revokable() view returns (bool)',
  'function tokenSupplyCap() view returns (uint256)',
  'function tokenBalanceCap() view returns (uint256)',
  'function isSupplyCapFixed() view returns (bool)',
  'function mintGate() view returns (address)',
  'function owner() view returns (address)',
  'function balanceOf(address) view returns (uint256)',
];

const DEFAULT_GATE = '0x0000000000000000000000000000000000000000' as const;

async function fetchTokenStatus(token: TokenConfig, userAddress: `0x${string}` | null) {
  const chain = CHAINS[token.chainId];
  if (!chain) throw new Error('Unsupported chain');
  const p = new ethers.JsonRpcProvider(chain.rpc);
  const c = new ethers.Contract(token.proxy, TOKEN_ABI, p);

  const [ts, im, md, isb, rev, tsc, tbc, iscf, mg] = await Promise.all([
    c.totalSupply(),
    c.isMintable(),
    c.mintingDisabled().catch(() => false),
    c.isSoulbound().catch(() => true),
    c.revokable().catch(() => false),
    c.tokenSupplyCap().catch(() => token.supplyCap),
    c.tokenBalanceCap().catch(() => 0),
    c.isSupplyCapFixed().catch(() => false),
    c.mintGate().catch(() => DEFAULT_GATE),
  ]);

  let userBalance = 0;
  let isFollowing = false;

  if (userAddress) {
    const [bal, fol] = await Promise.all([
      c.balanceOf(userAddress).catch(() => 0),
      token.targetProfile
        ? p.call({
            to: LSP26_ADDRESS,
            data: SELECTORS.isFollowing +
              userAddress.slice(2).padStart(64, '0') +
              token.targetProfile.slice(2).padStart(64, '0'),
          }).then(r => r.endsWith('1')).catch(() => false)
        : Promise.resolve(false),
    ]);
    userBalance = Number(bal);
    isFollowing = fol;
  }

  const mintGate = ethers.getAddress(mg) as `0x${string}`;
  const supplyCap = Number(tsc) || token.supplyCap || Infinity;
  const gateInfo = getGateInfo(mintGate);

  return {
    totalSupply: Number(ts),
    supplyCap,
    userBalance,
    isMintable: !!im,
    mintingDisabled: !!md,
    isSoulbound: !!isb,
    revokable: !!rev,
    balanceCap: Number(tbc),
    isSupplyCapFixed: !!iscf,
    isFollowing,
    mintGate,
    gateInfo,
    canMint: !!im && isFollowing && userBalance === 0 && Number(ts) < supplyCap,
  };
}

export function useTokenStatus(
  token: TokenConfig | null,
  userAddress: `0x${string}` | null
): TokenStatus {
  const query = useQuery({
    queryKey: ['token-status', token?.proxy, token?.chainId, userAddress],
    queryFn: () => fetchTokenStatus(token!, userAddress),
    enabled: !!token,
    staleTime: 15_000,
    placeholderData: (prev) => prev,
  });

  const defaults = {
    totalSupply: 0, supplyCap: token?.supplyCap || 0, userBalance: 0,
    isMintable: false, mintingDisabled: false,
    isSoulbound: true, revokable: false, balanceCap: 0,
    isSupplyCapFixed: false, isFollowing: false,
    mintGate: DEFAULT_GATE as `0x${string}`,
    gateInfo: getGateInfo(DEFAULT_GATE),
    canMint: false,
  };

  return {
    ...defaults,
    ...query.data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error?.message ?? null,
    refetch: () => query.refetch().then(() => {}),
  } as TokenStatus;
}

// ─── Mint ────────────────────────────────────────────────

export function useMint(
  token: TokenConfig | null,
  userAddress: `0x${string}` | null,
  provider: any,
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

      // Wait for receipt properly instead of polling
      const chain = CHAINS[token.chainId];
      if (chain) {
        const p = new ethers.JsonRpcProvider(chain.rpc);
        await p.waitForTransaction(txHashRaw as string, 1, 60_000);
      }

      onDone?.();
    } catch (e: any) {
      setError(e.message || 'Mint failed');
    } finally {
      setIsMinting(false);
    }
  }, [token, userAddress, provider, onDone]);

  return { mint, isMinting, txHash, error };
}

// ─── Follow ──────────────────────────────────────────────

export function useFollow(
  userAddress: `0x${string}` | null,
  provider: any,
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

      // Wait for receipt properly
      if (targetProfile) {
        const chain = CHAINS[42]; // Follow is always mainnet
        const p = new ethers.JsonRpcProvider(chain.rpc);
        await p.waitForTransaction(txHashRaw as string, 1, 60_000);
      }

      onDone?.();
    } catch (e: any) {
      setError(e.message || 'Follow failed');
    } finally {
      setIsFollowing(false);
    }
  }, [userAddress, provider, targetProfile, onDone]);

  return { follow, isFollowing, error };
}
