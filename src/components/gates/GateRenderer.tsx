'use client';

import { useEffect, useState } from 'react';
import { ethers } from 'ethers';
import { TokenConfig, GATE_ABI, COMPOSITE_ABI, CHAINS } from '@/config/tokens';
import { TokenStatus } from '@/lib/useToken';

interface Props {
  token: TokenConfig;
  status: TokenStatus;
  onRefetch: () => void;
  userAddress?: `0x${string}` | null;
}

const ZERO_ADDR = '0x0000000000000000000000000000000000000000';

export interface ConditionRow {
  passed: boolean;
  label: string;
  progress: string;
}

const ZERO_CHECK = '0x0000000000000000000000000000000000000001';

// ─── Reusable StatusIcon matching StatusCard's Properties ───

function ConditionIcon({ passed }: { passed: boolean }) {
  const cls = passed ? 'status-icon--yes' : 'status-icon--no';
  return (
    <span className={cls}>
      {passed ? (
        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
          <circle cx="12" cy="12" r="10" /><path d="M8 12l3 3 5-5" />
        </svg>
      ) : (
        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
          <circle cx="12" cy="12" r="10" /><path d="M9 9l6 6M15 9l-6 6" />
        </svg>
      )}
    </span>
  );
}

// ─── On-chain helpers ────────────────────────────────────

async function callView(p: ethers.JsonRpcProvider, to: string, sig: string, outputs: object[]) {
  const iface = new ethers.Interface([{ type: 'function', name: sig.split('(')[0], inputs: [], outputs }]);
  const data = iface.encodeFunctionData(sig.split('(')[0], []);
  const r = await p.call({ to, data });
  return iface.decodeFunctionResult(sig.split('(')[0], r);
}

async function fetchTarget(addr: string, chainId: number): Promise<string | null> {
  try {
    const p = new ethers.JsonRpcProvider(CHAINS[chainId].rpc);
    const [target] = await callView(p, addr, 'target()', [{ type: 'address' }]);
    return (target as string).toLowerCase();
  } catch { return null; }
}

// ─── Fetch conditions from any gate ──────────────────────

async function fetchConditions(gateAddress: string, chainId: number, user: string | null): Promise<ConditionRow[]> {
  if (gateAddress === ZERO_ADDR) return [];

  const chain = CHAINS[chainId];
  if (!chain) return [];

  try {
    const p = new ethers.JsonRpcProvider(chain.rpc);
    const gate = new ethers.Contract(gateAddress, GATE_ABI, p);
    const gtype: string = await gate.gateType();
    const type = gtype.toLowerCase();
    const checkUser = user || ZERO_CHECK;

    // ─── Composite gate ───
    if (type === 'composite') {
      let children: string[] = [];
      try {
        const cg = new ethers.Contract(gateAddress, GATE_ABI.concat(COMPOSITE_ABI), p);
        children = await cg.getChildren();
      } catch { return []; }

      const [, , progress] = await gate.check(checkUser);
      const parsed: ConditionRow[] = [];
      if (progress) {
        const parts = progress.split(' | ');
        for (let i = 0; i < parts.length; i++) {
          const condPassed = parts[i].startsWith('\u2713 ');
          parsed.push({ passed: condPassed, label: parts[i].slice(2), progress: '' });
        }
      }
      for (let i = 0; i < children.length && i < parsed.length; i++) {
        try {
          const childGate = new ethers.Contract(children[i], GATE_ABI, p);
          const ct: string = await childGate.gateType();
          if (ct === 'follow') parsed[i].progress = 'Must follow target';
        } catch { /* skip */ }
      }
      return parsed;
    }

    // ─── RequirementsGate ───
    if (type === 'requirements') {
      const REQ_ABI = [
        'function followTarget() view returns (address)',
        'function minNativeBalance() view returns (uint256)',
        'function minFollowers() view returns (uint256)',
      ];
      const rg = new ethers.Contract(gateAddress, REQ_ABI, p);
      const [followAddr, minBal, minFol] = await Promise.all([
        rg.followTarget().catch(() => ZERO_ADDR),
        rg.minNativeBalance().catch(() => BigInt(0)),
        rg.minFollowers().catch(() => BigInt(0)),
      ]);

      const parsed: ConditionRow[] = [];

      if (followAddr !== ZERO_ADDR) {
        let followOk = false;
        try {
          const lspIf = new ethers.Interface(['function isFollowing(address,address) view returns (bool)']);
          const data = lspIf.encodeFunctionData('isFollowing', [checkUser, followAddr]);
          const res = await p.call({ to: '0xf01103E5a9909Fc0DBe8166dA7085e0285daDDcA', data });
          followOk = lspIf.decodeFunctionResult('isFollowing', res)[0];
        } catch {}
        parsed.push({
          passed: followOk,
          label: 'Must follow',
          progress: followOk ? 'Following' : 'Not following',
        });
      }

      const minBalNum = minBal as bigint;
      if (minBalNum > BigInt(0)) {
        const balOk = (await p.getBalance(checkUser)) >= minBalNum;
        parsed.push({
          passed: balOk,
          label: `≥ ${ethers.formatEther(minBalNum)} LYX`,
          progress: balOk ? `${ethers.formatEther(minBalNum).slice(0, 6)} LYX` : `Need ${ethers.formatEther(minBalNum).slice(0, 6)} LYX`,
        });
      }

      const minFolNum = minFol as bigint;
      if (BigInt(minFolNum) > BigInt(0)) {
        let folCount = BigInt(0);
        try {
          const iface = new ethers.Interface(['function totalFollowersOf(address) view returns (uint256)']);
          const data = iface.encodeFunctionData('totalFollowersOf', [checkUser]);
          const res = await p.call({ to: '0xf01103E5a9909Fc0DBe8166dA7085e0285daDDcA', data });
          folCount = iface.decodeFunctionResult('totalFollowersOf', res)[0] as bigint;
        } catch {}
        const ok = folCount >= BigInt(minFolNum);
        parsed.push({
          passed: ok,
          label: `≥ ${minFolNum} followers`,
          progress: `${folCount} / ${minFolNum}`,
        });
      }

      return parsed;
    }

    // ─── Single gate ───
    const [, label, progress] = await gate.check(checkUser);
    return [{ passed: false, label: label || type, progress }];

  } catch {
    return [{ passed: false, label: 'Unknown condition', progress: '' }];
  }
}

// ─── Component ───────────────────────────────────────────

export function GateRenderer({ token, status }: Props) {
  const hasGate = status.mintGate !== ZERO_ADDR;
  const [conditions, setConditions] = useState<ConditionRow[]>([]);

  useEffect(() => {
    if (!hasGate) { setConditions([]); return; }
    let cancelled = false;
    fetchConditions(status.mintGate, token.chainId, null).then((result) => {
      if (cancelled) return;
      setConditions(result);
    });
    return () => { cancelled = true; };
  }, [status.mintGate, token.chainId, hasGate]);

  if (!hasGate) return null;
  if (conditions.length === 0) return null;

  return (
    <div>
      {conditions.map((c, i) => (
        <div key={i} className="data-row" style={{ border: 'none' }}>
          <span className="data-label">{c.label}</span>
          <ConditionIcon passed={c.passed} />
          <span className="data-value">{c.progress}</span>
        </div>
      ))}
    </div>
  );
}
