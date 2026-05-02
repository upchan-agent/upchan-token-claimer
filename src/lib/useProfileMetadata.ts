'use client';

import { useQuery } from '@tanstack/react-query';
import { ethers } from 'ethers';
import { CHAINS } from '@/config/tokens';

// Envio Indexer GraphQL — testnet and mainnet (same as useHolders.ts)
const ENVIO_URLS: Record<number, string> = {
  42: 'https://envio.lukso-mainnet.universal.tech/v1/graphql',
  4201: 'https://envio.lukso-testnet.universal.tech/v1/graphql',
};

const LSP3_PROFILE_KEY = '0x5ef83ad9559033e6e941db7d7c495acdce616347d28e90c7ce47cbfcfcad3bc5';
const UP_GETDATA_ABI = ['function getData(bytes32 key) view returns (bytes)'];

export interface ProfileMeta {
  name: string;
  image: string;
  address: string;
}

function shorten(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function ipfs(url: string): string {
  return url?.replace('ipfs://', 'https://ipfs.io/ipfs/') || '';
}

// ─── Strategy 1: Envio Indexer (useHoldersと同じ _in 形式) ───

async function fromEnvio(address: string, chainId: number): Promise<{ name: string; image: string } | null> {
  const envioUrl = ENVIO_URLS[chainId];
  if (!envioUrl) return null;

  try {
    const query = `{Profile(where:{id:{_in:["${address.toLowerCase()}"]}}){id name profileImages{url}}}`;
    const res = await fetch(envioUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const p = json?.data?.Profile?.[0];
    if (!p) return null;
    return {
      name: p.name || '',
      image: p.profileImages?.[0]?.url || '',
    };
  } catch {
    return null;
  }
}

// ─── Strategy 2: On-chain getData (fallback for edge cases) ───

async function fromOnChain(address: string, chainId: number): Promise<{ name: string; image: string } | null> {
  try {
    const chain = CHAINS[chainId];
    if (!chain) return null;

    const p = new ethers.JsonRpcProvider(chain.rpc);
    const up = new ethers.Contract(address, UP_GETDATA_ABI, p);
    const raw: string = await up.getData(LSP3_PROFILE_KEY);
    const abi = new ethers.AbiCoder();
    const [decoded] = abi.decode(['bytes'], raw);
    const hex = ethers.hexlify(decoded);

    let uri = '';
    for (const offset of [38, 40]) {
      try {
        const u = '0x' + hex.slice(2 + offset * 2);
        const decoded = ethers.toUtf8String(u).replace(/\0+$/, '');
        if (decoded.startsWith('http') || decoded.startsWith('ipfs')) {
          uri = decoded;
          break;
        }
      } catch { /* try next */ }
    }
    if (!uri) return null;

    const url = ipfs(uri);
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    const data = await res.json();
    const profile = data?.LSP3Profile;
    if (!profile) return null;

    return {
      name: profile.name || '',
      image: profile.profileImage?.[0]?.url || '',
    };
  } catch {
    return null;
  }
}

/**
 * Fetch UP profile metadata.
 * Strategy: Envio first (all chains), falls back to on-chain getData.
 */
export async function fetchProfileMeta(
  address: string,
  chainId: number
): Promise<ProfileMeta | null> {
  // Try Envio first (works for testnet and mainnet)
  const envioResult = await fromEnvio(address, chainId);
  if (envioResult) {
    return { ...envioResult, address };
  }

  // Fallback: on-chain getData
  const chainResult = await fromOnChain(address, chainId);
  if (chainResult) {
    return { ...chainResult, address };
  }

  return { name: shorten(address), image: '', address };
}

/**
 * React hook: fetches profile metadata for a given UP address via Envio.
 * Cached via react-query with 10min stale time.
 */
export function useProfileMetadata(address: string | null | undefined, chainId: number) {
  return useQuery({
    queryKey: ['profile-meta', address, chainId],
    queryFn: () => fetchProfileMeta(address!, chainId),
    enabled: !!address,
    staleTime: 10 * 60 * 1000,
  });
}
