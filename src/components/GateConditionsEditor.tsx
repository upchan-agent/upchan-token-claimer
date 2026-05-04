'use client';

import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { useRequirementsGate, fetchGateSettings, GateSettings } from '@/lib/useRequirementsGate';
import { CHAINS } from '@/config/tokens';
import { TokenSearch } from './TokenSearch';
import { ProfileSearch } from './ProfileSearch';

interface Props {
  gateAddress: string;
  chainId: number;
  onDone: () => void;
}

const ZERO = '0x0000000000000000000000000000000000000000';

export function GateConditionsEditor({ gateAddress, chainId, onDone }: Props) {
  const rg = useRequirementsGate(gateAddress, chainId);
  const [settings, setSettings] = useState<GateSettings | null>(null);
  const [gateType, setGateType] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [followAddr, setFollowAddr] = useState('');
  const [followName, setFollowName] = useState('');
  const [minFol, setMinFol] = useState('0');
  const [minLyx, setMinLyx] = useState('0');
  const [useOr, setUseOr] = useState(false);
  const [tokenReqs, setTokenReqs] = useState<{ token: string; amount: number }[]>([]);
  const [newTokenAddr, setNewTokenAddr] = useState('');
  const [newTokenAmt, setNewTokenAmt] = useState('1');

  // Detect gate type
  useEffect(() => {
    if (gateAddress === ZERO || !ethers.isAddress(gateAddress)) return;
    let dead = false;
    (async () => {
      try {
        const c = CHAINS[chainId];
        if (!c) return;
        const p = new ethers.JsonRpcProvider(c.rpc);
        const contract = new ethers.Contract(gateAddress, ['function gateType() view returns (string)'], p);
        const gt = await contract.gateType();
        if (!dead) setGateType(gt);
      } catch {}
    })();
    return () => { dead = true; };
  }, [gateAddress, chainId]);

  // Load settings
  const refresh = useCallback(async () => {
    if (gateAddress === ZERO) return;
    setLoading(true);
    setError(null);
    try {
      const s = await fetchGateSettings(gateAddress, chainId, CHAINS);
      setSettings(s);
      setFollowAddr(s.followTarget);
      setFollowName('');
      setMinFol(String(s.minFollowers));
      setMinLyx((BigInt(s.minNativeBalance) / BigInt(10) ** BigInt(18)).toString());
      setUseOr(s.useOr);
      setTokenReqs(s.tokenReqs.map(t => ({ token: t.token, amount: t.minAmount })));
    } catch {
      setError('Failed to load gate settings');
    }
    setLoading(false);
  }, [gateAddress, chainId]);

  useEffect(() => {
    if (gateType === 'requirements') refresh();
  }, [gateType, refresh]);

  // Save: single tx for all conditions
  const saveAll = async () => {
    setError(null);
    setSaving(true);
    try {
      const lyxWei = minLyx ? (BigInt(Math.round(Number(minLyx) * 1e18))).toString() : '0';
      await rg.setAll(followAddr, lyxWei, Number(minFol) || 0, tokenReqs, useOr);
      await refresh();
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    }
    setSaving(false);
  };

  if (gateType !== 'requirements') return null;
  if (loading || !settings) {
    return <div className="card-section"><p className="text-caption empty-state">Loading...</p></div>;
  }

  return (
    <div className="card-section" style={{ borderTop: '1px solid var(--c-border)', marginTop: 8 }}>
      <span className="section-label">Conditions</span>

      {error && <div className="error-box" style={{ marginBottom: 8, fontSize: 12 }}>{error}</div>}

      <div className="data-row">
        <span className="data-label">Logic</span>
        <div style={{ display: 'flex', gap: 4 }}>
          {['All (AND)', 'Any (OR)'].map(mode => {
            const isOr = mode === 'Any (OR)';
            return (
              <button
                key={mode}
                onClick={() => setUseOr(isOr)}
                className={useOr === isOr ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
                style={{ fontSize: 12, padding: '2px 10px' }}
              >
                {mode}
              </button>
            );
          })}
        </div>
      </div>

      <div className="data-row">
        <span className="data-label">Follow</span>
        <ProfileSearch
          chainId={chainId}
          onSelect={(addr, name) => {
            setFollowAddr(addr);
            setFollowName(name);
          }}
          placeholder="Search UP..."
        />
        {followAddr !== ZERO && (
          <span className="text-micro" style={{ color: 'var(--c-success)', whiteSpace: 'nowrap' }}>
            {followAddr.slice(0, 8)}...{followAddr.slice(-4)}
          </span>
        )}
      </div>

      <div className="data-row">
        <span className="data-label">Followers {'\u2265'}</span>
        <input
          type="number"
          value={minFol}
          onChange={e => setMinFol(e.target.value)}
          min={0}
          className="owner-input"
          style={{ width: 70 }}
        />
      </div>

      <div className="data-row">
        <span className="data-label">LYX {'\u2265'}</span>
        <input
          type="number"
          value={minLyx}
          onChange={e => setMinLyx(e.target.value)}
          min={0}
          className="owner-input"
          style={{ width: 120 }}
          placeholder="wei"
        />
      </div>

      <div style={{ marginTop: 8 }}>
        <span className="data-label">Token Reqs</span>
      </div>

      {tokenReqs.map((t, i) => (
        <div key={i} className="data-row owner-token-row">
          <span className="data-value text-micro" style={{ fontFamily: 'monospace' }}>
            {t.token.slice(0, 8)}...{t.token.slice(-4)}
          </span>
          <span className="data-value">{'\u2265'} {t.amount}</span>
          <button
            onClick={() => setTokenReqs(reqs => reqs.filter((_, j) => j !== i))}
            className="btn-icon"
            style={{ fontSize: 11, color: 'var(--c-error)' }}
          >
            {'\u2715'}
          </button>
        </div>
      ))}

      <div className="owner-action-row" style={{ marginTop: 4 }}>
        <TokenSearch chainId={chainId} onSelect={(addr) => setNewTokenAddr(addr)} placeholder="Search token..." />
        <input
          type="number"
          value={newTokenAmt}
          onChange={e => setNewTokenAmt(e.target.value)}
          min={1}
          className="owner-input"
          style={{ width: 60 }}
        />
        <button
          onClick={() => {
            if (!newTokenAddr) return;
            setTokenReqs(reqs => [...reqs, { token: newTokenAddr, amount: Number(newTokenAmt) || 1 }]);
            setNewTokenAddr('');
            setNewTokenAmt('1');
          }}
          disabled={!newTokenAddr}
          className="btn btn-primary btn-sm"
          style={{ fontSize: 12, padding: '2px 10px' }}
        >
          + Add
        </button>
      </div>

      <div className="owner-action-row" style={{ marginTop: 12 }}>
        <button onClick={saveAll} disabled={saving} className="btn btn-primary btn-sm">
          {saving ? 'Saving...' : 'Save All Conditions'}
        </button>
      </div>
    </div>
  );
}
