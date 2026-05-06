'use client';

import { useEffect, useState, useCallback } from 'react';
import { ethers } from 'ethers';
import { CHAINS, GATE_ABI } from '@/config/tokens';
import { fetchProfileMeta } from '@/lib/useProfileMetadata';
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
  if (value === null) {
    return <span className="status-icon--none"><DashIcon size={size} /></span>;
  }
  return (
    <span className={value ? 'status-icon--yes' : 'status-icon--no'}>
      {value ? <YesIcon size={size} /> : <NoIcon size={size} />}
    </span>
  );
}

export function GateConditions({ gateAddress, chainId, userAddress, label, onFollow }: Props) {
  const [followTarget, setFollowTarget] = useState<{ addr: `0x${string}`; name: string } | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [lyxConfig, setLyxConfig] = useState<{ required: bigint; userBal: bigint } | null>(null);
  const [folConfig, setFolConfig] = useState<{ required: bigint; userCount: bigint } | null>(null);
  const [tokenReqs, setTokenReqs] = useState<{ label: string; ok: boolean; display: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [followPending, setFollowPending] = useState(false);

  const noGate = gateAddress === ZERO;

  useEffect(() => {
    if (noGate) { setLoading(false); return; }
    if (!userAddress) { setLoading(false); return; }

    let cancelled = false;
    setLoading(true);
    setFollowTarget(null);
    setLyxConfig(null);
    setFolConfig(null);
    setTokenReqs([]);

    (async () => {
      try {
        const chain = CHAINS[chainId];
        if (!chain) return;
        const p = new ethers.JsonRpcProvider(chain.rpc);
        const gate = new ethers.Contract(gateAddress, GATE_ABI, p);
        const gt: string = await gate.gateType();

        if (gt === 'requirements') {
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

          // Follow
          if (followAddr !== ZERO) {
            let fOk = false;
            try {
              const iface = new ethers.Interface(['function isFollowing(address,address) view returns (bool)']);
              const data = iface.encodeFunctionData('isFollowing', [userAddress, followAddr]);
              const r = await p.call({ to: '0xf01103E5a9909Fc0DBe8166dA7085e0285daDDcA', data });
              fOk = iface.decodeFunctionResult('isFollowing', r)[0];
            } catch {}

            let name = followAddr.slice(0, 6) + '…' + followAddr.slice(-4);
            try { const m = await fetchProfileMeta(followAddr, chainId); if (m?.name) name = m.name; } catch {}

            if (!cancelled) {
              setFollowTarget({ addr: followAddr as `0x${string}`, name });
              setIsFollowing(fOk);
            }
          }

          // LYX
          const minBalNum = minBal as bigint;
          if (minBalNum > 0n) {
            const bal = await p.getBalance(userAddress);
            if (!cancelled) setLyxConfig({ required: minBalNum, userBal: bal });
          }

          // Followers
          const minFolNum = minFol as bigint;
          if (minFolNum > 0n) {
            let count = BigInt(0);
            try {
              const iface = new ethers.Interface(['function totalFollowersOf(address) view returns (uint256)']);
              const data = iface.encodeFunctionData('totalFollowersOf', [userAddress]);
              const r = await p.call({ to: '0xf01103E5a9909Fc0DBe8166dA7085e0285daDDcA', data });
              count = iface.decodeFunctionResult('totalFollowersOf', r)[0] as bigint;
            } catch {}
            if (!cancelled) setFolConfig({ required: minFolNum, userCount: count });
          }

          // Token requirements
          const reqs = tokens as { token: string; minAmount: bigint }[];
          if (reqs.length > 0) {
            const results = await Promise.all(reqs.map(async (r) => {
              let bal = BigInt(0);
              try {
                const iface = new ethers.Interface(['function balanceOf(address) view returns (uint256)']);
                const data = iface.encodeFunctionData('balanceOf', [userAddress]);
                const res = await p.call({ to: r.token, data });
                bal = iface.decodeFunctionResult('balanceOf', res)[0] as bigint;
              } catch {}
              const ok = bal >= r.minAmount;
              return {
                label: `${r.token.slice(0, 6)}…${r.token.slice(-4)} \u2265 ${r.minAmount}`,
                ok,
                display: ok ? `Held` : `Need ${r.minAmount}`,
              };
            }));
            if (!cancelled) setTokenReqs(results);
          }
        } else {
          // Fallback: non-requirements gate — just show check result
          const [, checkLabel, progress] = await gate.check(userAddress);
          if (!cancelled) {
            setFollowTarget(null);
            setIsFollowing(false);
            setLyxConfig({ required: BigInt(1), userBal: BigInt(0) }); // dummy: always show
            setFolConfig(null);
            setTokenReqs([{ label: checkLabel, ok: false, display: progress }]);
          }
        }

        if (!cancelled) setLoading(false);
      } catch {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [gateAddress, chainId, userAddress, noGate]);

  const handleFollow = useCallback(async () => {
    if (!followTarget || !onFollow) return;
    setFollowPending(true);
    try {
      await onFollow(followTarget.addr);
    } finally {
      setFollowPending(false);
    }
  }, [followTarget, onFollow]);

  const hasConditions = followTarget || lyxConfig || folConfig || tokenReqs.length > 0;

  return (
    <div className="conditions-block">
      <span className="conditions-group-header">{label}</span>
      <div className="conditions-group">
        {noGate || (!loading && !hasConditions) ? (
          <div className="data-row" style={{ border: 'none' }}>
            <span className="data-label" style={{ color: 'var(--c-text-secondary)' }}>
              {noGate ? 'No restrictions' : 'No conditions set'}
            </span>
            <StatusIcon value={null} />
            <span className="data-value" style={{ color: 'var(--c-text-tertiary)' }}>-</span>
          </div>
        ) : loading ? (
          <div className="data-row" style={{ border: 'none' }}>
            <span className="data-label text-caption" style={{ color: 'var(--c-text-tertiary)' }}>Loading...</span>
          </div>
        ) : (
          <>
            {/* Follow */}
            <div>
              <div className="data-row" style={{ border: 'none' }}>
                <span className="data-label">
                  {followTarget ? `Follow ${followTarget.name}` : 'Follow'}
                </span>
                <StatusIcon value={followTarget ? isFollowing : null} />
                <span className="data-value">
                  {followTarget ? (isFollowing ? 'Following' : 'Not following') : '-'}
                </span>
              </div>
              {followTarget && !isFollowing && onFollow && (
                <div className="data-row" style={{ border: 'none', marginTop: 2 }}>
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

            {/* LYX */}
            {lyxConfig ? (
              <div className="data-row" style={{ border: 'none' }}>
                <span className="data-label">
                  {'\u2265'} {ethers.formatEther(lyxConfig.required).slice(0, 6)} LYX
                </span>
                <StatusIcon value={lyxConfig.userBal >= lyxConfig.required} />
                <span className="data-value">
                  {lyxConfig.userBal >= lyxConfig.required
                    ? `${ethers.formatEther(lyxConfig.userBal).slice(0, 6)} LYX`
                    : `Need ${ethers.formatEther(lyxConfig.required).slice(0, 6)} LYX`}
                </span>
              </div>
            ) : (
              <div className="data-row" style={{ border: 'none' }}>
                <span className="data-label">{'\u2265'} LYX</span>
                <StatusIcon value={null} />
                <span className="data-value">-</span>
              </div>
            )}

            {/* Followers */}
            {folConfig ? (
              <div className="data-row" style={{ border: 'none' }}>
                <span className="data-label">{'\u2265'} {String(folConfig.required)} followers</span>
                <StatusIcon value={folConfig.userCount >= folConfig.required} />
                <span className="data-value">{String(folConfig.userCount)} / {String(folConfig.required)}</span>
              </div>
            ) : (
              <div className="data-row" style={{ border: 'none' }}>
                <span className="data-label">{'\u2265'} Followers</span>
                <StatusIcon value={null} />
                <span className="data-value">-</span>
              </div>
            )}

            {/* Token requirements */}
            {tokenReqs.map((t, i) => (
              <div key={i} className="data-row" style={{ border: 'none' }}>
                <span className="data-label">{t.label}</span>
                <StatusIcon value={t.ok} />
                <span className="data-value">{t.display}</span>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
