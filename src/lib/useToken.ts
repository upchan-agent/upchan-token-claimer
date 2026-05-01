'use client';

import { useState, useCallback } from 'react';
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
  'function flexibleSupplyCap() view returns (uint256)',
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

  const [ts, im, md, isb, rev, fsc, tbc, iscf, mg] = await Promise.all([
    c.totalSupply().catch(() => 0),
    c.isMintable().catch(() => false),
    c.mintingDisabled().catch(() => false),
    c.isSoulbound().catch(() => true),
    c.revokable().catch(() => false),
    c.flexibleSupplyCap().catch(() => 0),
    c.tokenBalanceCap().catch(() => 0),
    c.isSupplyCapFixed().catch(() => false),
    c.mintGate().catch(() => DEFAULT_GATE),
  ]);

  let userBalance = 0;

  if (userAddress) {
    const [bal] = await Promise.all([
      c.balanceOf(userAddress).catch(() => 0),
    ]);
    userBalance = Number(bal);
  }

  const mintGate = ethers.getAddress(mg) as `0x${string}`;
  const supplyCap = Number(fsc) || Infinity;

  let canMintViaGate = true;
  if (userAddress && mintGate !== DEFAULT_GATE) {
    try {
      const gateContract = new ethers.Contract(mintGate, GATE_ABI, p);
      canMintViaGate = await gateContract.canMint(userAddress, userAddress, 1);
    } catch {
      canMintViaGate = false;
    }
  }

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
    isFollowing: false,
    mintGate,
    canMint: !!im && canMintViaGate && (Number(tbc) === 0 || userBalance < Number(tbc)) && Number(ts) < supplyCap,
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
  });

  const defaults = {
    totalSupply: 0, supplyCap: 0, userBalance: 0,
    isMintable: false, mintingDisabled: false,
    isSoulbound: true, revokable: false, balanceCap: 0,
    isSupplyCapFixed: false, isFollowing: false,
    mintGate: DEFAULT_GATE as `0x${string}`,
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
