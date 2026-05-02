'use client';

import { useQuery } from '@tanstack/react-query';

// Envio Indexer GraphQL endpoints (same as useHolders.ts)
const ENVIO_URLS: Record<number, string> = {
  42: 'https://envio.lukso-mainnet.universal.tech/v1/graphql',
  4201: 'https://envio.lukso-testnet.universal.tech/v1/graphql',
};

export interface ProfileMeta {
  name: string;
  image: string;
  address: string;
}

function shorten(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

/**
 * Fetch UP profile metadata via Envio Indexer (GraphQL).
 * Same data source as useHolders.ts.
 */
export async function fetchProfileMeta(
  address: string,
  chainId: number
): Promise<ProfileMeta | null> {
  const envioUrl = ENVIO_URLS[chainId];
  if (!envioUrl) return { name: shorten(address), image: '', address };

  try {
    const query = `{
      Profile(where: {id: "${address.toLowerCase()}"}) {
        id
        name
        profileImages { url }
      }
    }`;

    const res = await fetch(envioUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) return { name: shorten(address), image: '', address };

    const json = await res.json();
    const profiles = json?.data?.Profile;
    if (!profiles?.length) return { name: shorten(address), image: '', address };

    const p = profiles[0];
    return {
      name: p.name || shorten(address),
      image: p.profileImages?.[0]?.url || '',
      address,
    };
  } catch {
    return { name: shorten(address), image: '', address };
  }
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
