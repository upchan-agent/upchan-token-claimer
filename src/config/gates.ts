// ═══════════════════════════════════════════════
// 🆙chan Token Claimer — Gate Configuration
// Pre-deployed gate contracts for easy selection
// ═══════════════════════════════════════════════

export interface GateOption {
  id: string;
  label: string;
  address: `0x${string}`;
  type: string;
}

const ZERO = '0x0000000000000000000000000000000000000000' as const;

export const GATES: Record<number, GateOption[]> = {
  // ─── LUKSO Testnet (4201) ───
  4201: [
    { id: 'none',       label: 'No Gate',     address: ZERO,                                                    type: 'none' },
    { id: 'req-old',    label: 'Custom Gate (Legacy)', address: '0xdD85274e255738603088312daF502Aa103959a97',     type: 'requirements' },
    { id: 'mint-gate',  label: 'Mint Gate',   address: '0x0f5e76f21d7dcaa67abff1d7541adb0e8781116d',             type: 'requirements' },
    { id: 'hold-gate',  label: 'Hold Gate',   address: '0xce4ed1afb7c824be99e865981c1da98d7f230c29',             type: 'requirements' },
  ],

  // ─── LUKSO Mainnet (42) ───
  42: [
    { id: 'none', label: 'No Gate', address: ZERO, type: 'none' },
  ],
};

/** Return a single gate option by address, or null */
export function findGate(chainId: number, address: string): GateOption | null {
  const gates = GATES[chainId];
  if (!gates) return null;
  return gates.find(g => g.address.toLowerCase() === address.toLowerCase()) || null;
}
