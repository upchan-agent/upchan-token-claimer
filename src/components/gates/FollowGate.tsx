'use client';

import { useEffect, useState } from 'react';
import { ethers } from 'ethers';
import { useUpProvider } from '@/lib/up-provider';
import { useFollow, TokenStatus } from '@/lib/useToken';
import { TokenConfig, CHAINS, GATE_ABI } from '@/config/tokens';

interface Props {
  token: TokenConfig;
  status: TokenStatus;
  onRefetch: () => void;
}

export function FollowGate({ token, status, onRefetch }: Props) {
  const { provider, accounts, isConnected } = useUpProvider();
  const user = accounts[0] || null;

  const [gateTarget, setGateTarget] = useState<string | null>(null);
  const [gatePassed, setGatePassed] = useState(false);
  const [gateLabel, setGateLabel] = useState('');

  // Fetch gate info from the contract
  useEffect(() => {
    if (!status.mintGate || status.mintGate === '0x0000000000000000000000000000000000000000') return;
    let cancelled = false;

    const chain = CHAINS[token.chainId];
    if (!chain) return;

    const p = new ethers.JsonRpcProvider(chain.rpc);
    const gate = new ethers.Contract(status.mintGate, GATE_ABI, p);
    const gateAddr = status.mintGate;

    Promise.all([
      // Call target() via raw eth_call (avoids ethers property conflict)
      (async () => {
        const abi = ['function target() view returns (address)'];
        const iface = new ethers.Interface(abi);
        const data = iface.encodeFunctionData('target');
        const result = await p.call({ to: gateAddr, data });
        const decoded = iface.decodeFunctionResult('target', result);
        return (decoded[0] as string).toLowerCase();
      })().catch(() => null),
      user ? gate.check(user).catch(() => [false, '', '']) : [false, '', ''],
    ]).then(([target, checkResult]) => {
      if (cancelled) return;
      if (target) setGateTarget(target as string);
      const [passed, label] = checkResult as [boolean, string, string];
      setGatePassed(passed);
      setGateLabel(label);
    });

    return () => { cancelled = true; };
  }, [status.mintGate, token.chainId, user]);

  const { follow: doFollow, isFollowing: followLoading, error: fe } = useFollow(
    user, provider, gateTarget as `0x${string}`, onRefetch
  );

  return (
    <>
      <p className="text-caption" style={{ margin: 'var(--space-2xs) 0', lineHeight: 1.4 }}>
        {gateLabel || `Must follow on LUKSO`}
      </p>

      {isConnected && !status.isFetching && (
        <p className="text-micro" style={{
          margin: 'var(--space-2xs) 0',
          color: gatePassed ? 'var(--c-success)' : 'var(--c-text-tertiary)',
        }}>
          {gatePassed ? 'Following ✓' : 'Not following'}
        </p>
      )}

      {isConnected && !gatePassed && !status.isFetching && (
        <button
          onClick={doFollow}
          disabled={followLoading || !gateTarget}
          className="btn btn-secondary btn-lg"
        >
          {followLoading ? 'Following...' : 'Follow on LUKSO'}
        </button>
      )}

      {fe && <div className="error-box">{fe}</div>}
    </>
  );
}
