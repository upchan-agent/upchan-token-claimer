'use client';

import { useEffect, useState, useCallback } from 'react';
import { ethers } from 'ethers';
import { CHAINS, GATE_ABI, assetUrl, profileUrl } from '@/config/tokens';
import { YesIcon, NoIcon, DashIcon } from '@/components/Icons';

interface Props {
  /** Legacy: external gate contract address */
  gateAddress?: `0x${string}`;
  /** New: use token's embedded conditions instead of external gate */
  tokenProxy?: `0x${string}`;
  /** 'mint' or 'hold' — used with tokenProxy mode */
  mode?: 'mint' | 'hold';
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
  label: string;
  passed: boolean | null;
  linkDisplay?: string;
  linkUrl?: string;
  labelAfter?: string;
  inactive?: boolean;
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

const DEFAULTS_FOLLOW = [
  { label: 'Follow', passed: null, inactive: true },
  { label: '\u2265 0 LYX', passed: null, inactive: true },
  { label: '\u2265 0 Followers', passed: null, inactive: true },
];

const LOADING_ROWS: Row[] = [
  { label: 'Follow', passed: null, inactive: true },
  { label: '\u2265 0 LYX', passed: null, inactive: true },
  { label: '\u2265 0 Followers', passed: null, inactive: true },
  { label: 'Token', passed: null, inactive: true },
];

const TOKEN_CONDS_ABI = [
  'function getMintConditions() view returns (uint256,uint256,uint256,uint256,uint256,uint256,bool,bool,bool,bool,bool,uint256)',
  'function getHoldConditions() view returns (uint256,uint256,uint256,uint256,uint256,uint256,bool,bool,bool,bool,bool,uint256)',
  'function mintFollowTarget(uint256) view returns (address)',
  'function holdFollowTarget(uint256) view returns (address)',
  'function mintTokenReq(uint256) view returns (address,uint256,bytes32)',
  'function holdTokenReq(uint256) view returns (address,uint256,bytes32)',
];

/**
 * Build condition rows from the token's embedded conditions (new contract).
 */
async function buildRowsFromToken(
  tokenProxy: string,
  mode: 'mint' | 'hold',
  chainId: number,
  userAddress: string | null,
): Promise<{ rows: Row[]; followInfo: { addr: `0x${string}`; name: string } | null; isFollowing: boolean; hasConfig: boolean }> {
  const chain = CHAINS[chainId];
  if (!chain) return { rows: DEFAULTS_FOLLOW, followInfo: null, isFollowing: false, hasConfig: false };

  const p = new ethers.JsonRpcProvider(chain.rpc);
  const token = new ethers.Contract(tokenProxy, TOKEN_CONDS_ABI, p);
  const noUser = !userAddress;

  // Fetch conditions
  const conds = await (mode === 'mint' ? token.getMintConditions() : token.getHoldConditions()).catch(
    () => [0n, 0n, 0n, 0n, 0n, 0n, false, false, false, false, false, 0n],
  );
  const [ftCount, minBal, minFol, minFolCount, , tReqCount] = conds as bigint[];

  // Fetch follow target
  const followTargetFn = mode === 'mint' ? 'mintFollowTarget' : 'holdFollowTarget';
  let followAddr: string = ZERO;
  if (Number(ftCount) > 0) {
    try {
      followAddr = await token[followTargetFn](0);
    } catch { /* no follow target */ }
  }

  // Fetch token requirements
  const tokenReqFn = mode === 'mint' ? 'mintTokenReq' : 'holdTokenReq';
  const tReqs: { token: string; minAmount: bigint }[] = [];
  for (let i = 0; i < Number(tReqCount); i++) {
    try {
      const [tAddr, tAmt] = await token[tokenReqFn](i);
      tReqs.push({ token: tAddr as string, minAmount: tAmt as bigint });
    } catch { break; }
  }

  const hasConfigData = followAddr !== ZERO || Number(minBal) > 0n || Number(minFol) > 0n || tReqs.length > 0;
  const rows: Row[] = [];
  let followInfo: { addr: `0x${string}`; name: string } | null = null;
  let isFollowing = false;

  // ─── Follow ───
  if (followAddr !== ZERO) {
    let name = followAddr.slice(0, 6) + '…' + followAddr.slice(-4);
    try {
      const pn = await fetchProfileName(followAddr, chainId);
      if (pn) name = pn;
    } catch {}
    let fOk = false;
    if (!noUser) {
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
    });
  } else {
    rows.push({ label: 'Follow', passed: null, inactive: true });
  }

  // ─── LYX Balance ───
  const minBalNum = minBal as bigint;
  if (minBalNum > 0n) {
    const lyxStr = ethers.formatEther(minBalNum).slice(0, 6);
    if (noUser) {
      rows.push({ label: `\u2265 ${lyxStr} LYX`, passed: null });
    } else {
      const bal = await p.getBalance(userAddress);
      rows.push({ label: `\u2265 ${lyxStr} LYX`, passed: bal >= minBalNum });
    }
  } else {
    rows.push({ label: '\u2265 0 LYX', passed: null, inactive: true });
  }

  // ─── Followers ───
  const minFolNum = minFol as bigint;
  if (minFolNum > 0n) {
    if (noUser) {
      rows.push({ label: `\u2265 ${minFolNum} Followers`, passed: null });
    } else {
      let count = BigInt(0);
      try {
        const iface = new ethers.Interface(['function totalFollowersOf(address) view returns (uint256)']);
        const data = iface.encodeFunctionData('totalFollowersOf', [userAddress]);
        const r = await p.call({ to: '0xf01103E5a9909Fc0DBe8166dA7085e0285daDDcA', data });
        count = iface.decodeFunctionResult('totalFollowersOf', r)[0] as bigint;
      } catch {}
      rows.push({ label: `\u2265 ${minFolNum} Followers`, passed: count >= minFolNum });
    }
  } else {
    rows.push({ label: '\u2265 0 Followers', passed: null, inactive: true });
  }

  // ─── Token Requirements ───
  if (tReqs.length > 0) {
    const symbols = await Promise.all(tReqs.map(r => fetchAssetSymbol(r.token, chainId)));
    for (let i = 0; i < tReqs.length; i++) {
      const r = tReqs[i];
      const sym = symbols[i] || r.token.slice(0, 6) + '…' + r.token.slice(-4);
      if (noUser) {
        rows.push({
          label: `\u2265 ${r.minAmount} `,
          linkDisplay: sym,
          linkUrl: assetUrl(r.token, chainId),
          passed: null,
        });
      } else {
        let bal = BigInt(0);
        try {
          const iface = new ethers.Interface(['function balanceOf(address) view returns (uint256)']);
          const data = iface.encodeFunctionData('balanceOf', [userAddress]);
          const res = await p.call({ to: r.token, data });
          bal = iface.decodeFunctionResult('balanceOf', res)[0] as bigint;
        } catch {}
        rows.push({
          label: `\u2265 ${r.minAmount} `,
          linkDisplay: sym,
          linkUrl: assetUrl(r.token, chainId),
          passed: bal >= r.minAmount,
        });
      }
    }
  }

  return { rows, followInfo, isFollowing, hasConfig: hasConfigData };
}

/**
 * Build condition rows from an external RequirementsGate contract (legacy).
 */
async function buildRowsFromGate(
  gateAddress: string,
  chainId: number,
  userAddress: string | null,
): Promise<{ rows: Row[]; followInfo: { addr: `0x${string}`; name: string } | null; isFollowing: boolean; hasConfig: boolean }> {
  const chain = CHAINS[chainId];
  if (!chain) return { rows: DEFAULTS_FOLLOW, followInfo: null, isFollowing: false, hasConfig: false };

  const p = new ethers.JsonRpcProvider(chain.rpc);
  const gate = new ethers.Contract(gateAddress, GATE_ABI, p);
  const gt: string = await gate.gateType();
  const noUser = !userAddress;

  if (gt !== 'requirements') {
    if (noUser) return { rows: DEFAULTS_FOLLOW, followInfo: null, isFollowing: false, hasConfig: false };
    const [, checkLabel] = await gate.check(userAddress);
    return { rows: [{ label: checkLabel, passed: false }], followInfo: null, isFollowing: false, hasConfig: true };
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

  // Build rows (same logic as before — copied from embedded for consistency)
  if (followAddr !== ZERO) {
    let name = followAddr.slice(0, 6) + '…' + followAddr.slice(-4);
    try {
      const pn = await fetchProfileName(followAddr, chainId);
      if (pn) name = pn;
    } catch {}
    let fOk = false;
    if (!noUser) {
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
      passed: noUser ? null : fOk,
    });
  } else {
    rows.push({ label: 'Follow', passed: null, inactive: true });
  }

  if (minBalNum > 0n) {
    const lyxStr = ethers.formatEther(minBalNum).slice(0, 6);
    if (noUser) {
      rows.push({ label: `\u2265 ${lyxStr} LYX`, passed: null });
    } else {
      const bal = await p.getBalance(userAddress);
      rows.push({ label: `\u2265 ${lyxStr} LYX`, passed: bal >= minBalNum });
    }
  } else {
    rows.push({ label: '\u2265 0 LYX', passed: null, inactive: true });
  }

  if (minFolNum > 0n) {
    if (noUser) {
      rows.push({ label: `\u2265 ${minFolNum} Followers`, passed: null });
    } else {
      let count = BigInt(0);
      try {
        const iface = new ethers.Interface(['function totalFollowersOf(address) view returns (uint256)']);
        const data = iface.encodeFunctionData('totalFollowersOf', [userAddress]);
        const r = await p.call({ to: '0xf01103E5a9909Fc0DBe8166dA7085e0285daDDcA', data });
        count = iface.decodeFunctionResult('totalFollowersOf', r)[0] as bigint;
      } catch {}
      rows.push({ label: `\u2265 ${minFolNum} Followers`, passed: count >= minFolNum });
    }
  } else {
    rows.push({ label: '\u2265 0 Followers', passed: null, inactive: true });
  }

  if (reqs.length > 0) {
    const symbols = await Promise.all(reqs.map(r => fetchAssetSymbol(r.token, chainId)));
    for (let i = 0; i < reqs.length; i++) {
      const r = reqs[i];
      const sym = symbols[i] || r.token.slice(0, 6) + '…' + r.token.slice(-4);
      if (noUser) {
        rows.push({
          label: `\u2265 ${r.minAmount} `,
          linkDisplay: sym,
          linkUrl: assetUrl(r.token, chainId),
          passed: null,
        });
      } else {
        let bal = BigInt(0);
        try {
          const iface = new ethers.Interface(['function balanceOf(address) view returns (uint256)']);
          const data = iface.encodeFunctionData('balanceOf', [userAddress]);
          const res = await p.call({ to: r.token, data });
          bal = iface.decodeFunctionResult('balanceOf', res)[0] as bigint;
        } catch {}
        rows.push({
          label: `\u2265 ${r.minAmount} `,
          linkDisplay: sym,
          linkUrl: assetUrl(r.token, chainId),
          passed: bal >= r.minAmount,
        });
      }
    }
  }

  return { rows, followInfo, isFollowing, hasConfig: hasConfigData };
}

export function GateConditions({ gateAddress, tokenProxy, mode, chainId, userAddress, label, onFollow }: Props) {
  const [rows, setRows] = useState<Row[]>(LOADING_ROWS);
  const [followInfo, setFollowInfo] = useState<{ addr: `0x${string}`; name: string } | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [hasConfig, setHasConfig] = useState(false);
  const [loading, setLoading] = useState(true);
  const [followPending, setFollowPending] = useState(false);

  // Determine data source: new contract (tokenProxy + mode) or legacy (gateAddress)
  const useNew = !!tokenProxy && !!mode;
  const activeAddress = useNew ? tokenProxy! : (gateAddress || ZERO);
  const noGate = activeAddress === ZERO;
  const isEmpty = !noGate && !loading && !hasConfig;

  useEffect(() => {
    if (noGate) { setLoading(false); setRows(DEFAULTS_FOLLOW); return; }

    let cancelled = false;
    setLoading(true);
    setFollowInfo(null);
    setIsFollowing(false);

    (async () => {
      try {
        const result = useNew
          ? await buildRowsFromToken(tokenProxy!, mode!, chainId, userAddress)
          : await buildRowsFromGate(gateAddress!, chainId, userAddress);
        if (cancelled) return;
        setRows(result.rows);
        setFollowInfo(result.followInfo);
        setIsFollowing(result.isFollowing);
        setHasConfig(result.hasConfig);
        setLoading(false);
      } catch {
        if (!cancelled) { setLoading(false); setRows(DEFAULTS_FOLLOW); setHasConfig(false); }
      }
    })();

    return () => { cancelled = true; };
  }, [activeAddress, useNew, tokenProxy, mode, gateAddress, chainId, userAddress, noGate]);

  const handleFollow = useCallback(async () => {
    if (!followInfo || !onFollow) return;
    setFollowPending(true);
    try { await onFollow(followInfo.addr); } finally { setFollowPending(false); }
  }, [followInfo, onFollow]);

  return (
    <div className="conditions-block">
      <span className="conditions-group-header">{label}</span>
      {LOADING_ROWS.map((template, i) => {
        const actualRow = !noGate && !loading && !isEmpty && rows[i] ? rows[i] : null;
        return (
          <ConditionRow
            key={i}
            label={actualRow?.label ?? template.label}
            passed={actualRow?.passed ?? null}
            inactive={actualRow ? actualRow.inactive : template.inactive}
            linkDisplay={actualRow?.linkDisplay}
            linkUrl={actualRow?.linkUrl}
            followInfo={followInfo && i === 0 && actualRow ? followInfo : null}
            onFollow={i === 0 && actualRow ? handleFollow : undefined}
            followPending={i === 0 && followPending}
          />
        );
      })}
      {!noGate && !loading && !isEmpty && rows.length > 4 && rows.slice(4).map((r, i) => (
        <ConditionRow key={'x' + i} {...r} />
      ))}
    </div>
  );
}

// ─── Condition row component ───

function ConditionRow({ label, passed, linkDisplay, linkUrl, inactive, followInfo, onFollow, followPending }: Row & {
  followInfo?: { addr: `0x${string}`; name: string } | null;
  onFollow?: () => Promise<void>;
  followPending?: boolean;
}) {
  const showFollow = followInfo && passed === false && onFollow;

  return (
    <div className="condition-row">
      <span className={`data-label${inactive ? ' data-label--muted' : ''}`}>
        {label}
        {linkDisplay && linkUrl ? (
          <a href={linkUrl} target="_blank" rel="noopener noreferrer" className="link">{linkDisplay}</a>
        ) : null}
      </span>
      <span className="condition-row__right">
        <StatusIcon value={passed} />
        {showFollow && (
          <button onClick={onFollow} disabled={followPending} className="btn btn-primary btn-follow">
            Follow
          </button>
        )}
      </span>
    </div>
  );
}
