'use client';

import { useState, useMemo } from 'react';

/**
 * useViewMode — ビューモード（任意アドレス表示）の状態管理
 *
 * 責務:
 * - viewAddress state の一元管理
 * - effective user の導出 (viewAddress優先、なければwalletAddress)
 * - isViewMode フラグの導出 (viewAddress設定済み かつ wallet未接続)
 *
 * 使い方: page.tsxで useUpProvider と併用
 *   const { accounts, isConnected } = useUpProvider();
 *   const vm = useViewMode(accounts[0] || null, isConnected);
 *   // → vm.user, vm.isViewMode, vm.setViewAddress
 */
export function useViewMode(
  walletAddress: `0x${string}` | null,
  isConnected: boolean
) {
  const [viewAddress, setViewAddress] = useState<`0x${string}` | null>(null);

  return useMemo(() => ({
    viewAddress,
    setViewAddress,
    /** 実効アドレス: viewAddress優先、なければwallet */
    user: viewAddress ?? walletAddress,
    /** ビューモードか: viewAddress設定済み かつ wallet非接続 */
    isViewMode: !!viewAddress && !isConnected,
  }), [viewAddress, walletAddress, isConnected]);
}
