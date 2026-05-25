'use client';

import { useCallback, useState } from 'react';
import { ethers } from 'ethers';
import { TokenConfig } from '@/config/tokens';
import { useTxContext } from '../providers/TxContext';

const ABI = [
  'function setIsMintable(bool)',
  'function permanentlyDisableMinting()',
  'function updateSupplyCap(uint256)',
  'function lockSupplyCap()',
  'function setMintGate(address)',
  'function lockMintGate()',
  'function setHoldGate(address)',
  'function lockHoldGate()',
  'function revokeByGate(address)',
  'function setData(bytes32, bytes)',
  'function makeTransferable()',
  'function renounceOwnership()',
  'function transferOwnership(address)',
  'function acceptOwnership()',
];

const LSP4_TOKEN_NAME = '0xdeba1e292f8ba88238e10ab3c7f88bd4be4fac56cad5194b6ecceaf653468af1';
const LSP4_TOKEN_SYMBOL = '0x2f0a68ab07768e01943a599e73362a0e17a63a72e94dd2e384d2c1d4db932756';

/** Factory: creates an action function given a signature and callback args. */
function act(
  encode: (sig: string, args: unknown[]) => string,
  sendTx: ReturnType<typeof useTxContext>['sendTx'],
  token: TokenConfig | null,
  setPending: (k: string | null) => void,
) {
  return (sig: string, label: string, args: unknown[]) => async () => {
    if (!token) return;
    setPending(label);
    try {
      const innerData = encode(sig, args);
      await sendTx(label, token.proxy, innerData, token.chainId);
    } finally {
      setPending(null);
    }
  };
}

export function useOwnerActions(token: TokenConfig | null, _ownerAddress: `0x${string}` | null) {
  const { sendTx } = useTxContext();
  const [pendingKey, setPending] = useState<string | null>(null);
  const iface = new ethers.Interface(ABI);
  const encode = useCallback((sig: string, args: unknown[]) => iface.encodeFunctionData(sig, args), []);
  const a = act(encode, sendTx, token, setPending);

  // ─── Mint Control ───
  const setIsMintable = useCallback((v: boolean) => a('setIsMintable', `Set Minting ${v ? 'Open' : 'Paused'}`, [v])(), [a]);
  const permanentlyDisableMinting = useCallback(() => a('permanentlyDisableMinting', 'Permanently Disable Minting', [])(), [a]);

  // ─── Supply Cap ───
  const updateSupplyCap = useCallback((cap: bigint) => a('updateSupplyCap', 'Update Supply Cap', [cap])(), [a]);
  const lockSupplyCap = useCallback(() => a('lockSupplyCap', 'Fix Supply Cap', [])(), [a]);

  // ─── Gate Management ───
  const setMintGate = useCallback((addr: string) => a('setMintGate', 'Set Mint Gate', [addr])(), [a]);
  const lockMintGate = useCallback(() => a('lockMintGate', 'Fix Mint Gate', [])(), [a]);
  const setHoldGate = useCallback((addr: string) => a('setHoldGate', 'Set Hold Gate', [addr])(), [a]);
  const lockHoldGate = useCallback(() => a('lockHoldGate', 'Fix Hold Gate', [])(), [a]);

  // ─── Revoke ───
  const revokeByGate = useCallback(
    (from: string) => a('revokeByGate', 'Revoke by Gate', [from])(),
    [a],
  );

  // ─── Metadata ───
  const setTokenName = useCallback(
    (name: string) => a('setData', 'Update Token Name', [LSP4_TOKEN_NAME, ethers.hexlify(ethers.toUtf8Bytes(name))])(),
    [a],
  );
  const setTokenSymbol = useCallback(
    (sym: string) => a('setData', 'Update Token Symbol', [LSP4_TOKEN_SYMBOL, ethers.hexlify(ethers.toUtf8Bytes(sym))])(),
    [a],
  );

  // ─── Transfer ───
  const makeTransferable = useCallback(() => a('makeTransferable', 'Make Transferable', [])(), [a]);

  // ─── Soulbound Period ───
  const updateTransferLockPeriod = useCallback(
    (newStart: bigint, newEnd: bigint) =>
      a('updateTransferLockPeriod(uint256,uint256)', 'Update Soulbound Period', [newStart, newEnd])(),
    [a]
  );

  // ─── Ownership ───
  const renounceOwnership = useCallback(() => a('renounceOwnership', 'Renounce Ownership', [])(), [a]);

  // ─── Transfer Ownership ───
  const transferOwnership = useCallback(
    (newOwner: string) =>
      a('transferOwnership(address)', 'Transfer Ownership', [newOwner])(),
    [a]
  );

  const acceptOwnership = useCallback(
    () => a('acceptOwnership', 'Accept Ownership', [])(),
    [a]
  );

  return {
    isPending: pendingKey !== null,
    pendingKey,
    setIsMintable,
    permanentlyDisableMinting,
    updateSupplyCap,
    lockSupplyCap,
    setMintGate,
    lockMintGate,
    setHoldGate,
    lockHoldGate,
    revokeByGate,
    setTokenName,
    setTokenSymbol,
    makeTransferable,
    updateTransferLockPeriod,
    transferOwnership,
    acceptOwnership,
    renounceOwnership,
  } as const;
}
