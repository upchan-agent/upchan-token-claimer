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
}

type GateType = 'follow' | 'none' | 'unknown';

/**
 * Resolves the gate type by eth_call to the gate contract.
 * Falls back to 'unknown' if the call fails.
 */
async function detectGateType(
  gateAddress: string,
  chainId: number,
  userAddress: string | null
): Promise<{ type: GateType; label: string }> {
  if (gateAddress === '0x0000000000000000000000000000000000000000') {
    return { type: 'none', label: '' };
  }

  const chain = CHAINS[chainId];
  if (!chain) return { type: 'unknown', label: '' };

  try {
    const p = new ethers.JsonRpcProvider(chain.rpc);
    const gate = new ethers.Contract(gateAddress, GATE_ABI, p);

    // Try gateType() — should return "follow", "balance", "composite-and", etc.
    const gtype: string = await gate.gateType();
    const type = gtype.toLowerCase();

    // Try check(user) for display info
    let label = '';
    if (userAddress) {
      try {
        const [, l] = await gate.check(userAddress);
        label = l;
      } catch { /* check not available */ }
    }

    if (type === 'follow') return { type: 'follow', label };

    // Future gate types will be handled here
    return { type: 'unknown', label };
  } catch {
    // gateType() not available — treat as unknown
    return { type: 'unknown', label: '' };
  }
}

export function GateRenderer({ token, status, onRefetch }: Props) {
  const { accounts, isConnected } = useUpProvider();
  const user = accounts[0] || null;
  const hasGate = status.mintGate !== '0x0000000000000000000000000000000000000000';

  const [gateType, setGateType] = useState<GateType>('none');
  const [gateLabel, setGateLabel] = useState('');

  useEffect(() => {
    if (!hasGate) {
      setGateType('none');
      setGateLabel('');
      return;
    }

    let cancelled = false;
    detectGateType(status.mintGate, token.chainId, user).then((result) => {
      if (cancelled) return;
      setGateType(result.type);
      setGateLabel(result.label);
    });

    return () => { cancelled = true; };
  }, [status.mintGate, token.chainId, user, hasGate]);

  if (!hasGate) {
    return <NoGate />;
  }

  switch (gateType) {
    case 'follow':
      return (
        <>
          {gateLabel && (
            <p className="text-caption" style={{ margin: 'var(--space-2xs) 0', lineHeight: 1.4 }}>
              {gateLabel}
            </p>
          )}
          <FollowGate token={token} status={status} onRefetch={onRefetch} />
        </>
      );
    default:
      return <UnknownGate />;
  }
}
