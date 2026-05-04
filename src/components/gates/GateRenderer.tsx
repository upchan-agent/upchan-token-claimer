'use client';

import { useEffect, useState } from 'react';
import { ethers } from 'ethers';
import { TokenConfig, GATE_ABI, COMPOSITE_ABI, CHAINS } from '@/config/tokens';
import { TokenStatus } from '@/lib/useToken';
import { NoGate } from './NoGate';
import { UnknownGate, Condition } from './UnknownGate';
import { ProfileCard } from './ProfileCard';

interface Props {
  token: TokenConfig;
  status: TokenStatus;
  onRefetch: () => void;
  userAddress?: `0x${string}` | null;
}

const ZERO_ADDR = '0x0000000000000000000000000000000000000000';

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
): Promise<Condition[]> {
  if (gateAddress === ZERO_ADDR) return [];

  const chain = CHAINS[chainId];
  if (!chain) return [];

  try {
    const p = new ethers.JsonRpcProvider(chain.rpc);
    const gate = new ethers.Contract(gateAddress, GATE_ABI, p);

    const gtype: string = await gate.gateType();
    const type = gtype.toLowerCase();

    const checkUser = user || '0x0000000000000000000000000000000000000001';
    let passed = false;
    let label = '';
    let progress = '';
    try {
      const [p2, l, pr] = await gate.check(checkUser);
      passed = p2;
      label = l;
      progress = pr;
    } catch { /* check may fail */ }

    if (type === 'composite') {
      let children: string[] = [];
      try {
        const cg = new ethers.Contract(gateAddress, GATE_ABI.concat(COMPOSITE_ABI), p);
        children = await cg.getChildren();
      } catch {
        return [];
      }

      const parsed: Condition[] = [];
      if (progress) {
        const parts = progress.split(' | ');
        for (let i = 0; i < parts.length; i++) {
          const condPassed = parts[i].startsWith('\u2713 ');
          const condLabel = parts[i].slice(2);
          parsed.push({ passed: condPassed, label: condLabel });
        }
      }

      for (let i = 0; i < children.length && i < parsed.length; i++) {
        try {
          const childGate = new ethers.Contract(children[i], GATE_ABI, p);
          const ct: string = await childGate.gateType();
          parsed[i].gateType = ct.toLowerCase();
          if (parsed[i].gateType === 'follow') {
            parsed[i].target = await fetchTarget(children[i], chainId);
          }
        } catch { /* skip */ }
      }

      return parsed;
    }

    // ─── RequirementsGate: parse individual conditions ───
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

      const parsed: Condition[] = [];

      // Follow condition — check individually
      if (followAddr !== ZERO_ADDR) {
        const LSP26 = '0xf01103E5a9909Fc0DBe8166dA7085e0285daDDcA';
        let followOk = false;
        try {
          const lspIf = new ethers.Interface(['function isFollowing(address,address) view returns (bool)']);
          const data = lspIf.encodeFunctionData('isFollowing', [checkUser, followAddr]);
          const res = await p.call({ to: LSP26, data });
          followOk = lspIf.decodeFunctionResult('isFollowing', res)[0];
        } catch {}
        parsed.push({
          passed: followOk,
          label: 'Must follow',
          progress: followOk ? 'Following' : 'Not following',
          gateType: 'follow',
          target: (followAddr as string).toLowerCase(),
        });
      }

      // Native balance — check individually
      const minBalNum = minBal as bigint;
      if (minBalNum > BigInt(0)) {
        const balOk = (await p.getBalance(checkUser)) >= minBalNum;
        parsed.push({
          passed: balOk,
          label: `Hold ${ethers.formatEther(minBalNum)} LYX`,
          progress: balOk ? `${ethers.formatEther(minBalNum)} LYX` : `Need ${ethers.formatEther(minBalNum)} LYX`,
          gateType: 'balance-native',
          target: null,
        });
      }

      // Followers — check individually
      const minFolNum = minFol as bigint;
      if (BigInt(minFolNum) > BigInt(0)) {
        let folCount = BigInt(0);
        try {
          const lspIf = new ethers.Interface(['function totalFollowersOf(address) view returns (uint256)']);
          const data = lspIf.encodeFunctionData('totalFollowersOf', [checkUser]);
          const res = await p.call({ to: '0xf01103E5a9909Fc0DBe8166dA7085e0285daDDcA', data });
          folCount = lspIf.decodeFunctionResult('totalFollowersOf', res)[0] as bigint;
        } catch {}
        const folOk = folCount >= BigInt(minFolNum);
        parsed.push({
          passed: folOk,
          label: `${minFolNum}+ followers`,
          progress: `${folCount}/${minFolNum}`,
          gateType: 'followers',
          target: null,
        });
      }

      return parsed;
    }

    // Single gate: return one condition
    const conditions: Condition[] = [{
      passed,
      label: label || (type === 'follow' ? 'Must follow' : 'Unknown condition'),
      progress,
      gateType: type,
      target: type === 'follow' ? await fetchTarget(gateAddress, chainId) : null,
    }];
    return conditions;

  } catch {
    return [{ passed: false, label: 'Unknown condition', gateType: 'unknown' }];
  }
}

// ─── Component ───────────────────────────────────────────

export function GateRenderer({ token, status, onRefetch, userAddress }: Props) {
  const hasGate = status.mintGate !== ZERO_ADDR;
  const [conditions, setConditions] = useState<Condition[]>([]);

  useEffect(() => {
    if (!hasGate) {
      setConditions([]);
      return;
    }
    let cancelled = false;
    fetchConditions(status.mintGate, token.chainId, userAddress ?? null).then((result) => {
      if (cancelled) return;
      setConditions(result);
    });
    return () => { cancelled = true; };
  }, [status.mintGate, token.chainId, userAddress, hasGate]);

  if (!hasGate) return <NoGate />;

  // Separate follow condition from others — follow gets its own profile card
  const followCond = conditions.find(c => c.gateType === 'follow');
  const otherConds = conditions.filter(c => c.gateType !== 'follow');

  return (
    <div className="eligibility-grid">
      <div className="eligibility-conditions">
        <UnknownGate conditions={otherConds} />
        {/* Follow condition label on the left (profile card on the right) */}
        {followCond && (
          <div className="condition-list">
            <div className="condition-row">
              <span className={`condition-dot condition-dot--${followCond.passed ? 'pass' : 'fail'}`} />
              <span className={`condition-label condition-label--${followCond.passed ? 'pass' : 'fail'}`}>
                Must follow
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Right column: profile card */}
      {followCond && (
        <ProfileCard
          target={followCond.target}
          chainId={token.chainId}
          onFollowDone={onRefetch}
        />
      )}
    </div>
  );
}
