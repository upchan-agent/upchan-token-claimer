'use client';

import { useQuery } from '@tanstack/react-query';
import { TokenConfig } from '@/config/tokens';

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

async function fetchTokenData(token: TokenConfig): Promise<OnChainTokenData> {
  const envioUrl = ENVIO_URLS[token.chainId];
  if (!envioUrl) {
    return { name: '', symbol: '', description: '', image: '', isLoading: false, error: null };
  }

  const query = `{Asset(where:{id:{_eq:"${token.proxy.toLowerCase()}"}}){lsp4TokenName lsp4TokenSymbol description images{url} icons{url}}}`;

  const res = await fetch(envioUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) return { name: '', symbol: '', description: '', image: '', isLoading: false, error: null };

  const json = await res.json();
  const asset: EnvioAsset = json?.data?.Asset?.[0];

  if (!asset) return { name: '', symbol: '', description: '', image: '', isLoading: false, error: null };

  return {
    name: asset.lsp4TokenName || '',
    symbol: asset.lsp4TokenSymbol || '',
    description: asset.description || '',
    image: asset.images?.[0]?.url || asset.icons?.[0]?.url || '',
    isLoading: false,
    error: null,
  };
}

export function useTokenOnChainData(token: TokenConfig | null) {
  const query = useQuery({
    queryKey: ['token-data', token?.proxy, token?.chainId],
    queryFn: () => fetchTokenData(token!),
    enabled: !!token?.proxy,
  });

  const defaults = { name: '', symbol: '', description: '', image: '' };

  return {
    ...defaults,
    ...query.data,
    isLoading: query.isLoading,
    error: query.error?.message ?? null,
  } as OnChainTokenData;
}
