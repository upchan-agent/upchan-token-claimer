'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { ethers } from 'ethers';
import { useUpProvider } from './UpProvider';
import { CHAINS, UP_ABI } from '@/config/tokens';

export interface TxRecord {
  id: string;
  label: string;
  status: 'pending' | 'confirmed' | 'failed';
  txHash: `0x${string}` | null;
  error: string | null;
  chainId: number;
  timestamp: number;
}

interface TxContextType {
  recentTxs: TxRecord[];
  isAnyPending: boolean;
  sendTx: (
    label: string,
    target: `0x${string}`,
    innerCalldata: string,
    chainId: number,
  ) => Promise<`0x${string}`>;
  clearHistory: () => void;
}

const MAX_RECORDS = 20;

const Ctx = createContext<TxContextType>({
  recentTxs: [],
  isAnyPending: false,
  sendTx: async () => { throw new Error('TxProvider not mounted'); },
  clearHistory: () => {},
});

let nextId = 0;

export function TxProvider({ children }: { children: ReactNode }) {
  const { provider, accounts } = useUpProvider();
  const [records, setRecords] = useState<TxRecord[]>([]);

  const sendTx = useCallback(async (
    label: string,
    target: `0x${string}`,
    innerCalldata: string,
    chainId: number,
  ): Promise<`0x${string}`> => {
    const userAddress = accounts[0];
    if (!userAddress) throw new Error('Not connected');
    if (!provider) throw new Error('No provider');

    const id = `tx-${++nextId}`;
    const now = Date.now();
    const pending: TxRecord = {
      id, label, status: 'pending', txHash: null, error: null, chainId, timestamp: now,
    };

    setRecords(prev => [pending, ...prev].slice(0, MAX_RECORDS));

    try {
      // UP.execute(0, target, 0, innerCalldata)
      const upIface = new ethers.Interface(UP_ABI);
      const execData = upIface.encodeFunctionData('execute', [
        BigInt(0), target, BigInt(0), innerCalldata,
      ]);

      const txHashRaw = await provider.request({
        method: 'eth_sendTransaction',
        params: [{ from: userAddress, to: userAddress, data: execData }],
      });
      const txHash = txHashRaw as `0x${string}`;

      setRecords(prev => prev.map(r => r.id === id ? { ...r, txHash } : r));

      const chain = CHAINS[chainId];
      if (!chain) throw new Error('Unsupported chain');

      const p = new ethers.JsonRpcProvider(chain.rpc);
      const receipt = await p.waitForTransaction(txHash, 1, 60_000);
      if (!receipt) throw new Error('Transaction confirmation timed out');
      if (receipt.status !== 1) throw new Error('Transaction reverted');

      setRecords(prev => prev.map(r => r.id === id ? { ...r, status: 'confirmed' } : r));
      return txHash;
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : 'Transaction failed';
      setRecords(prev => prev.map(r => r.id === id ? { ...r, status: 'failed', error: errMsg } : r));
      throw e;
    }
  }, [provider, accounts]);

  const clearHistory = useCallback(() => setRecords([]), []);

  const isAnyPending = records.some(r => r.status === 'pending');

  return (
    <Ctx.Provider value={{ recentTxs: records, isAnyPending, sendTx, clearHistory }}>
      {children}
    </Ctx.Provider>
  );
}

export function useTxContext() {
  return useContext(Ctx);
}
