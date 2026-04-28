'use client';

import { useQuery } from '@tanstack/react-query';
import { ERC725 } from '@erc725/erc725.js';
import LSP3Schema from '@erc725/erc725.js/schemas/LSP3ProfileMetadata.json';
import { TokenConfig, CHAINS } from '@/config/tokens';

export interface Holder {
  address: `0x${string}`;
  profileName: string;
  profileImage: string;
  mintedAt: string;
}

const ZERO_ADDR = '0x0000000000000000000000000000000000000000'.toLowerCase();

async function fetchAllTransfers(explorerApi: string, tokenProxy: string): Promise<any[]> {
  const items: any[] = [];
  let nextPage: string | null = null;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const url: string = nextPage
      ? `${explorerApi}/api/v2/tokens/${tokenProxy}/transfers?next_page_params=${encodeURIComponent(nextPage)}`
      : `${explorerApi}/api/v2/tokens/${tokenProxy}/transfers`;

    const res = await fetch(url);
    if (!res.ok) break;

    const data = await res.json();
    if (!data.items?.length) break;

    for (const item of data.items) {
      // Only include mints (from=0x0)
      const from = item.from?.hash?.toLowerCase();
      if (from === ZERO_ADDR) {
        items.push(item);
      }
    }

    if (data.next_page_params) {
      nextPage = data.next_page_params;
    } else {
      break;
    }
  }

  return items;
}

async function resolveLSP3Profile(address: `0x${string}`, rpc: string): Promise<{ name: string; image: string }> {
  try {
    const erc725 = new ERC725(
      LSP3Schema,
      address,
      rpc,
      { ipfsGateway: 'https://ipfs.io/ipfs/' },
    );
    // fetchData() auto-fetches IPFS JSON for VerifiableURI + verifies hash
    const data = await erc725.fetchData('LSP3Profile');
    if (!data?.value) return { name: '', image: '' };

    const lsp3 = (data.value as any)?.LSP3Profile || data.value;
    const profileObj = lsp3?.profile || lsp3;
    return {
      name: profileObj?.name || lsp3?.name || '',
      image: profileObj?.profileImage?.[0]?.url
        || profileObj?.avatar?.[0]?.url
        || lsp3?.avatar?.[0]?.url
        || '',
    };
  } catch {
    return { name: '', image: '' };
  }
}

async function fetchHolders(token: TokenConfig): Promise<Holder[]> {
  const chain = CHAINS[token.chainId];
  if (!chain) return [];

  // 1. Get all mint transfers with pagination
  const transfers = await fetchAllTransfers(chain.explorer, token.proxy);

  // 2. Deduplicate by `to`, keep earliest mint
  const mintMap = new Map<string, string>();
  for (const item of transfers) {
    const to = item.to?.hash;
    if (!to) continue;
    const key = to.toLowerCase();
    const ts = item.timestamp || '';
    if (!mintMap.has(key)) mintMap.set(key, ts);
  }

  const addresses = [...mintMap.keys()] as `0x${string}`[];

  // 3. Resolve LSP3Profile for ALL holders (batched)
  const batchSize = 5;
  const profiles: Record<string, { name: string; image: string }> = {};

  for (let i = 0; i < addresses.length; i += batchSize) {
    const batch = addresses.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map(addr => resolveLSP3Profile(addr, chain.rpc))
    );
    results.forEach((r, idx) => {
      if (r.status === 'fulfilled') {
        profiles[batch[idx].toLowerCase()] = r.value;
      }
    });
  }

  return addresses.map(addr => ({
    address: addr,
    profileName: profiles[addr.toLowerCase()]?.name || '',
    profileImage: profiles[addr.toLowerCase()]?.image || '',
    mintedAt: mintMap.get(addr.toLowerCase()) || '',
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
