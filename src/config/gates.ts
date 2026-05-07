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
    { id: 'mint-gate',  label: 'Mint Gate',   address: '0xC915508fea5ee6a782C899CD4D34b09C6EB7b03e',             type: 'requirements' },
    { id: 'hold-gate',  label: 'Hold Gate',   address: '0x7DEb57edda3EE65539D8a4b5bC3348656A08c57D',             type: 'requirements' },
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
