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

/* ─── Fetch all mint transfers from Blockscout ─── */

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

/* ─── Fetch current holders (for accuracy with non-soulbound) ─── */

async function fetchCurrentHolders(explorerApi: string, tokenProxy: string): Promise<Set<string>> {
  const holders = new Set<string>();
  let nextPage: string | null = null;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const url: string = nextPage
      ? `${explorerApi}/api/v2/tokens/${tokenProxy}/holders`
      : `${explorerApi}/api/v2/tokens/${tokenProxy}/holders`;

    const res = await fetch(url);
    if (!res.ok) break;

    const data = await res.json();
    if (!data.items?.length) break;

    for (const item of data.items) {
      const addr = item.address?.hash?.toLowerCase();
      if (addr) holders.add(addr);
    }

    if (data.next_page_params) {
      nextPage = data.next_page_params;
    } else {
      break;
    }
  }

  return holders;
}

/* ─── Resolve LSP3 Profile via ERC725 ─── */

async function resolveLSP3Profile(address: `0x${string}`, rpc: string): Promise<{ name: string; image: string }> {
  try {
    const erc725 = new ERC725(
      LSP3Schema,
      address,
      rpc,
      { ipfsGateway: 'https://ipfs.io/ipfs/' },
    );
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

/* ─── Main fetch: current holders + mint timestamps + newest first ─── */

async function fetchHolders(token: TokenConfig): Promise<Holder[]> {
  const chain = CHAINS[token.chainId];
  if (!chain) return [];

  // 1. Get current holders (1 fast request)
  const currentHolders = await fetchCurrentHolders(chain.explorer, token.proxy);

  // 2. Get all mint transfers with timestamps (paginated)
  const transfers = await fetchAllTransfers(chain.explorer, token.proxy);

  // 3. Deduplicate by `to`, keep earliest mint, filter by current holders
  const mintMap = new Map<string, string>();
  const hasHolders = currentHolders.size > 0;

  for (const item of transfers) {
    const to = item.to?.hash;
    if (!to) continue;
    const key = to.toLowerCase();

    // Skip if not a current holder (when holders data is available)
    if (hasHolders && !currentHolders.has(key)) continue;

    const ts = item.timestamp || '';
    if (!mintMap.has(key)) mintMap.set(key, ts);
  }

  const addresses = [...mintMap.keys()] as `0x${string}`[];

  // 4. Sort by mint timestamp descending (newest first)
  addresses.sort((a, b) => {
    const tsA = mintMap.get(a.toLowerCase()) || '';
    const tsB = mintMap.get(b.toLowerCase()) || '';
    return tsB.localeCompare(tsA);
  });

  // 5. Resolve LSP3Profile for all holders (batched)
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

  // 6. Build result — newest first
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
