'use client';

import { useEffect, useState } from 'react';
import { ethers } from 'ethers';
import { CHAINS, GATE_ABI } from '@/config/tokens';
import { YesIcon, NoIcon, DashIcon } from './Icons';

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

type PropValue = 'yes' | 'no' | 'none';

function StatusIcon({ value }: { value: PropValue }) {
  const size = 12;
  switch (value) {
    case 'yes':
      return <span style={{ color: 'var(--c-success)', display: 'flex' }}><YesIcon size={size} /></span>;
    case 'no':
      return <span style={{ color: 'var(--c-text-tertiary)', display: 'flex' }}><NoIcon size={size} /></span>;
    case 'none':
      return <span style={{ color: 'var(--c-text-tertiary)', display: 'flex' }}><DashIcon size={size} /></span>;
  }
}

/**
 * Hold gate conditions displayed as data-rows (Properties format).
 * Soulbound/Revokable attributes appended as additional data-rows.
 */
export function HoldGateInfo({ gateAddress, chainId, userAddress, isSoulbound, isRevokable }: Props) {
  const [conditions, setConditions] = useState<ConditionRow[]>([]);

  useEffect(() => {
    if (!userAddress) return;
    let cancelled = false;

    (async () => {
      try {
        const chain = CHAINS[chainId];
        if (!chain) return;
        const p = new ethers.JsonRpcProvider(chain.rpc);
        const gate = new ethers.Contract(gateAddress, GATE_ABI, p);

        const gt: string = await gate.gateType();

        // RequirementsGate: parse individual conditions
        if (gt === 'requirements') {
          const REQ_ABI = [
            'function followTarget() view returns (address)',
            'function minNativeBalance() view returns (uint256)',
            'function minFollowers() view returns (uint256)',
            'function getTokenRequirements() view returns ((address token, uint256 minAmount)[])',
          ];
          const rg = new ethers.Contract(gateAddress, REQ_ABI, p);
          const [followTarget, minBal, minFol, tokenReqs] = await Promise.all([
            rg.followTarget().catch(() => '0x0000000000000000000000000000000000000000'),
            rg.minNativeBalance().catch(() => BigInt(0)),
            rg.minFollowers().catch(() => BigInt(0)),
            rg.getTokenRequirements().catch(() => []),
          ]);

          const rows: ConditionRow[] = [];

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
              label: 'Must follow',
              progress: ok ? 'Following' : 'Not following',
            });
          }

          const minBalNum = minBal as bigint;
          if (minBalNum > BigInt(0)) {
            const bal = await p.getBalance(userAddress);
            const ok = bal >= minBalNum;
            rows.push({
              passed: ok,
              label: `≥ ${ethers.formatEther(minBalNum)} LYX`,
              progress: ok ? `${ethers.formatEther(bal).slice(0, 6)} LYX` : `${ethers.formatEther(bal).slice(0, 6)} LYX`,
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
            rows.push({
              passed: ok,
              label: `≥ ${minFolNum} followers`,
              progress: `${folCount} / ${minFolNum}`,
            });
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
            rows.push({
              passed: ok,
              label: `Token ≥ ${r.minAmount}`,
              progress: ok ? 'Held' : `Need ${r.minAmount}`,
            });
          }

          if (cancelled) return;
          setConditions(rows);
          return;
        }

        // Single gate: use check()
        const [, label, progress] = await gate.check(userAddress);
        if (cancelled) return;
        setConditions([{ passed: false, label: label || gt, progress }]);
      } catch {
        if (!cancelled) setConditions([]);
      }
    })();

    return () => { cancelled = true; };
  }, [gateAddress, chainId, userAddress]);

  return (
    <div className="conditions-data-rows">
      {conditions.length === 0 ? (
        <p className="data-row conditions-placeholder" style={{ minHeight: '24px', border: 'none', margin: 0 }}>
          Loading conditions...
        </p>
      ) : (
        conditions.map((c, i) => {
          const val: PropValue = c.passed ? 'yes' : 'no';
          return (
            <div key={i} className="data-row" style={{ padding: 'var(--space-2xs) 0', minHeight: '24px' }}>
              <span className="data-label">{c.label}</span>
              <StatusIcon value={val} />
              <span className="data-value" style={{ fontSize: 12 }}>{c.progress}</span>
            </div>
          );
        })
      )}
      {/* Token attributes as data-rows */}
      {isSoulbound && (
        <div className="data-row" style={{ padding: 'var(--space-2xs) 0', minHeight: '24px' }}>
          <span className="data-label">Soulbound</span>
          <StatusIcon value="yes" />
          <span className="data-value" style={{ fontSize: 12, color: 'var(--c-text-secondary)' }}>Not transferable</span>
        </div>
      )}
      {isRevokable && (
        <div className="data-row" style={{ padding: 'var(--space-2xs) 0', minHeight: '24px' }}>
          <span className="data-label">Revokable</span>
          <span style={{ color: 'var(--c-accent)', display: 'flex' }}><YesIcon size={12} /></span>
          <span className="data-value" style={{ fontSize: 12, color: 'var(--c-text-secondary)' }}>May lose tokens</span>
        </div>
      )}
    </div>
  );
}
