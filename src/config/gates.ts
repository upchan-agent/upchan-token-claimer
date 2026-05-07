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
    { id: 'mint-gate',  label: 'Mint Gate',   address: '0x02de91f20da8ca1c9c694d6a14b4f336ba2fdf33',             type: 'requirements' },
    { id: 'hold-gate',  label: 'Hold Gate',   address: '0xa91c7fd46610a398893e3d4aaeb071d585e46b33',             type: 'requirements' },
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
