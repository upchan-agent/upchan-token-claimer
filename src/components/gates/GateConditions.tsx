'use client';

import { useEffect, useState, useCallback } from 'react';
import { ethers } from 'ethers';
import { CHAINS, GATE_ABI, assetUrl, profileUrl } from '@/config/tokens';
import { YesIcon, NoIcon, DashIcon } from '@/components/Icons';

interface Props {
  gateAddress: `0x${string}`;
  chainId: number;
  userAddress: string | null;
  label: string;
  onFollow?: (target: `0x${string}`) => Promise<void>;
}

const ZERO = '0x0000000000000000000000000000000000000000';

function StatusIcon({ value }: { value: boolean | null }) {
  const size = 14;
  if (value === null) return <span className="status-icon--none"><DashIcon size={size} /></span>;
  return (
    <span className={value ? 'status-icon--yes' : 'status-icon--no'}>
      {value ? <YesIcon size={size} /> : <NoIcon size={size} />}
    </span>
  );
}

interface Row {
  label: string;              // Static label prefix, e.g. "Follow " or "Token: "
  passed: boolean | null;
  value: string;
  linkDisplay?: string;       // Clickable name text, e.g. "🆙chan" or "LYS"
  linkUrl?: string;           // URL for the name link
  labelAfter?: string;        // Text after the link, e.g. " ≥ 1"
}

/** Fetch profile name from Envio Profile table. */
async function fetchProfileName(address: string, chainId: number): Promise<string | null> {
  const ENVIO_URLS: Record<number, string> = {
    42: 'https://envio.lukso-mainnet.universal.tech/v1/graphql',
    4201: 'https://envio.lukso-testnet.universal.tech/v1/graphql',
  };
  const url = ENVIO_URLS[chainId];
  if (!url) return null;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `{Profile(where:{id:{_eq:"${address.toLowerCase()}"}}){name}}`,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const n = json?.data?.Profile?.[0]?.name;
    return n || null;
  } catch {
    return null;
  }
}

/** Fetch token symbol from Envio Asset table. */
async function fetchAssetSymbol(address: string, chainId: number): Promise<string | null> {
  const ENVIO_URLS: Record<number, string> = {
    42: 'https://envio.lukso-mainnet.universal.tech/v1/graphql',
    4201: 'https://envio.lukso-testnet.universal.tech/v1/graphql',
  };
  const url = ENVIO_URLS[chainId];
  if (!url) return null;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `{Asset(where:{id:{_eq:"${address.toLowerCase()}"}}){lsp4TokenSymbol}}`,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const sym = json?.data?.Asset?.[0]?.lsp4TokenSymbol;
    return sym || null;
  } catch {
    return null;
  }
}

/** Build rows from gate config, evaluated against userAddress (or null → no eval). */
async function buildRows(
  gateAddress: string,
  chainId: number,
  userAddress: string | null,
): Promise<{ rows: Row[]; followInfo: { addr: `0x${string}`; name: string } | null; isFollowing: boolean; hasConfig: boolean }> {
  const chain = CHAINS[chainId];
  if (!chain) return { rows: defaultRows(), followInfo: null, isFollowing: false, hasConfig: false };

  const p = new ethers.JsonRpcProvider(chain.rpc);
  const gate = new ethers.Contract(gateAddress, GATE_ABI, p);
  const gt: string = await gate.gateType();
  const noUser = !userAddress;

  if (gt !== 'requirements') {
    if (noUser) return { rows: defaultRows(), followInfo: null, isFollowing: false, hasConfig: false };
    const [, checkLabel, progress] = await gate.check(userAddress);
    return { rows: [{ label: checkLabel, passed: false, value: progress }], followInfo: null, isFollowing: false, hasConfig: true };
  }

  const REQ_ABI = [
    'function followTarget() view returns (address)',
    'function minNativeBalance() view returns (uint256)',
    'function minFollowers() view returns (uint256)',
    'function getTokenRequirements() view returns ((address token, uint256 minAmount)[])',
  ];
  const rg = new ethers.Contract(gateAddress, REQ_ABI, p);
  const [followAddr, minBal, minFol, tokens] = await Promise.all([
    rg.followTarget().catch(() => ZERO),
    rg.minNativeBalance().catch(() => BigInt(0)),
    rg.minFollowers().catch(() => BigInt(0)),
    rg.getTokenRequirements().catch(() => []),
  ]);

  const minBalNum = minBal as bigint;
  const minFolNum = minFol as bigint;
  const reqs = tokens as { token: string; minAmount: bigint }[];
  const hasConfigData = followAddr !== ZERO || minBalNum > 0n || minFolNum > 0n || reqs.length > 0;

  const rows: Row[] = [];
  let followInfo: { addr: `0x${string}`; name: string } | null = null;
  let isFollowing = false;

  // ─── Follow ───
  if (followAddr !== ZERO) {
    let name = followAddr.slice(0, 6) + '…' + followAddr.slice(-4);
    let fOk = false;
    if (!noUser) {
      try {
        const pn = await fetchProfileName(followAddr, chainId);
        if (pn) name = pn;
      } catch {}
      try {
        const iface = new ethers.Interface(['function isFollowing(address,address) view returns (bool)']);
        const data = iface.encodeFunctionData('isFollowing', [userAddress, followAddr]);
        const r = await p.call({ to: '0xf01103E5a9909Fc0DBe8166dA7085e0285daDDcA', data });
        fOk = iface.decodeFunctionResult('isFollowing', r)[0];
      } catch {}
    }
    followInfo = { addr: followAddr as `0x${string}`, name };
    isFollowing = fOk;
    rows.push({
      label: 'Follow ',
      linkDisplay: name,
      linkUrl: profileUrl(followAddr),
      labelAfter: '',
      passed: noUser ? null : fOk,
      value: noUser ? '-' : (fOk ? 'Following' : 'Not following'),
    });
  } else {
    rows.push({ label: 'Follow', passed: null, value: '-' });
  }

  // ─── LYX Balance ───
  if (minBalNum > 0n) {
    const lyxStr = ethers.formatEther(minBalNum).slice(0, 6);
    if (noUser) {
      rows.push({ label: `\u2265 ${lyxStr} LYX`, passed: null, value: '-' });
    } else {
      const bal = await p.getBalance(userAddress);
      rows.push({
        label: `\u2265 ${lyxStr} LYX`,
        passed: bal >= minBalNum,
        value: bal >= minBalNum ? `${ethers.formatEther(bal).slice(0, 6)} LYX` : `Need ${lyxStr} LYX`,
      });
    }
  } else {
    rows.push({ label: '\u2265 LYX', passed: null, value: '-' });
  }

  // ─── Followers ───
  if (minFolNum > 0n) {
    if (noUser) {
      rows.push({ label: `\u2265 ${minFolNum} followers`, passed: null, value: '-' });
    } else {
      let count = BigInt(0);
      try {
        const iface = new ethers.Interface(['function totalFollowersOf(address) view returns (uint256)']);
        const data = iface.encodeFunctionData('totalFollowersOf', [userAddress]);
        const r = await p.call({ to: '0xf01103E5a9909Fc0DBe8166dA7085e0285daDDcA', data });
        count = iface.decodeFunctionResult('totalFollowersOf', r)[0] as bigint;
      } catch {}
      rows.push({ label: `\u2265 ${minFolNum} followers`, passed: count >= minFolNum, value: `${count} / ${minFolNum}` });
    }
  } else {
    rows.push({ label: '\u2265 Followers', passed: null, value: '-' });
  }

  // ─── Token Requirements ───
  if (reqs.length > 0) {
    const symbols = await Promise.all(reqs.map(r => fetchAssetSymbol(r.token, chainId)));
    for (let i = 0; i < reqs.length; i++) {
      const r = reqs[i];
      const sym = symbols[i] || r.token.slice(0, 6) + '…' + r.token.slice(-4);
      if (noUser) {
        rows.push({
          label: 'Token: ',
          linkDisplay: sym,
          linkUrl: assetUrl(r.token, chainId),
          labelAfter: ` \u2265 ${r.minAmount}`,
          passed: null,
          value: '-',
        });
      } else {
        let bal = BigInt(0);
        try {
          const iface = new ethers.Interface(['function balanceOf(address) view returns (uint256)']);
          const data = iface.encodeFunctionData('balanceOf', [userAddress]);
          const res = await p.call({ to: r.token, data });
          bal = iface.decodeFunctionResult('balanceOf', res)[0] as bigint;
        } catch {}
        const ok = bal >= r.minAmount;
        rows.push({
          label: 'Token: ',
          linkDisplay: sym,
          linkUrl: assetUrl(r.token, chainId),
          labelAfter: ` \u2265 ${r.minAmount}`,
          passed: ok,
          value: ok ? 'Held' : `Need ${r.minAmount}`,
        });
      }
    }
  }

  return { rows, followInfo, isFollowing, hasConfig: hasConfigData };
}

function defaultRows(): Row[] {
  return [
    { label: 'Follow', passed: null, value: '-' },
    { label: '\u2265 LYX', passed: null, value: '-' },
    { label: '\u2265 Followers', passed: null, value: '-' },
  ];
}

const LOADING_ROWS: Row[] = [
  { label: 'Follow', passed: null, value: '-' },
  { label: '\u2265 LYX', passed: null, value: '-' },
  { label: '\u2265 Followers', passed: null, value: '-' },
  { label: 'Token:', passed: null, value: '-' },
];

export function GateConditions({ gateAddress, chainId, userAddress, label, onFollow }: Props) {
  const [rows, setRows] = useState<Row[]>(LOADING_ROWS);
  const [followInfo, setFollowInfo] = useState<{ addr: `0x${string}`; name: string } | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [hasConfig, setHasConfig] = useState(false);
  const [loading, setLoading] = useState(true);
  const [followPending, setFollowPending] = useState(false);

  const noGate = gateAddress === ZERO;
  const isEmpty = !noGate && !loading && !hasConfig;

  useEffect(() => {
    if (noGate) { setLoading(false); setRows(defaultRows()); return; }

    let cancelled = false;
    setLoading(true);
    setFollowInfo(null);
    setIsFollowing(false);

    (async () => {
      try {
        const result = await buildRows(gateAddress, chainId, userAddress);
        if (cancelled) return;
        setRows(result.rows);
        setFollowInfo(result.followInfo);
        setIsFollowing(result.isFollowing);
        setHasConfig(result.hasConfig);
        setLoading(false);
      } catch {
        if (!cancelled) { setLoading(false); setRows(defaultRows()); setHasConfig(false); }
      }
    })();

    return () => { cancelled = true; };
  }, [gateAddress, chainId, userAddress, noGate]);

  const handleFollow = useCallback(async () => {
    if (!followInfo || !onFollow) return;
    setFollowPending(true);
    try { await onFollow(followInfo.addr); } finally { setFollowPending(false); }
  }, [followInfo, onFollow]);

  // ═══ Render: priority order — noGate → loading → isEmpty → normal ═══

  if (noGate) {
    return (
      <div className="conditions-block">
        <span className="conditions-group-header">{label}</span>
        <div className="conditions-group">
          <div className="data-row" style={{ border: 'none' }}>
            <span className="data-label" style={{ color: 'var(--c-text-secondary)' }}>No restrictions</span>
            <StatusIcon value={null} />
            <span className="data-value" style={{ color: 'var(--c-text-tertiary)' }}>-</span>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="conditions-block">
        <span className="conditions-group-header">{label}</span>
        <div className="conditions-group">
          {LOADING_ROWS.map((r, i) => (
            <div key={i} className="data-row" style={{ border: 'none' }}>
              <span className="data-label" style={{ color: 'var(--c-text-tertiary)' }}>{r.label}</span>
              <StatusIcon value={null} />
              <span className="data-value" style={{ color: 'var(--c-text-tertiary)' }}>-</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="conditions-block">
        <span className="conditions-group-header">{label}</span>
        <div className="conditions-group">
          <div className="data-row" style={{ border: 'none' }}>
            <span className="data-label" style={{ color: 'var(--c-text-secondary)' }}>No conditions set</span>
            <StatusIcon value={null} />
            <span className="data-value" style={{ color: 'var(--c-text-tertiary)' }}>-</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="conditions-block">
      <span className="conditions-group-header">{label}</span>
      <div className="conditions-group">
        {rows.map((r, i) => (
          <div key={i}>
            <div className="data-row" style={{ border: 'none' }}>
              <span className="data-label">
                {r.label}
                {r.linkDisplay && r.linkUrl ? (
                  <a href={r.linkUrl} target="_blank" rel="noopener noreferrer" className="link">{r.linkDisplay}</a>
                ) : null}
                {r.labelAfter}
              </span>
              <StatusIcon value={r.passed} />
              <span className="data-value">
                {followInfo && i === 0 && r.passed === false && onFollow ? '' : r.value}
              </span>
            </div>
            {followInfo && i === 0 && r.passed === false && onFollow && (
              <div className="data-row" style={{ border: 'none' }}>
                <span className="data-label" />
                <span />
                <span className="data-value">
                  <button
                    onClick={handleFollow}
                    disabled={followPending}
                    className="btn btn-primary btn-sm"
                    style={{ fontSize: 12, padding: '2px 10px' }}
                  >
                    {followPending ? 'Following…' : 'Follow'}
                  </button>
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
