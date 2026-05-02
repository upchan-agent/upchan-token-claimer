'use client';

import { useQuery } from '@tanstack/react-query';
import { ethers } from 'ethers';
import { CHAINS } from '@/config/tokens';

const LSP3_PROFILE_KEY = '0x5ef83ad9559033e6e941db7d7c495acdce616347d28e90c7ce47cbfcfcad3bc5';

const UP_ABI = [
  'function getData(bytes32 key) view returns (bytes)',
];

export interface ProfileMeta {
  name: string;
  image: string;
  address: string;
}

function ipfs(url: string): string {
  return url?.replace('ipfs://', 'https://ipfs.io/ipfs/') || '';
}

function shorten(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

/**
 * Decode LSP3Profile VerifiableURI from getData() return bytes.
 * Format (LSP2): identifier(2) + method(4) + dataLen(2) + dataHash(32) + uri
 * Some implementations omit dataLen.
 */
function decodeLSP3Profile(raw: string): { name: string; image: string } | null {
  try {
    // getData returns ABI-encoded bytes: offset(32) + length(32) + data
    const abi = new ethers.AbiCoder();
    const [decoded] = abi.decode(['bytes'], raw);

    // decoded is the raw bytes of the VerifiableURI
    const hex = ethers.hexlify(decoded);

    // Skip: identifier(2) + method(4) + optional dataLen(2) + dataHash(32)
    // The URI starts after these headers
    // Try without dataLen first (8 bytes header), then with (10 bytes)
    let uriStart = 8; // identifier(2) + method(4) + dataHash starts here... no
    // Actually: identifier(2) + method(4) + dataHash(32) = 38 bytes
    // If dataLen present: +2 = 40 bytes
    // Let's try from byte 38
    uriStart = 38;
    let uriHex = '0x' + hex.slice(2 + uriStart * 2); // 38 bytes = 76 hex chars
    let uri = ethers.toUtf8String(uriHex).replace(/\0+$/, '');

    // If that didn't yield a valid URL, try with dataLen (skip 40 bytes)
    if (!uri.startsWith('http') && !uri.startsWith('ipfs') && hex.length > 40 * 2 + 2) {
      uriStart = 40;
      uriHex = '0x' + hex.slice(2 + uriStart * 2);
      uri = ethers.toUtf8String(uriHex).replace(/\0+$/, '');
    }

    if (!uri) return null;

    // Fetch the JSON from the URI
    const jsonUrl = ipfs(uri);
    // We can't fetch synchronously here, return the URL and let the component fetch
    return { name: '', image: '' };
  } catch {
    return null;
  }
}

async function fetchProfileJson(uri: string): Promise<{ name: string; image: string } | null> {
  try {
    const url = ipfs(uri);
    const res = await fetch(url);
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
 * Fetch Universal Profile metadata (name + image) for a given address.
 * Uses eth_call to get LSP3Profile data, then fetches the JSON from IPFS.
 */
export async function fetchProfileMeta(
  address: string,
  chainId: number
): Promise<ProfileMeta | null> {
  try {
    const chain = CHAINS[chainId];
    if (!chain) return null;

    const p = new ethers.JsonRpcProvider(chain.rpc);
    const up = new ethers.Contract(address, UP_ABI, p);

    // Get the LSP3Profile VerifiableURI
    const raw: string = await up.getData(LSP3_PROFILE_KEY);

    // Decode the VerifiableURI to get the JSON URI
    const abi = new ethers.AbiCoder();
    const [decoded] = abi.decode(['bytes'], raw);
    const hex = ethers.hexlify(decoded);

    // VerifiableURI format (LSP2):
    //   identifier(2) + method(4) + [dataLen(2)] + dataHash(32) + uri
    // Some implementations include dataLen (40 bytes total), some don't (38 bytes)
    // Try both.
    let uri = '';

    // Try 38 bytes (no dataLen)
    try {
      const u = '0x' + hex.slice(2 + 38 * 2);
      const decoded = ethers.toUtf8String(u).replace(/\0+$/, '');
      if (decoded.startsWith('http') || decoded.startsWith('ipfs')) uri = decoded;
    } catch { /* try next */ }

    // Try 40 bytes (with dataLen)
    if (!uri && hex.length > 40 * 2 + 2) {
      try {
        const u = '0x' + hex.slice(2 + 40 * 2);
        const decoded = ethers.toUtf8String(u).replace(/\0+$/, '');
        if (decoded.startsWith('http') || decoded.startsWith('ipfs')) uri = decoded;
      } catch { /* give up */ }
    }

    if (!uri) return { name: shorten(address), image: '', address };

    // Fetch the JSON
    const json = await fetchProfileJson(uri);
    if (!json) return { name: shorten(address), image: '', address };

    return {
      name: json.name || shorten(address),
      image: json.image,
      address,
    };
  } catch {
    return { name: shorten(address), image: '', address };
  }
}

/**
 * React hook: fetches profile metadata for a given UP address.
 * Cached via react-query with 10min stale time.
 */
export function useProfileMetadata(address: string | null | undefined, chainId: number) {
  return useQuery({
    queryKey: ['profile-meta', address, chainId],
    queryFn: () => fetchProfileMeta(address!, chainId),
    enabled: !!address,
    staleTime: 10 * 60 * 1000, // 10 min cache
  });
}
