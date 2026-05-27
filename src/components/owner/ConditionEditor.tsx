'use client';

import { useEffect, useMemo, useState } from 'react';
import { ethers } from 'ethers';
import { TokenConditions } from '@/hooks/useTokenStatus';

export interface ConditionEditorData {
  followTargets: string[];
  minBalance: string;
  minFollowing: string;
  minFollowers: string;
  erc725y: { dataKey: string; minCount: string }[];
  tokenReqs: { token: string; minAmount: string; specificTokenId: string }[];
  followUseOr: boolean;
  erc725yUseOr: boolean;
  tokenReqsUseOr: boolean;
  useOr: boolean;
}

interface Props {
  mode: 'mint' | 'hold';
  chainId: number;
  initialData: TokenConditions;
  onSave: (data: ConditionEditorData) => Promise<void>;
  onLock: () => Promise<void>;
  disabled: boolean;
}

const ZERO_BYTES32 = '0x0000000000000000000000000000000000000000000000000000000000000000';

function formatInitialBalance(value: string): string {
  try {
    return ethers.formatEther(BigInt(value || '0'));
  } catch {
    return value || '0';
  }
}

function isBytes32(value: string): boolean {
  return ethers.isHexString(value, 32);
}

export function ConditionEditor({ mode, chainId, initialData, onSave, onLock, disabled }: Props) {
  const [followTargets, setFollowTargets] = useState<string[]>(initialData.followTargets);
  const [minBalance, setMinBalance] = useState(formatInitialBalance(initialData.minBalance));
  const [minFollowing, setMinFollowing] = useState(initialData.minFollowing);
  const [minFollowers, setMinFollowers] = useState(initialData.minFollowers);
  const [erc725y, setErc725y] = useState(initialData.erc725y);
  const [tokenReqs, setTokenReqs] = useState(initialData.tokenReqs);
  const [followUseOr, setFollowUseOr] = useState(initialData.followUseOr);
  const [erc725yUseOr, setErc725yUseOr] = useState(initialData.erc725yUseOr);
  const [tokenReqsUseOr, setTokenReqsUseOr] = useState(initialData.tokenReqsUseOr);
  const [useOr, setUseOr] = useState(initialData.useOr);

  useEffect(() => {
    setFollowTargets(initialData.followTargets);
    setMinBalance(formatInitialBalance(initialData.minBalance));
    setMinFollowing(initialData.minFollowing);
    setMinFollowers(initialData.minFollowers);
    setErc725y(initialData.erc725y);
    setTokenReqs(initialData.tokenReqs);
    setFollowUseOr(initialData.followUseOr);
    setErc725yUseOr(initialData.erc725yUseOr);
    setTokenReqsUseOr(initialData.tokenReqsUseOr);
    setUseOr(initialData.useOr);
  }, [initialData]);

  const cleanFollowTargets = useMemo(
    () => followTargets.map(v => v.trim()).filter(Boolean),
    [followTargets],
  );
  const cleanErc725y = useMemo(
    () => erc725y.map(v => ({ dataKey: v.dataKey.trim(), minCount: v.minCount || '0' })).filter(v => v.dataKey),
    [erc725y],
  );
  const cleanTokenReqs = useMemo(
    () => tokenReqs
      .map(v => ({
        token: v.token.trim(),
        minAmount: v.minAmount || '0',
        specificTokenId: v.specificTokenId.trim() || ZERO_BYTES32,
      }))
      .filter(v => v.token),
    [tokenReqs],
  );

  const isValid =
    cleanFollowTargets.every(ethers.isAddress) &&
    cleanErc725y.every(v => isBytes32(v.dataKey)) &&
    cleanTokenReqs.every(v => ethers.isAddress(v.token) && isBytes32(v.specificTokenId));

  const label = mode === 'mint' ? 'Mint' : 'Hold';
  const locked = initialData.locked;

  return (
    <div>
      <div className="data-row">
        <span className="data-label">Network</span>
        <span className="data-value text-caption">Chain {chainId}</span>
      </div>

      <div style={{ marginTop: 8 }}>
        <span className="section-label">Follow Targets</span>
        {followTargets.map((addr, index) => (
          <div className="owner-action-row" key={`follow-${index}`}>
            <input
              value={addr}
              onChange={e => setFollowTargets(items => items.map((item, i) => i === index ? e.target.value : item))}
              placeholder="0x..."
              className="owner-input"
              style={{ flex: 1, fontFamily: 'monospace', fontSize: 12 }}
              disabled={disabled || locked}
            />
            <button
              type="button"
              onClick={() => setFollowTargets(items => items.filter((_, i) => i !== index))}
              disabled={disabled || locked}
              className="btn btn-secondary btn-sm btn-danger"
            >
              Remove
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setFollowTargets(items => [...items, ''])}
          disabled={disabled || locked}
          className="btn btn-secondary btn-sm"
          style={{ marginTop: 6 }}
        >
          Add Follow
        </button>
      </div>

      <div className="owner-action-row" style={{ marginTop: 10 }}>
        <input
          type="number"
          min="0"
          step="0.0001"
          value={minBalance}
          onChange={e => setMinBalance(e.target.value)}
          placeholder="Min LYX Balance"
          className="owner-input"
          disabled={disabled || locked}
        />
        <input
          type="number"
          min="0"
          value={minFollowing}
          onChange={e => setMinFollowing(e.target.value)}
          placeholder="Min Following"
          className="owner-input"
          disabled={disabled || locked}
        />
        <input
          type="number"
          min="0"
          value={minFollowers}
          onChange={e => setMinFollowers(e.target.value)}
          placeholder="Min Followers"
          className="owner-input"
          disabled={disabled || locked}
        />
      </div>

      <div style={{ marginTop: 12 }}>
        <span className="section-label">ERC725Y Conditions</span>
        {erc725y.map((item, index) => (
          <div className="owner-action-row" key={`erc725y-${index}`}>
            <input
              value={item.dataKey}
              onChange={e => setErc725y(items => items.map((row, i) => i === index ? { ...row, dataKey: e.target.value } : row))}
              placeholder="Data key bytes32"
              className="owner-input"
              style={{ flex: 2, fontFamily: 'monospace', fontSize: 12 }}
              disabled={disabled || locked}
            />
            <input
              type="number"
              min="0"
              value={item.minCount}
              onChange={e => setErc725y(items => items.map((row, i) => i === index ? { ...row, minCount: e.target.value } : row))}
              placeholder="Min count"
              className="owner-input"
              style={{ width: 110 }}
              disabled={disabled || locked}
            />
            <button
              type="button"
              onClick={() => setErc725y(items => items.filter((_, i) => i !== index))}
              disabled={disabled || locked}
              className="btn btn-secondary btn-sm btn-danger"
            >
              Remove
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setErc725y(items => [...items, { dataKey: '', minCount: '1' }])}
          disabled={disabled || locked}
          className="btn btn-secondary btn-sm"
          style={{ marginTop: 6 }}
        >
          Add ERC725Y
        </button>
      </div>

      <div style={{ marginTop: 12 }}>
        <span className="section-label">Token Requirements</span>
        {tokenReqs.map((item, index) => (
          <div className="owner-action-row" key={`token-${index}`}>
            <input
              value={item.token}
              onChange={e => setTokenReqs(items => items.map((row, i) => i === index ? { ...row, token: e.target.value } : row))}
              placeholder="Token address"
              className="owner-input"
              style={{ flex: 1, fontFamily: 'monospace', fontSize: 12 }}
              disabled={disabled || locked}
            />
            <input
              type="number"
              min="0"
              value={item.minAmount}
              onChange={e => setTokenReqs(items => items.map((row, i) => i === index ? { ...row, minAmount: e.target.value } : row))}
              placeholder="Min amount"
              className="owner-input"
              style={{ width: 110 }}
              disabled={disabled || locked}
            />
            <input
              value={item.specificTokenId}
              onChange={e => setTokenReqs(items => items.map((row, i) => i === index ? { ...row, specificTokenId: e.target.value } : row))}
              placeholder="Token ID bytes32"
              className="owner-input"
              style={{ flex: 1, fontFamily: 'monospace', fontSize: 12 }}
              disabled={disabled || locked}
            />
            <button
              type="button"
              onClick={() => setTokenReqs(items => items.filter((_, i) => i !== index))}
              disabled={disabled || locked}
              className="btn btn-secondary btn-sm btn-danger"
            >
              Remove
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setTokenReqs(items => [...items, { token: '', minAmount: '1', specificTokenId: ZERO_BYTES32 }])}
          disabled={disabled || locked}
          className="btn btn-secondary btn-sm"
          style={{ marginTop: 6 }}
        >
          Add Token
        </button>
      </div>

      <div className="owner-action-row" style={{ marginTop: 12 }}>
        <label className="text-caption"><input type="checkbox" checked={followUseOr} onChange={e => setFollowUseOr(e.target.checked)} disabled={disabled || locked} /> Follow OR</label>
        <label className="text-caption"><input type="checkbox" checked={erc725yUseOr} onChange={e => setErc725yUseOr(e.target.checked)} disabled={disabled || locked} /> ERC725Y OR</label>
        <label className="text-caption"><input type="checkbox" checked={tokenReqsUseOr} onChange={e => setTokenReqsUseOr(e.target.checked)} disabled={disabled || locked} /> Token OR</label>
        <label className="text-caption"><input type="checkbox" checked={useOr} onChange={e => setUseOr(e.target.checked)} disabled={disabled || locked} /> Groups OR</label>
      </div>

      <div className="owner-action-row" style={{ marginTop: 12 }}>
        <button
          type="button"
          onClick={() => onSave({
            followTargets: cleanFollowTargets,
            minBalance,
            minFollowing,
            minFollowers,
            erc725y: cleanErc725y,
            tokenReqs: cleanTokenReqs,
            followUseOr,
            erc725yUseOr,
            tokenReqsUseOr,
            useOr,
          })}
          disabled={disabled || locked || !isValid}
          className="btn btn-primary btn-sm"
        >
          Save {label} Conditions
        </button>
        <button
          type="button"
          onClick={() => {
            if (window.confirm(`Lock ${label.toLowerCase()} conditions permanently?`)) onLock();
          }}
          disabled={disabled || locked}
          className="btn btn-secondary btn-sm btn-danger"
        >
          Lock
        </button>
        {locked && <span className="text-caption">Locked</span>}
      </div>
    </div>
  );
}
