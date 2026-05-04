'use client';

import { useEffect, useState } from 'react';
import { ethers } from 'ethers';
import { CHAINS, GATE_ABI } from '@/config/tokens';

interface Props {
  gateAddress: `0x${string}`;
  chainId: number;
  userAddress: string | null;
  isSoulbound: boolean;
  isRevokable: boolean;
}

interface ConditionRow {
  passed: boolean;
  label: string;
  progress: string;
}

/**
 * Displays hold gate conditions as simple text rows.
 * Uses the gate's `check()` function and parses progress for individual items.
 * Does NOT render ProfileCard or follow buttons — those are for mint conditions only.
 */
export function HoldGateInfo({ gateAddress, chainId, userAddress, isSoulbound, isRevokable }: Props) {
  const [conditions, setConditions] = useState<ConditionRow[]>([]);
  const [gateType, setGateType] = useState<string | null>(null);

  useEffect(() => {
    if (!userAddress) return;
    let cancelled = false;

    (async () => {
      try {
        const chain = CHAINS[chainId];
        if (!chain) return;
        const p = new ethers.JsonRpcProvider(chain.rpc);
        const gate = new ethers.Contract(gateAddress, GATE_ABI, p);

        // 1. Detect gate type
        const gt: string = await gate.gateType();
        if (cancelled) return;
        setGateType(gt);

        // 2. RequirementsGate: parse individual conditions from getters
        if (gt === 'requirements') {
          const REQ_ABI = [
            'function followTarget() view returns (address)',
            'function minNativeBalance() view returns (uint256)',
            'function minFollowers() view returns (uint256)',
            'function getTokenRequirements() view returns ((address token, uint256 minAmount)[])',
            'function useOr() view returns (bool)',
          ];
          const rg = new ethers.Contract(gateAddress, REQ_ABI, p);
          const [followTarget, minBal, minFol, tokenReqs, useOr] = await Promise.all([
            rg.followTarget().catch(() => '0x0000000000000000000000000000000000000000'),
            rg.minNativeBalance().catch(() => BigInt(0)),
            rg.minFollowers().catch(() => BigInt(0)),
            rg.getTokenRequirements().catch(() => []),
            rg.useOr().catch(() => false),
          ]);

          const rows: ConditionRow[] = [];

          // Follow condition
          if (followTarget !== '0x0000000000000000000000000000000000000000') {
            let ok = false;
            try {
              const lspIf = new ethers.Interface(['function isFollowing(address,address) view returns (bool)']);
              const data = lspIf.encodeFunctionData('isFollowing', [userAddress, followTarget]);
              const r = await p.call({ to: '0xf01103E5a9909Fc0DBe8166dA7085e0285daDDcA', data });
              ok = lspIf.decodeFunctionResult('isFollowing', r)[0];
            } catch {}
            rows.push({
              passed: ok,
              label: 'Follow',
              progress: ok ? 'Following ✓' : 'Not following',
            });
          }

          // LYX balance
          const minBalNum = minBal as bigint;
          if (minBalNum > BigInt(0)) {
            const bal = await p.getBalance(userAddress);
            const ok = bal >= minBalNum;
            rows.push({
              passed: ok,
              label: `≥ ${ethers.formatEther(minBalNum)} LYX`,
              progress: ok ? `${ethers.formatEther(bal)} / ${ethers.formatEther(minBalNum)}` : `${ethers.formatEther(bal)} / ${ethers.formatEther(minBalNum)}`,
            });
          }

          // Followers count
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
            rows.push({
              passed: ok,
              label: `≥ ${minFolNum} followers`,
              progress: `${folCount} / ${minFolNum}`,
            });
          }

          // Token requirements
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
            rows.push({
              passed: ok,
              label: `Token ≥ ${r.minAmount}`,
              progress: ok ? 'Held ✓' : `Need ${r.minAmount}`,
            });
          }

          if (cancelled) return;
          setConditions(rows);
          return;
        }

        // 3. Single gates: use check()
        if (gt !== 'requirements') {
          const [, label, progress] = await gate.check(userAddress);
          if (cancelled) return;
          setConditions([{ passed: false, label: label || 'Unknown', progress }]);
          return;
        }
      } catch {
        if (!cancelled) setConditions([{ passed: false, label: 'Could not load', progress: '' }]);
      }
    })();

    return () => { cancelled = true; };
  }, [gateAddress, chainId, userAddress]);

  if (conditions.length === 0) {
    return <p className="conditions-placeholder">Loading conditions...</p>;
  }

  return (
    <div className="conditions-area-compact">
      {conditions.map((c, i) => (
        <div key={i} className="condition-row">
          <span className={`condition-dot condition-dot--${c.passed ? 'pass' : 'fail'}`} />
          <span className={`condition-label condition-label--${c.passed ? 'pass' : 'fail'}`}>
            {c.label}
          </span>
          {c.progress && (
            <span className={`condition-progress condition-progress--${c.passed ? 'pass' : 'fail'}`}>
              {c.progress}
            </span>
          )}
        </div>
      ))}
      {isSoulbound && (
        <div className="condition-row">
          <span className="condition-dot condition-dot--pass" />
          <span className="condition-label condition-label--pass">Soulbound · Not transferable</span>
        </div>
      )}
      {isRevokable && conditions.length > 0 && (
        <div className="condition-row">
          <span className="condition-dot" style={{ background: 'var(--c-accent)' }} />
          <span className="condition-label" style={{ color: 'var(--c-text-secondary)' }}>
            Revokable · May lose tokens if conditions unmet
          </span>
        </div>
      )}
    </div>
  );
}
