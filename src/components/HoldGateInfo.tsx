'use client';

import { useEffect, useState } from 'react';
import { ethers } from 'ethers';
import { CHAINS, GATE_ABI } from '@/config/tokens';
import { fetchProfileMeta } from '@/lib/useProfileMetadata';
import { YesIcon, NoIcon } from '@/components/Icons';

interface Props {
  gateAddress: `0x${string}`;
  chainId: number;
  userAddress: string | null;
  isSoulbound: boolean;
  isRevokable: boolean;
  onFollow?: (target: `0x${string}`) => Promise<void>;
}

interface ConditionRow {
  passed: boolean;
  label: string;
  progress: string;
}

function ConditionIcon({ passed }: { passed: boolean }) {
  const cls = passed ? 'status-icon--yes' : 'status-icon--no';
  return (
    <span className={cls}>
      {passed ? <YesIcon size={14} /> : <NoIcon size={14} />}
    </span>
  );
}

/**
 * Hold gate conditions as data-rows — matches Properties format exactly.
 * Only shown when a hold gate is configured (ActionCard verifies hasHoldGate).
 * Revokable is also shown only when holdGate is set (revokeByGate requires it).
 */
export function HoldGateInfo({ gateAddress, chainId, userAddress, isSoulbound, isRevokable, onFollow }: Props) {
  const [conditions, setConditions] = useState<ConditionRow[]>([]);
  const [followTarget, setFollowTarget] = useState<{ addr: `0x${string}`; name: string } | null>(null);
  const [isFollowPending, setIsFollowPending] = useState(false);

  useEffect(() => {
    if (!userAddress) return;
    let cancelled = false;
    setFollowTarget(null);

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
          const [followAddr, minBal, minFol, tokenReqs] = await Promise.all([
            rg.followTarget().catch(() => '0x0000000000000000000000000000000000000000'),
            rg.minNativeBalance().catch(() => BigInt(0)),
            rg.minFollowers().catch(() => BigInt(0)),
            rg.getTokenRequirements().catch(() => []),
          ]);

          const rows: ConditionRow[] = [];
          const ZERO = '0x0000000000000000000000000000000000000000';

          if (followAddr !== ZERO) {
            let ok = false;
            try {
              const lspIf = new ethers.Interface(['function isFollowing(address,address) view returns (bool)']);
              const data = lspIf.encodeFunctionData('isFollowing', [userAddress, followAddr]);
              const r = await p.call({ to: '0xf01103E5a9909Fc0DBe8166dA7085e0285daDDcA', data });
              ok = lspIf.decodeFunctionResult('isFollowing', r)[0];
            } catch {}

            // Resolve profile name via Envio
            let displayName = followAddr.slice(0, 6) + '…' + followAddr.slice(-4);
            try {
              const profile = await fetchProfileMeta(followAddr, chainId);
              if (profile?.name) displayName = profile.name;
            } catch {}

            if (!cancelled) {
              setFollowTarget({ addr: followAddr as `0x${string}`, name: displayName });
            }
            rows.push({ passed: ok, label: `Follow ${displayName}`, progress: ok ? 'Following' : 'Not following' });
          }

          const minBalNum = minBal as bigint;
          if (minBalNum > BigInt(0)) {
            const bal = await p.getBalance(userAddress);
            const ok = bal >= minBalNum;
            rows.push({
              passed: ok,
              label: `≥ ${ethers.formatEther(minBalNum).slice(0, 6)} LYX`,
              progress: ok ? `${ethers.formatEther(bal).slice(0, 6)} LYX` : `Need ${ethers.formatEther(minBalNum).slice(0, 6)} LYX`,
            });
          }

          const minFolNum = minFol as bigint;
          if (minFolNum > BigInt(0)) {
            let folCount = BigInt(0);
            try {
              const iface = new ethers.Interface(['function totalFollowersOf(address) view returns (uint256)']);
              const data = iface.encodeFunctionData('totalFollowersOf', [userAddress]);
              const r = await p.call({ to: '0xf01103E5a9909Fc0DBe8166dA7085e0285daDDcA', data });
              folCount = iface.decodeFunctionResult('totalFollowersOf', r)[0] as bigint;
            } catch {}
            const ok = folCount >= minFolNum;
            rows.push({ passed: ok, label: `≥ ${minFolNum} followers`, progress: `${folCount} / ${minFolNum}` });
          }

          const reqs = tokenReqs as { token: string; minAmount: bigint }[];
          for (const r of reqs) {
            let bal = BigInt(0);
            try {
              const iface = new ethers.Interface(['function balanceOf(address) view returns (uint256)']);
              const data = iface.encodeFunctionData('balanceOf', [userAddress]);
              const res = await p.call({ to: r.token, data });
              bal = iface.decodeFunctionResult('balanceOf', res)[0] as bigint;
            } catch {}
            const ok = bal >= r.minAmount;
            rows.push({ passed: ok, label: `Token ≥ ${r.minAmount}`, progress: ok ? 'Held' : `Need ${r.minAmount}` });
          }

          if (cancelled) return;
          setConditions(rows);
          return;
        }

        const [, label, progress] = await gate.check(userAddress);
        if (cancelled) return;
        setConditions([{ passed: false, label: label || gt, progress }]);
      } catch {
        if (!cancelled) setConditions([]);
      }
    })();

    return () => { cancelled = true; };
  }, [gateAddress, chainId, userAddress]);

  const handleFollow = async () => {
    if (!followTarget || !onFollow) return;
    setIsFollowPending(true);
    try {
      await onFollow(followTarget.addr);
    } finally {
      setIsFollowPending(false);
    }
  };

  return (
    <div>
      {conditions.length === 0 ? (
        <div className="data-row" style={{ border: 'none' }}>
          <span className="data-label" style={{ color: 'var(--c-text-secondary)' }}>
            Loading conditions...
          </span>
        </div>
      ) : (
        conditions.map((c, i) => (
          <div key={i} className="data-row" style={{ border: 'none' }}>
            <span className="data-label">{c.label}</span>
            <ConditionIcon passed={c.passed} />
            <span className="data-value">{c.progress}</span>
          </div>
        ))
      )}
      {followTarget && onFollow && conditions.find(c => c.label === `Follow ${followTarget.name}`)?.passed === false && (
        <div className="data-row" style={{ border: 'none' }}>
          <span />
          <span />
          <span className="data-value">
            <button
              className="btn btn-primary btn-sm"
              onClick={handleFollow}
              disabled={isFollowPending}
            >
              {isFollowPending ? 'Following…' : 'Follow'}
            </button>
          </span>
        </div>
      )}
      {isSoulbound && (
        <div className="data-row" style={{ border: 'none' }}>
          <span className="data-label">Soulbound</span>
          <span className="status-icon--yes"><YesIcon size={14} /></span>
          <span className="data-value">Not transferable</span>
        </div>
      )}
      {isRevokable && (
        <div className="data-row" style={{ border: 'none' }}>
          <span className="data-label">Revokable</span>
          <span className="status-icon--yes"><YesIcon size={14} /></span>
          <span className="data-value">Revocable if conditions unmet</span>
        </div>
      )}
    </div>
  );
}
