'use client';

import { useEffect, useState } from 'react';
import { ethers } from 'ethers';
import { TokenConfig, GATE_ABI, COMPOSITE_ABI, CHAINS } from '@/config/tokens';
import { TokenStatus } from '@/lib/useToken';
import { useUpProvider } from '@/lib/up-provider';
import { NoGate } from './NoGate';
import { FollowGate } from './FollowGate';
import { UnknownGate } from './UnknownGate';

interface Props {
  token: TokenConfig;
  status: TokenStatus;
  onRefetch: () => void;
  userAddress?: `0x${string}` | null;
}

type GateType = 'follow' | 'balance-native' | 'composite' | 'none' | 'unknown';

interface ChildGateData {
  address: string;
  gateType: GateType;
  passed: boolean;
  label: string;
  progress: string;
  target: string | null;
}

interface GateData {
  type: GateType;
  passed: boolean;
  label: string;
  progress: string;
  target: string | null;
  children: ChildGateData[];
  operator: string | null;
}

const ZERO_ADDR = '0x0000000000000000000000000000000000000000';

// ─── On-chain helpers ────────────────────────────────────

async function callView(provider: ethers.JsonRpcProvider, to: string, abi: string[], fn: string, args: unknown[] = []) {
  const c = new ethers.Contract(to, abi, provider);
  return c[fn](...args);
}

async function fetchTarget(addr: string, chainId: number): Promise<string | null> {
  try {
    const p = new ethers.JsonRpcProvider(CHAINS[chainId].rpc);
    const iface = new ethers.Interface(['function target() view returns (address)']);
    const data = iface.encodeFunctionData('target');
    const result = await p.call({ to: addr, data });
    const decoded = iface.decodeFunctionResult('target', result);
    return (decoded[0] as string).toLowerCase();
  } catch {
    return null;
  }
}

async function fetchChildGateData(
  childAddr: string,
  chainId: number,
  user: string | null
): Promise<ChildGateData> {
  const chain = CHAINS[chainId];
  if (!chain) {
    return { address: childAddr, gateType: 'unknown', passed: false, label: '', progress: '', target: null };
  }

  try {
    const p = new ethers.JsonRpcProvider(chain.rpc);
    const gate = new ethers.Contract(childAddr, GATE_ABI, p);

    let gtypeRaw = 'unknown';
    try { gtypeRaw = await gate.gateType(); } catch { /* fallback */ }
    const gtype = gtypeRaw.toLowerCase() as GateType;

    let passed = false;
    let label = '';
    let progress = '';
    const checkUser = user || '0x0000000000000000000000000000000000000001';
    try {
      const [p2, l, pr] = await gate.check(checkUser);
      passed = p2;
      label = l;
      progress = pr;
    } catch { /* check may fail */ }

    let target: string | null = null;
    if (gtype === 'follow') {
      target = await fetchTarget(childAddr, chainId);
    }

    return { address: childAddr, gateType: gtype || 'unknown', passed, label, progress, target };
  } catch {
    return { address: childAddr, gateType: 'unknown', passed: false, label: '', progress: '', target: null };
  }
}

async function fetchGateData(
  gateAddress: string,
  chainId: number,
  user: string | null
): Promise<GateData> {
  if (gateAddress === ZERO_ADDR) {
    return { type: 'none', passed: false, label: '', progress: '', target: null, children: [], operator: null };
  }

  const chain = CHAINS[chainId];
  if (!chain) {
    return { type: 'unknown', passed: false, label: '', progress: '', target: null, children: [], operator: null };
  }

  try {
    const p = new ethers.JsonRpcProvider(chain.rpc);
    const gate = new ethers.Contract(gateAddress, GATE_ABI, p);

    const gtypeRaw: string = await gate.gateType();
    const gtype = gtypeRaw.toLowerCase() as GateType;

    // Common: check(user) — all IGate contracts implement this
    // Always call check() even without user, so gate conditions are visible
    // before wallet connection
    let passed = false;
    let label = '';
    let progress = '';
    const checkUser = user || '0x0000000000000000000000000000000000000001';
    try {
      const [p2, l, pr] = await gate.check(checkUser);
      passed = p2;
      label = l;
      progress = pr;
    } catch { /* check may fail */ }

    // Type-specific data
    if (gtype === 'follow') {
      const target = await fetchTarget(gateAddress, chainId);
      return {
        type: 'follow', passed, label: label || 'Must follow on LUKSO', progress,
        target, children: [], operator: null,
      };
    }

    if (gtype === 'balance-native') {
      return {
        type: 'balance-native', passed, label, progress,
        target: null, children: [], operator: null,
      };
    }

    if (gtype === 'composite') {
      // Fetch children and operator
      let children: string[] = [];
      let operator = 'and';
      try {
        const compositeGate = new ethers.Contract(gateAddress, GATE_ABI.concat(COMPOSITE_ABI), p);
        children = await compositeGate.getChildren();
        operator = await compositeGate.getOperator();
      } catch {
        return { type: 'unknown', passed, label, progress, target: null, children: [], operator: null };
      }

      // Fetch each child's data
      const childPromises = children.map((addr: string) =>
        fetchChildGateData(addr.toLowerCase(), chainId, user)
      );
      const childData = await Promise.all(childPromises);

      return {
        type: 'composite', passed, label, progress,
        target: null, children: childData, operator,
      };
    }

    // Unknown gate type — render generically using check() results
    return {
      type: 'unknown', passed, label, progress,
      target: null, children: [], operator: null,
    };
  } catch {
    return {
      type: 'unknown', passed: false, label: '', progress: '',
      target: null, children: [], operator: null,
    };
  }
}

// ─── Component ───────────────────────────────────────────

export function GateRenderer({ token, status, onRefetch, userAddress }: Props) {
  const { accounts } = useUpProvider();
  const user = userAddress ?? accounts[0] ?? null;
  const hasGate = status.mintGate !== ZERO_ADDR;

  const [data, setData] = useState<GateData>({
    type: 'none', passed: false, label: '', progress: '',
    target: null, children: [], operator: null,
  });

  useEffect(() => {
    if (!hasGate) {
      setData({ type: 'none', passed: false, label: '', progress: '', target: null, children: [], operator: null });
      return;
    }

    let cancelled = false;
    fetchGateData(status.mintGate, token.chainId, user).then((result) => {
      if (cancelled) return;
      setData(result);
    });

    return () => { cancelled = true; };
  }, [status.mintGate, token.chainId, user, hasGate]);

  if (!hasGate) return <NoGate />;

  switch (data.type) {
    case 'follow':
      return (
        <FollowGate
          gatePassed={data.passed}
          gateLabel={data.label}
          gateTarget={data.target}
          onRefetch={onRefetch}
        />
      );

    case 'balance-native':
      return <UnknownGate passed={data.passed} label={data.label} progress={data.progress} />;

    case 'composite':
      return <CompositeDisplay data={data} onRefetch={onRefetch} />;

    default:
      // Unknown gate type — still display whatever check() returned
      return <UnknownGate passed={data.passed} label={data.label} progress={data.progress} />;
  }
}

// ─── Composite display sub-component ─────────────────────
// Renders CompositeGate data directly from check() response.
// CompositeGate.check() now returns detailed progress with all child gate
// info concatenated (e.g. "✓ Must follow on LUKSO | ✗ Hold 5.0 LYX").
// No additional eth_calls needed for child gates.

function CompositeDisplay({ data, onRefetch }: { data: GateData; onRefetch: () => void }) {
  const { accounts, isConnected } = useUpProvider();

  // Parse progress into individual conditions
  const conditions = data.progress
    ? data.progress.split(' | ').map((c) => {
        const passed = c.startsWith('\u2713 ');
        const label = c.slice(2);
        return { passed, label };
      })
    : [];

  // Check if any child is a follow gate
  const followChild = data.children.find(c => c.gateType === 'follow');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
      <p className="text-caption" style={{ margin: 0, lineHeight: 1.4 }}>
        {data.label}
        {data.operator && (
          <span style={{ textTransform: 'uppercase', fontWeight: 600, marginLeft: 'var(--space-2xs)' }}>
            ({data.operator})
          </span>
        )}
      </p>

      {/* Connect prompt when disconnected */}
      {!isConnected && (
        <p className="text-micro" style={{
          margin: 'var(--space-xs) 0 0',
          color: 'var(--c-text-tertiary)',
        }}>
          Connect your UP to check eligibility
        </p>
      )}

      {/* Individual conditions from progress string */}
      {conditions.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2xs)' }}>
          {conditions.map((cond, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 'var(--space-xs)',
              padding: 'var(--space-2xs) 0',
            }}>
              <span style={{
                width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                background: cond.passed ? 'var(--c-success)' : 'var(--c-text-tertiary)',
              }} />
              <span className="text-micro" style={{
                color: cond.passed ? 'var(--c-success)' : 'var(--c-text-tertiary)',
              }}>
                {cond.label}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Follow button */}
      {followChild && !data.passed && isConnected && (
        <FollowGate
          gatePassed={false}
          gateLabel=""
          gateTarget={followChild.target}
          onRefetch={onRefetch}
        />
      )}
    </div>
  );
}
