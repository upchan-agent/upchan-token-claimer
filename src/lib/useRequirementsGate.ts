'use client';

import { useCallback } from 'react';
import { ethers } from 'ethers';
import { useTxContext } from './tx-context';
import { useUpProvider } from './up-provider';

const GATE_ABI = [
  'function followTarget() view returns (address)',
  'function minNativeBalance() view returns (uint256)',
  'function minFollowers() view returns (uint256)',
  'function getTokenRequirements() view returns ((address token, uint256 minAmount)[])',
  'function useOr() view returns (bool)',
  'function setFollowTarget(address)',
  'function setMinNativeBalance(uint256)',
  'function setMinFollowers(uint256)',
  'function addTokenRequirement(address, uint256)',
  'function removeTokenRequirement(uint256)',
  'function clearTokenRequirements()',
  'function setTokenRequirements((address,uint256)[])',
  'function setOperator(bool)',
  'function setAll(address,uint256,uint256,(address,uint256)[],bool)',
];

export interface TokenRequirement {
  token: string;
  minAmount: number;
}

export interface GateSettings {
  followTarget: string;
  minNativeBalance: string;
  minFollowers: number;
  tokenReqs: TokenRequirement[];
  useOr: boolean;
}

/**
 * Fetch current RequirementsGate settings.
 */
export async function fetchGateSettings(
  gateAddress: string,
  chainId: number,
  CHAINS: Record<number, { rpc: string }>,
): Promise<GateSettings> {
  const chain = CHAINS[chainId];
  if (!chain) throw new Error('Unknown chain');
  const p = new ethers.JsonRpcProvider(chain.rpc);
  const c = new ethers.Contract(gateAddress, GATE_ABI, p);

  const [follow, bal, followers, tokens, op] = await Promise.all([
    c.followTarget().catch(() => '0x0000000000000000000000000000000000000000'),
    c.minNativeBalance().catch(() => BigInt(0)),
    c.minFollowers().catch(() => BigInt(0)),
    c.getTokenRequirements().catch(() => []),
    c.useOr().catch(() => false),
  ]);

  return {
    followTarget: follow as string,
    minNativeBalance: (bal as bigint).toString(),
    minFollowers: Number(followers as bigint),
    tokenReqs: (tokens as { token: string; minAmount: bigint }[]).map(t => ({
      token: t.token,
      minAmount: Number(t.minAmount),
    })),
    useOr: op as boolean,
  };
}

/**
 * Hook to call RequirementsGate setter functions.
 */
export function useRequirementsGate(gateAddress: string | null, chainId: number) {
  const { sendTx } = useTxContext();

  const callGate = useCallback(async (sig: string, args: unknown[], label: string) => {
    if (!gateAddress) throw new Error('No gate selected');
    const iface = new ethers.Interface([sig]);
    const innerData = iface.encodeFunctionData(sig, args);
    await sendTx(label, gateAddress as `0x${string}`, innerData, chainId);
  }, [gateAddress, chainId, sendTx]);

  const setFollowTarget = useCallback(
    (addr: string) => callGate('function setFollowTarget(address)', [addr], 'Set Follow Target'),
    [callGate],
  );
  const setMinNativeBalance = useCallback(
    (wei: string) => callGate('function setMinNativeBalance(uint256)', [BigInt(wei || '0')], 'Set Min LYX'),
    [callGate],
  );
  const setMinFollowers = useCallback(
    (count: number) => callGate('function setMinFollowers(uint256)', [count], 'Set Min Followers'),
    [callGate],
  );
  const addTokenReq = useCallback(
    (token: string, amount: number) => callGate('function addTokenRequirement(address,uint256)', [token, amount], 'Add Token Req'),
    [callGate],
  );
  const removeTokenReq = useCallback(
    (index: number) => callGate('function removeTokenRequirement(uint256)', [index], 'Remove Token Req'),
    [callGate],
  );
  const setOperator = useCallback(
    (orMode: boolean) => callGate('function setOperator(bool)', [orMode], 'Set Gate Logic'),
    [callGate],
  );

  const setAll = useCallback(
    (follow: string, lyx: string, followers: number, tokenReqs: { token: string; amount: number }[], orMode: boolean) =>
      callGate('function setAll(address,uint256,uint256,(address,uint256)[],bool)', [follow, BigInt(lyx || '0'), followers, tokenReqs, orMode], 'Save All Conditions'),
    [callGate],
  );

  return { setFollowTarget, setMinNativeBalance, setMinFollowers, addTokenReq, removeTokenReq, setOperator, setAll };
}
