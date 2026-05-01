'use client';

import { useEffect, useState } from 'react';
import { ethers } from 'ethers';
import { TokenConfig, GATE_ABI, CHAINS } from '@/config/tokens';
import { TokenStatus } from '@/lib/useToken';
import { useUpProvider } from '@/lib/up-provider';
import { NoGate } from './NoGate';
import { FollowGate } from './FollowGate';
import { UnknownGate } from './UnknownGate';

interface Props {
  token: TokenConfig;
  status: TokenStatus;
  onRefetch: () => void;
  userAddress?: `0x${string}` | null;
}

type GateType = 'follow' | 'none' | 'unknown';

interface GateData {
  type: GateType;
  passed: boolean;
  label: string;
  target: string | null;
}

const ZERO_ADDR = '0x0000000000000000000000000000000000000000';

async function fetchTarget(addr: string, chainId: number): Promise<string | null> {
  try {
    const p = new ethers.JsonRpcProvider(CHAINS[chainId].rpc);
    const iface = new ethers.Interface(['function target() view returns (address)']);
    const data = iface.encodeFunctionData('target');
    const result = await p.call({ to: addr, data });
    const decoded = iface.decodeFunctionResult('target', result);
    return (decoded[0] as string).toLowerCase();
  } catch {
    return null;
  }
}

async function fetchGateData(
  gateAddress: string,
  chainId: number,
  user: string | null
): Promise<GateData> {
  if (gateAddress === ZERO_ADDR) {
    return { type: 'none', passed: false, label: '', target: null };
  }

  const chain = CHAINS[chainId];
  if (!chain) return { type: 'unknown', passed: false, label: '', target: null };

  try {
    const p = new ethers.JsonRpcProvider(chain.rpc);
    const gate = new ethers.Contract(gateAddress, GATE_ABI, p);

    const gtypeRaw: string = await gate.gateType();
    const gtype = gtypeRaw.toLowerCase();

    // Common: check(user) — all gate contracts implement this
    let passed = false;
    let label = '';
    if (user) {
      try {
        const [p, l] = await gate.check(user);
        passed = p;
        label = l;
      } catch { /* gate.check may fail for some providers */ }
    }

    // Type-specific data
    if (gtype === 'follow') {
      const target = await fetchTarget(gateAddress, chainId);
      return {
        type: 'follow',
        passed,
        label: label || 'Must follow on LUKSO',
        target,
      };
    }

    // Future gate types: add cases above (e.g. 'balance', 'composite-and')
    return { type: 'unknown', passed, label, target: null };
  } catch {
    return { type: 'unknown', passed: false, label: '', target: null };
  }
}

export function GateRenderer({ token, status, onRefetch, userAddress }: Props) {
  const { accounts } = useUpProvider();
  const user = userAddress ?? accounts[0] ?? null;
  const hasGate = status.mintGate !== ZERO_ADDR;

  const [data, setData] = useState<GateData>({
    type: 'none', passed: false, label: '', target: null,
  });

  // Single effect: fetches ALL gate data from the chain
  useEffect(() => {
    if (!hasGate) {
      setData({ type: 'none', passed: false, label: '', target: null });
      return;
    }

    let cancelled = false;
    fetchGateData(status.mintGate, token.chainId, user).then((result) => {
      if (cancelled) return;
      setData(result);
    });

    return () => { cancelled = true; };
  }, [status.mintGate, token.chainId, user, hasGate]);

  if (!hasGate) return <NoGate />;

  switch (data.type) {
    case 'follow':
      return (
        <FollowGate
          gatePassed={data.passed}
          gateLabel={data.label}
          gateTarget={data.target}
          onRefetch={onRefetch}
        />
      );
    default:
      return <UnknownGate />;
  }
}
