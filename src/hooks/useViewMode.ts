'use client';

import { useState, useMemo } from 'react';

/**
 * useViewMode — 表示アドレス切り替えの状態管理
 *
 * 責務:
 * - viewAddress state の一元管理
 * - displayUser（表示対象アドレス）の導出
 *
 * 「ビューモード」という概念は廃止。
 * 常に検索可能で、表示と操作は独立。
 *
 * 使い方: page.tsxで useUpProvider と併用
 *   const { accounts, isConnected } = useUpProvider();
 *   const vm = useViewMode(accounts[0] || null);
 *   // → vm.displayAddress: 表示対象アドレス
 *   // → vm.walletAddress: 接続ウォレットアドレス
 */
export function useViewMode(
  walletAddress: `0x${string}` | null
) {
  const [viewAddress, setViewAddress] = useState<`0x${string}` | null>(null);

  return useMemo(() => ({
    viewAddress,
    setViewAddress,
    /** 表示対象アドレス: viewAddress優先、なければwallet */
    displayAddress: viewAddress ?? walletAddress,
    /** 接続ウォレットアドレス */
    walletAddress,
  }), [viewAddress, walletAddress]);
}
