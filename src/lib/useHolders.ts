'use client';

import { useQuery } from '@tanstack/react-query';
import { TokenConfig, CHAINS } from '@/config/tokens';

export interface Holder {
  address: `0x${string}`;
  profileName: string;
  profileImage: string;
  mintedAt: string;
}

// Envio Indexer (LSP Indexer) — public GraphQL endpoint
const ENVIO_URLS: Record<number, string> = {
  42: 'https://envio.lukso-mainnet.universal.tech/v1/graphql',
  4201: 'https://envio.lukso-testnet.universal.tech/v1/graphql',
};

/* ─── Build pagination URL — handles object and string next_page_params ─── */

function buildPaginationUrl(baseUrl: string, nextPageParams: unknown): string {
  if (!nextPageParams) return baseUrl;
  if (typeof nextPageParams === 'string') {
    return `${baseUrl}?next_page_params=${encodeURIComponent(nextPageParams)}`;
  }
  if (typeof nextPageParams === 'object') {
    const params = new URLSearchParams(nextPageParams as Record<string, string>).toString();
    return `${baseUrl}?${params}`;
  }
  return baseUrl;
}

/* ─── Fetch current holders from Blockscout ─── */

async function fetchCurrentHolders(explorerApi: string, tokenProxy: string): Promise<string[]> {
  const holders: string[] = [];
  let nextPage: unknown = null;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const url: string = buildPaginationUrl(
      `${explorerApi}/api/v2/tokens/${tokenProxy}/holders`, nextPage);

    const res = await fetch(url);
    if (!res.ok) break;

    const data = await res.json();
    if (!data.items?.length) break;

    for (const item of data.items) {
      const addr = item.address?.hash?.toLowerCase();
      if (addr) holders.push(addr);
    }

    if (data.next_page_params) {
      nextPage = data.next_page_params;
    } else {
      break;
    }
  }

  return holders;
}

/* ─── Batch resolve profiles via Envio Indexer (GraphQL) ─── */

interface EnvioProfile {
  id: string;
  name?: string;
  profileImages?: { url: string }[];
}

async function batchResolveProfiles(addresses: string[], chainId: number): Promise<Map<string, { name: string; image: string }>> {
  const result = new Map<string, { name: string; image: string }>();
  if (addresses.length === 0) return result;

  const BATCH_SIZE = 50;
  const batches: string[][] = [];

  for (let i = 0; i < addresses.length; i += BATCH_SIZE) {
    batches.push(addresses.slice(i, i + BATCH_SIZE));
  }

  // Skip Envio for testnet (only mainnet has indexed data)
  await Promise.all(
    batches.map(async (batch) => {
      const addrFilter = batch.map((a) => `"${a}"`).join(',');
      const query = `{Profile(where:{id:{_in:[${addrFilter}]}}){id name profileImages{url}}}`;

      try {
        const envioUrl = ENVIO_URLS[chainId];
        if (!envioUrl) return;
        const res = await fetch(envioUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query }),
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) return;

        const json = await res.json();
        const profiles: EnvioProfile[] = json?.data?.Profile || [];

        for (const p of profiles) {
          result.set(p.id.toLowerCase(), {
            name: p.name || '',
            image: p.profileImages?.[0]?.url || '',
          });
        }
      } catch {
        // Envio unavailable — holders still show with address-only
      }
    })
  );

  return result;
}

/* ─── Main fetch: holders from Blockscout + profiles from Envio ─── */

async function fetchHolders(token: TokenConfig): Promise<Holder[]> {
  const chain = CHAINS[token.chainId];
  if (!chain) return [];

  // 1. Get holder addresses from Blockscout
  const addresses = await fetchCurrentHolders(chain.explorer, token.proxy);

  // 2. Resolve profiles via Envio
  const profiles = await batchResolveProfiles(addresses, token.chainId);

  // 3. Build result
  return addresses.map(addr => ({
    address: addr as `0x${string}`,
    profileName: profiles.get(addr)?.name || '',
    profileImage: profiles.get(addr)?.image || '',
    mintedAt: '',
  }));
}

export function useHolders(token: TokenConfig | null) {
  const query = useQuery({
    queryKey: ['token-holders', token?.proxy, token?.chainId],
    queryFn: () => fetchHolders(token!),
    enabled: !!token?.proxy,
    staleTime: 30_000,
  });

  return {
    holders: query.data ?? [],
    isLoading: query.isLoading,
  };
}
