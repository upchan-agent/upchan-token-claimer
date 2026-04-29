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

const ENVIO_URLS: Record<number, string> = {
  42: 'https://envio.lukso-mainnet.universal.tech/v1/graphql',
  4201: 'https://envio.lukso-testnet.universal.tech/v1/graphql',
};

interface EnvioAsset {
  lsp4TokenName?: string;
  lsp4TokenSymbol?: string;
  description?: string;
  images?: { url: string }[];
  icons?: { url: string }[];
}

async function fetchViaEnvio(token: TokenConfig): Promise<OnChainTokenData | null> {
  const envioUrl = ENVIO_URLS[token.chainId];
  if (!envioUrl) return null;

  const query = `{Asset(id:"${token.proxy.toLowerCase()}"){lsp4TokenName lsp4TokenSymbol description images{url} icons{url}}}`;

  try {
    const res = await fetch(envioUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;

    const json = await res.json();
    const asset: EnvioAsset = json?.data?.Asset;

    if (!asset) return null;

    return {
      name: asset.lsp4TokenName || '',
      symbol: asset.lsp4TokenSymbol || '',
      description: asset.description || '',
      image: asset.images?.[0]?.url || asset.icons?.[0]?.url || '',
      isLoading: false,
      error: null,
    };
  } catch {
    return null;
  }
}

async function fetchViaERC725(token: TokenConfig): Promise<OnChainTokenData> {
  const chain = CHAINS[token.chainId];
  if (!chain) throw new Error('Unsupported chain');

  const erc725 = new ERC725(
    LSP4Schema,
    token.proxy,
    chain.rpc,
    { ipfsGateway: 'https://ipfs.io/ipfs/' },
  );

  const results = await erc725.fetchData(['LSP4TokenName', 'LSP4TokenSymbol', 'LSP4Metadata']);

  let name = '', symbol = '', description = '', image = '';
  for (const r of results) {
    if (!r) continue;
    switch (r.name) {
      case 'LSP4TokenName': name = String(r.value ?? ''); break;
      case 'LSP4TokenSymbol': symbol = String(r.value ?? ''); break;
      case 'LSP4Metadata': {
        const meta = (r.value as any)?.LSP4Metadata || r.value;
        description = meta?.description || '';
        image = meta?.icon?.[0]?.url || meta?.images?.[0]?.[0]?.url || meta?.image || '';
        break;
      }
    }
  }

  return { name, symbol, description, image, isLoading: false, error: null };
}

export function useTokenOnChainData(token: TokenConfig | null) {
  const query = useQuery({
    queryKey: ['token-data', token?.proxy, token?.chainId],
    queryFn: async () => {
      if (!token) throw new Error('No token');
      const envio = await fetchViaEnvio(token);
      if (envio) return envio;
      return fetchViaERC725(token);
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
