'use client';

import { useQuery } from '@tanstack/react-query';
import { ERC725 } from '@erc725/erc725.js';
import LSP4Schema from '@erc725/erc725.js/schemas/LSP4DigitalAsset.json';
import { TokenConfig, CHAINS } from '@/config/tokens';

export interface OnChainTokenData {
  name: string;
  symbol: string;
  description: string;
  image: string;
  isLoading: boolean;
  error: string | null;
}

export function useTokenOnChainData(token: TokenConfig | null) {
  const query = useQuery({
    queryKey: ['token-data', token?.proxy, token?.chainId],
    queryFn: async () => {
      if (!token) throw new Error('No token');

      const chain = CHAINS[token.chainId];
      if (!chain) throw new Error('Unsupported chain');

      const erc725 = new ERC725(
        LSP4Schema,
        token.proxy,
        chain.rpc,
        { ipfsGateway: 'https://ipfs.io/ipfs/' },
      );

      // fetchData() auto-fetches IPFS JSON for VerifiableURI + verifies hash
      const results = await erc725.fetchData([
        'LSP4TokenName',
        'LSP4TokenSymbol',
        'LSP4Metadata',
      ]);

      let name = '';
      let symbol = '';
      let description = '';
      let image = '';

      for (const r of results) {
        if (!r) continue;
        switch (r.name) {
          case 'LSP4TokenName':
            name = String(r.value ?? '');
            break;
          case 'LSP4TokenSymbol':
            symbol = String(r.value ?? '');
            break;
          case 'LSP4Metadata': {
            const meta = (r.value as any)?.LSP4Metadata || r.value;
            description = meta?.description || '';
            image = meta?.icon?.[0]?.url || meta?.images?.[0]?.[0]?.url || meta?.image || '';
            break;
          }
        }
      }

      return { name, symbol, description, image };
    },
    enabled: !!token?.proxy,
    staleTime: 60_000,
  });

  const defaults = { name: '', symbol: '', description: '', image: '' };

  return {
    ...defaults,
    ...query.data,
    isLoading: query.isLoading,
    error: query.error?.message ?? null,
  } as OnChainTokenData;
}
