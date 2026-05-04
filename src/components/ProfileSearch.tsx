'use client';

import { useState, useEffect, useRef } from 'react';

interface ProfileResult {
  id: string;
  name: string;
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

export function ProfileSearch({ chainId, onSelect, placeholder }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ProfileResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const search = async (q: string) => {
    if (q.length < 2) { setResults([]); return; }
    setLoading(true);
    try {
      const envioUrl = ENVIO_URLS[chainId];
      if (!envioUrl) return;
      const gql = `{Profile(where:{name:{_ilike:"%${q}%"}},limit:10){id name profileImages{url}}}`;
      const res = await fetch(envioUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: gql }),
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) return;
      const json = await res.json();
      const profiles: { id: string; name?: string; profileImages?: { url: string }[] }[] = json?.data?.Profile || [];
      setResults(profiles.map(p => ({
        id: p.id,
        name: p.name || 'Unknown',
        image: p.profileImages?.[0]?.url,
      })));
      setOpen(true);
    } catch {}
    setLoading(false);
  };

  const handleChange = (val: string) => {
    setQuery(val);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => search(val), 300);
  };

  const handleSelect = (r: ProfileResult) => {
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
        placeholder={placeholder || 'Search profile...'}
        className="owner-input"
        style={{ width: '100%', fontSize: 13 }}
      />
      {loading && <span className="text-micro" style={{ position: 'absolute', right: 6, top: 8, color: 'var(--c-text-tertiary)' }}>...</span>}
      {open && results.length > 0 && (
        <div className="tx-dropdown" style={{ position: 'absolute', top: '100%', left: 0, right: 0, minWidth: 280, padding: 0, zIndex: 300 }}>
          {results.map(r => (
            <button
              key={r.id}
              onClick={() => handleSelect(r)}
              className="tx-row-link"
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', width: '100%', textAlign: 'left', border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--c-text)' }}
            >
              <div style={{ width: 22, height: 22, borderRadius: 11, background: 'var(--c-canvas)', overflow: 'hidden', flexShrink: 0 }}>
                {r.image ? <img src={r.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>👤</span>}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</div>
              </div>
              <span className="text-micro" style={{ color: 'var(--c-text-tertiary)', fontFamily: 'monospace' }}>{r.id.slice(0, 8)}...{r.id.slice(-4)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
