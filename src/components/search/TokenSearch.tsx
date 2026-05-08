'use client';

import { useState, useEffect, useRef } from 'react';

interface TokenResult {
  id: string;       // token contract address
  name: string;
  symbol: string;
  image?: string;
}

const ENVIO_URLS: Record<number, string> = {
  42: 'https://envio.lukso-mainnet.universal.tech/v1/graphql',
  4201: 'https://envio.lukso-testnet.universal.tech/v1/graphql',
};

interface Props {
  chainId: number;
  onSelect: (address: string, name: string) => void;
  placeholder?: string;
}

export function TokenSearch({ chainId, onSelect, placeholder }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TokenResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Search with debounce
  const search = async (q: string) => {
    if (q.length < 2) { setResults([]); return; }
    setLoading(true);
    try {
      const envioUrl = ENVIO_URLS[chainId];
      if (!envioUrl) return;
      const gql = `{Asset(where:{_or:[{lsp4TokenName:{_ilike:"%${q}%"}},{lsp4TokenSymbol:{_ilike:"%${q}%"}}]},limit:10){id lsp4TokenName lsp4TokenSymbol images{url}}}`;
      const res = await fetch(envioUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: gql }),
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) return;
      const json = await res.json();
      const assets: { id: string; lsp4TokenName?: string; lsp4TokenSymbol?: string; images?: { url: string }[] }[] = json?.data?.Asset || [];
      setResults(assets.map(a => ({
        id: a.id,
        name: a.lsp4TokenName || 'Unknown',
        symbol: a.lsp4TokenSymbol || '',
        image: a.images?.[0]?.url,
      })));
      setOpen(true);
    } catch {}
    setLoading(false);
  };

  const handleChange = (val: string) => {
    setQuery(val);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => search(val), 300);
  };

  const handleSelect = (r: TokenResult) => {
    onSelect(r.id, r.name);
    setQuery(r.name);
    setOpen(false);
    setResults([]);
  };

  return (
    <div ref={ref} style={{ position: 'relative', flex: 1, minWidth: 150 }}>
      <input
        value={query}
        onChange={e => handleChange(e.target.value)}
        placeholder={placeholder || 'Search token...'}
        className="owner-input"
        style={{ width: '100%', fontSize: 11, fontFamily: 'monospace' }}
      />
      {loading && (
        <span className="text-micro" style={{ position: 'absolute', right: 6, top: 8, color: 'var(--c-text-tertiary)' }}>
          ...
        </span>
      )}
      {open && results.length > 0 && (
        <div
          className="tx-dropdown"
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            minWidth: 260,
            padding: 0,
            zIndex: 300,
          }}
        >
          {results.map(r => (
            <button
              key={r.id}
              onClick={() => handleSelect(r)}
              className="tx-row-link"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 10px',
                width: '100%',
                textAlign: 'left',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                fontSize: 12,
                color: 'var(--c-text)',
              }}
            >
              {r.image && (
                <img src={r.image} alt="" style={{ width: 20, height: 20, borderRadius: 4, objectFit: 'cover' }} />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {r.name}
                </div>
                {r.symbol && <div className="text-micro" style={{ color: 'var(--c-text-tertiary)' }}>{r.symbol}</div>}
              </div>
              <span className="text-micro" style={{ color: 'var(--c-text-tertiary)', fontFamily: 'monospace' }}>
                {r.id.slice(0, 8)}...{r.id.slice(-4)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
