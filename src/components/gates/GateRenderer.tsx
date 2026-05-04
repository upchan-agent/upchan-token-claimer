'use client';

import { useEffect, useState } from 'react';
import { ethers } from 'ethers';
import { TokenConfig, GATE_ABI, COMPOSITE_ABI, CHAINS } from '@/config/tokens';
import { TokenStatus } from '@/lib/useToken';
import { YesIcon, NoIcon, DashIcon } from '../Icons';

interface Props {
  token: TokenConfig;
  status: TokenStatus;
  onRefetch: () => void;
  userAddress?: `0x${string}` | null;
  /** Fired when a follow condition is detected */
  onFollowInfo?: (target: string, isFollowing: boolean) => void;
}

const ZERO_ADDR = '0x0000000000000000000000000000000000000000';

export interface ConditionRow {
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
  } catch {
    return null;
  }
}

// ─── Fetch conditions from any gate ──────────────────────

async function fetchConditions(
  gateAddress: string,
  chainId: number,
  user: string | null
): Promise<ConditionRow[]> {
  if (gateAddress === ZERO_ADDR) return [];

  const chain = CHAINS[chainId];
  if (!chain) return [];

  try {
    const p = new ethers.JsonRpcProvider(chain.rpc);
    const gate = new ethers.Contract(gateAddress, GATE_ABI, p);

    const gtype: string = await gate.gateType();
    const type = gtype.toLowerCase();

    const checkUser = user || '0x0000000000000000000000000000000000000001';

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
          const condLabel = parts[i].slice(2);
          parsed.push({ passed: condPassed, label: condLabel, progress: '' });
        }
      }

      for (let i = 0; i < children.length && i < parsed.length; i++) {
        try {
          const childGate = new ethers.Contract(children[i], GATE_ABI, p);
          const ct: string = await childGate.gateType();
          if (ct === 'follow') {
            parsed[i].progress = 'Must follow target';
          }
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
          progress: balOk ? `${ethers.formatEther(minBalNum)} LYX` : `Need ${ethers.formatEther(minBalNum)} LYX`,
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

    // Single gate
    const [, label, progress] = await gate.check(checkUser);
    return [{ passed: false, label: label || type, progress }];

  } catch {
    return [{ passed: false, label: 'Unknown condition', progress: '' }];
  }
}

// ─── Component ───────────────────────────────────────────

export function GateRenderer({ token, status, onRefetch, userAddress, onFollowInfo }: Props) {
  const hasGate = status.mintGate !== ZERO_ADDR;
  const [conditions, setConditions] = useState<ConditionRow[]>([]);

  useEffect(() => {
    if (!hasGate) {
      setConditions([]);
      onFollowInfo?.(ZERO_ADDR, false);
      return;
    }
    let cancelled = false;
    fetchConditions(status.mintGate, token.chainId, userAddress ?? null).then((result) => {
      if (cancelled) return;
      setConditions(result);
      // Extract follow info for action bar
      if (onFollowInfo && token && status.mintGate) {
        detectFollowTarget(status.mintGate, token.chainId, result, onFollowInfo);
      }
    });
    return () => { cancelled = true; };
  }, [status.mintGate, token.chainId, userAddress, hasGate, onFollowInfo, token]);

  if (!hasGate) return null;
  if (conditions.length === 0) return null;

  return (
    <div className="conditions-data-rows">
      {conditions.map((c, i) => {
        const val: PropValue = c.passed ? 'yes' : 'no';
        return (
          <div key={i} className="data-row" style={{ padding: 'var(--space-2xs) 0', minHeight: '24px' }}>
            <span className="data-label">{c.label}</span>
            <StatusIcon value={val} />
            <span className="data-value" style={{ fontSize: 12 }}>{c.progress}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Follow target detection for action bar ──────────────

async function detectFollowTarget(
  gateAddress: string,
  chainId: number,
  conditions: ConditionRow[],
  onFollowInfo: (target: string, isFollowing: boolean) => void,
) {
  // Check if any condition involves following
  if (!conditions.some(c => c.label === 'Must follow')) return;

  try {
    const chain = CHAINS[chainId];
    if (!chain) return;
    const p = new ethers.JsonRpcProvider(chain.rpc);
    const REQ_ABI = ['function followTarget() view returns (address)'];
    const rg = new ethers.Contract(gateAddress, REQ_ABI, p);
    const target = await rg.followTarget();
    if (target === ZERO_ADDR) return;

    const followCond = conditions.find(c => c.label === 'Must follow');
    onFollowInfo((target as string).toLowerCase(), followCond?.passed ?? false);
  } catch {
    // can't detect
  }
}
