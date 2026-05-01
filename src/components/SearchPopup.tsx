'use client';

import { useState, useEffect, useRef } from 'react';
import { ethers } from 'ethers';
import { Popup } from './Popup';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (address: `0x${string}`) => void;
}

interface ProfileResult {
  id: string;
  name: string | null;
  network?: string;
}

const ENVIO_URLS: Record<string, string> = {
  testnet: 'https://envio.lukso-testnet.universal.tech/v1/graphql',
  mainnet: 'https://envio.lukso-mainnet.universal.tech/v1/graphql',
};

export function SearchPopup({ isOpen, onClose, onSelect }: Props) {
  const [input, setInput] = useState('');
  const [results, setResults] = useState<ProfileResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    if (isOpen) {
      setInput('');
      setResults([]);
      setError('');
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Live name search (debounced)
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const v = input.trim();
    if (!v) { setResults([]); setError(''); setSearching(false); return; }

    // Check if valid address — skip live search
    try { ethers.getAddress(v); setResults([]); setError(''); setSearching(false); return; }
    catch { /* name search */ }

    setSearching(true);
    timerRef.current = setTimeout(async () => {
      const all: ProfileResult[] = [];
      for (const [net, url] of Object.entries(ENVIO_URLS)) {
        try {
          const r = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: `{Profile(where:{name:{_ilike:"%${v}%"}},limit:5){id name}}` }),
          });
          const j = await r.json();
          for (const p of (j?.data?.Profile || [])) {
            all.push({ id: ethers.getAddress(p.id), name: p.name, network: net });
          }
        } catch { /* skip */ }
      }
      setResults(all);
      setError(all.length === 0 ? 'No profiles found' : '');
      setSearching(false);
    }, 400);

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [input]);

  // Commit: select address or show results
  const commit = async () => {
    const v = input.trim();
    if (!v) return;

    // 1. Try as address
    try {
      const addr = ethers.getAddress(v) as `0x${string}`;
      onSelect(addr);
      onClose();
      return;
    } catch { /* not address */ }

    // 2. Name search (full, not debounced)
    setSearching(true);
    const all: ProfileResult[] = [];
    for (const [net, url] of Object.entries(ENVIO_URLS)) {
      try {
        const r = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: `{Profile(where:{name:{_ilike:"%${v}%"}},limit:5){id name}}` }),
        });
        const j = await r.json();
        for (const p of (j?.data?.Profile || [])) {
          all.push({ id: ethers.getAddress(p.id), name: p.name, network: net });
        }
      } catch { /* skip */ }
    }
    setSearching(false);

    if (all.length === 0) { setError('No profiles found'); return; }
    if (all.length === 1) { onSelect(all[0].id as `0x${string}`); onClose(); return; }
    setResults(all);
  };

  const pick = (e: React.MouseEvent | React.TouchEvent, addr: string) => {
    e.stopPropagation();
    e.preventDefault();
    onSelect(addr as `0x${string}`);
    onClose();
  };

  return (
    <Popup isOpen={isOpen} onClose={onClose} fixedWidth={'min(440px, 90vw)'}>
      <div style={{
        background: '#fff', borderRadius: 14, padding: 24,
        width: '100%', boxSizing: 'border-box',
        height: 400, display: 'flex', flexDirection: 'column',
      }}>
        <p style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 600, color: '#1d1d1f', textAlign: 'center' }}>
          🔍 Debug: Search Profile
        </p>

        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexShrink: 0 }}>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') commit(); }}
            placeholder="UP address (0x...) or name"
            autoComplete="off"
            spellCheck={false}
            style={{
              flex: 1, padding: '12px 14px',
              border: '1px solid #d2d2d7', borderRadius: 10,
              fontSize: 16,
              outline: 'none',
              fontFamily: 'SF Pro Text, -apple-system, sans-serif',
              color: '#1d1d1f',
              background: '#fafafc',
            }}
          />
          <button
            onClick={commit}
            disabled={searching}
            style={{
              padding: '0 20px', background: '#0071e3', color: '#fff',
              border: 'none', borderRadius: 10, fontSize: 15,
              cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500,
            }}
          >
            {searching ? '…' : 'Search'}
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {results.length > 0 && (
          <div>
            {results.map(r => (
              <div key={r.id}
                onClick={e => pick(e, r.id)}
                onTouchEnd={e => pick(e, r.id)}
                style={{
                  padding: '12px 14px', marginBottom: 6, borderRadius: 10,
                  cursor: 'pointer', background: '#f5f5f7',
                  display: 'flex', alignItems: 'center', gap: 10,
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                <span style={{
                  fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4, flexShrink: 0,
                  ...(r.network === 'mainnet' ? { background: '#ffd60a', color: '#000' }
                    : r.network === 'testnet' ? { background: '#30d058', color: '#fff' }
                    : { background: '#e8e8ed', color: '#86868b' }),
                }}>{r.network || '?'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {r.name && <div style={{ fontSize: 14, fontWeight: 600, color: '#1d1d1f' }}>{r.name}</div>}
                  <div style={{ fontSize: 12, color: '#86868b', fontFamily: 'SF Mono, monospace' }}>
                    {r.id.slice(0, 10)}…{r.id.slice(-6)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {searching && <p style={{ marginTop: 12, fontSize: 13, color: '#86868b', textAlign: 'center' }}>Searching…</p>}
        {error && !searching && <p style={{ marginTop: 12, fontSize: 13, color: '#ff3b30', textAlign: 'center' }}>{error}</p>}
        </div>
      </div>
    </Popup>
  );
}
