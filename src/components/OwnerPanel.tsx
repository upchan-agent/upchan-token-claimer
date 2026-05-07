'use client';

import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { TokenConfig } from '@/config/tokens';
import { GATES, findGate } from '@/config/gates';
import { TokenStatus } from '@/lib/useToken';
import { useOwnerActions } from '@/lib/useOwnerActions';
import { useUpProvider } from '@/lib/up-provider';
import { EmojiText } from './EmojiText';
import { GateConditionsEditor } from './GateConditionsEditor';
import { useTxContext } from '@/lib/tx-context';

interface Props {
  token: TokenConfig | null;
  status: TokenStatus;
  chain: { name: string; explorer: string };
  onDone: () => void;
}

// ─── Collapsible section ────────────────────────────────

function Section({
  label, children, open, onToggle, danger,
}: {
  label: string;
  children: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  danger?: boolean;
}) {
  return (
    <div className="owner-section">
      <button
        className={'owner-section-header' + (danger ? ' owner-section-header--danger' : '')}
        onClick={onToggle}
      >
        <span>{label}</span>
        <span className={'owner-chevron' + (open ? ' owner-chevron--open' : '')}>{'\u25BE'}</span>
      </button>
      {open && <div className="owner-section-body">{children}</div>}
    </div>
  );
}

// ─── Gate selector ──────────────────────────────────────

function GatePicker({
  currentAddress, chainId, disabled, onApply, onLock, isLocked, lockLabel,
}: {
  currentAddress: string;
  chainId: number;
  disabled: boolean;
  onApply: (addr: string) => void;
  onLock: () => void;
  isLocked: boolean;
  lockLabel: string;
}) {
  const gates = GATES[chainId] || [];
  const currentGate = findGate(chainId, currentAddress);
  const [selected, setSelected] = useState(currentGate?.address || 'none');
  const isNone = currentAddress === '0x0000000000000000000000000000000000000000';

  return (
    <div>
      <div className="data-row">
        <span className="data-label">Current</span>
        <span className="data-value text-caption">
          {isNone ? 'None' : (currentGate?.label || currentAddress.slice(0, 10) + '...' + currentAddress.slice(-6))}
          {isLocked && ' \uD83D\uDD12'}
        </span>
      </div>
      {!isLocked && (
        <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
          <select
            value={selected}
            onChange={e => setSelected(e.target.value)}
            className="owner-input"
            style={{ flex: 1, minWidth: 180 }}
          >
            {gates.map(g => (
              <option key={g.id} value={g.address}>{g.label}</option>
            ))}
          </select>
          <button onClick={() => onApply(selected)} disabled={disabled} className="btn btn-primary btn-sm">
            Apply
          </button>
          <button
            onClick={() => {
              if (window.confirm(lockLabel + '? This cannot be undone!')) onLock();
            }}
            disabled={disabled}
            className="btn btn-secondary btn-sm btn-danger"
          >
            {lockLabel}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main component ─────────────────────────────────────

export function OwnerPanel({ token, status, chain, onDone }: Props) {
  const { accounts } = useUpProvider();
  const { sendTx } = useTxContext();
  const isOwner = !!accounts[0] && status.owner.toLowerCase() === accounts[0].toLowerCase();
  const actions = useOwnerActions(token, accounts[0] || null);
  const [openSection, setOpen] = useState<string | null>(null);
  const toggle = (s: string) => setOpen(o => o === s ? null : s);
  const chainId = token?.chainId || 4201;

  const [capInput, setCapInput] = useState('');
  const [revokeAddr, setRevokeAddr] = useState('');
  const [revokeAmount, setRevokeAmount] = useState('1');

  const handleToggle = (s: string) => {
    toggle(s);
    if (s === 'supply') setCapInput(String(status.supplyCap));
    if (s === 'revoke') { setRevokeAddr(''); setRevokeAmount('1'); }
  };

  const statusPill = status.mintingDisabled ? 'status-pill--closed'
    : status.isMintable ? 'status-pill--open'
    : 'status-pill--paused';
  const statusLabel = status.mintingDisabled ? 'Minting Closed'
    : status.isMintable ? 'Minting Open'
    : 'Paused';

  const hasHoldGate = status.holdGate !== '0x0000000000000000000000000000000000000000';

  if (!isOwner) return null;

  return (
    <div className="card anim anim-d5">
      <div className="card-section">
        <span className="section-label">{'\uD83D\uDEE0\uFE0F'} Manage Token</span>

        {/* Mint Control */}
        <Section label="Mint Control" open={openSection === 'mint'} onToggle={() => handleToggle('mint')}>
          <div className="data-row">
            <span className="data-label">Status</span>
            <span className="data-value"><span className={'status-pill ' + statusPill}>{statusLabel}</span></span>
          </div>
          {!status.mintingDisabled && (
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button
                onClick={async () => {
                  await actions.setIsMintable(!status.isMintable);
                  onDone();
                }}
                disabled={actions.isPending}
                className="btn btn-primary btn-sm"
              >
                {status.isMintable ? 'Pause Minting' : 'Resume Minting'}
              </button>
              <button
                onClick={async () => {
                  if (window.confirm('Permanently disable minting?')) {
                    await actions.disableMinting();
                    onDone();
                  }
                }}
                disabled={actions.isPending}
                className="btn btn-secondary btn-sm btn-danger"
              >
                Disable
              </button>
            </div>
          )}
          {status.mintingDisabled && (
            <p className="text-caption" style={{ color: 'var(--c-text-tertiary)', marginTop: 8 }}>
              Minting is permanently disabled.
            </p>
          )}
        </Section>

        {/* Supply Cap */}
        <Section label="Supply Cap" open={openSection === 'supply'} onToggle={() => handleToggle('supply')}>
          <div className="data-row">
            <span className="data-label">Supply</span>
            <span className="data-value">{Number(status.totalSupply)} / {status.supplyCap === 0n ? '∞' : String(status.supplyCap)}</span>
          </div>
          <div className="data-row">
            <span className="data-label">Cap</span>
            <span className="data-value">{status.isSupplyCapLocked ? 'Locked \uD83D\uDD12' : 'Flexible'}</span>
          </div>
          {!status.isSupplyCapLocked && (
            <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
              <input
                type="number"
                value={capInput}
                onChange={e => setCapInput(e.target.value)}
                placeholder="New cap"
                className="owner-input"
                style={{ width: 100 }}
                min={Number(status.totalSupply)}
              />
              <button
                onClick={async () => {
                  const cap = BigInt(capInput || '0');
                  if (cap <= 0n || cap < status.totalSupply) return;
                  await actions.updateSupplyCap(cap);
                  onDone();
                }}
                disabled={actions.isPending || !capInput}
                className="btn btn-primary btn-sm"
              >
                Update
              </button>
              <button
                onClick={async () => {
                  if (window.confirm('Lock supply cap permanently?')) {
                    await actions.lockSupplyCap();
                    onDone();
                  }
                }}
                disabled={actions.isPending}
                className="btn btn-secondary btn-sm btn-danger"
              >
                Lock
              </button>
            </div>
          )}
        </Section>

        {/* Mint Gate */}
        <Section label="Mint Gate" open={openSection === 'gate'} onToggle={() => handleToggle('gate')}>
          <div className="data-row">
            <span className="data-label">Active</span>
            <span className="data-value text-caption">
              {findGate(chainId, status.mintGate)?.label || (
                status.mintGate !== '0x0000000000000000000000000000000000000000'
                  ? status.mintGate.slice(0, 10) + '...' + status.mintGate.slice(-6)
                  : 'None'
              )}
              {status.isMintGateLocked && ' \uD83D\uDD12'}
            </span>
          </div>
          {!status.isMintGateLocked && (
            <div className="owner-action-row">
              <select
                value={status.mintGate}
                onChange={async (e) => {
                  await actions.setMintGate(e.target.value);
                  onDone();
                }}
                className="owner-input"
                style={{ flex: 1, minWidth: 180 }}
              >
                {(GATES[chainId] || []).map(g => (
                  <option key={g.id} value={g.address}>{g.label}</option>
                ))}
              </select>
              <button
                onClick={async () => {
                  if (window.confirm('Lock Mint Gate?')) { await actions.lockMintGate(); onDone(); }
                }}
                disabled={actions.isPending}
                className="btn btn-secondary btn-sm btn-danger"
              >
                Lock
              </button>
            </div>
          )}
          <GateConditionsEditor
            gateAddress={status.mintGate}
            chainId={chainId}
            onDone={onDone}
          />
          {status.mintGate !== '0x0000000000000000000000000000000000000000' && (
            <div className="owner-action-row" style={{ marginTop: 8 }}>
              <button
                onClick={async () => {
                  if (!window.confirm('Lock conditions permanently? This cannot be undone!')) return;
                  const iface = new ethers.Interface(['function lockConditions()']);
                  const data = iface.encodeFunctionData('lockConditions');
                  await sendTx('Lock Conditions', status.mintGate as `0x${string}`, data, chainId);
                  onDone();
                }}
                className="btn btn-secondary btn-sm btn-danger"
              >
                Lock Conditions
              </button>
            </div>
          )}
        </Section>

        <Section label="Hold Gate" open={openSection === 'hold'} onToggle={() => handleToggle('hold')}>
          <div className="data-row">
            <span className="data-label">Active</span>
            <span className="data-value text-caption">
              {findGate(chainId, status.holdGate)?.label || (
                status.holdGate !== '0x0000000000000000000000000000000000000000'
                  ? status.holdGate.slice(0, 10) + '...' + status.holdGate.slice(-6)
                  : 'None'
              )}
              {status.isHoldGateLocked && ' 🔒'}
            </span>
          </div>
          {!status.isHoldGateLocked && (
            <div className="owner-action-row">
              <select
                value={status.holdGate}
                onChange={async (e) => {
                  await actions.setHoldGate(e.target.value);
                  onDone();
                }}
                className="owner-input"
                style={{ flex: 1, minWidth: 180 }}
              >
                {(GATES[chainId] || []).map(g => (
                  <option key={g.id} value={g.address}>{g.label}</option>
                ))}
              </select>
              <button
                onClick={async () => {
                  if (window.confirm('Lock Hold Gate?')) { await actions.lockHoldGate(); onDone(); }
                }}
                disabled={actions.isPending}
                className="btn btn-secondary btn-sm btn-danger"
              >
                Lock
              </button>
            </div>
          )}
          <GateConditionsEditor
            gateAddress={status.holdGate}
            chainId={chainId}
            onDone={onDone}
          />
          {status.holdGate !== '0x0000000000000000000000000000000000000000' && (
            <div className="owner-action-row" style={{ marginTop: 8 }}>
              <button
                onClick={async () => {
                  if (!window.confirm('Lock conditions permanently? This cannot be undone!')) return;
                  const iface = new ethers.Interface(['function lockConditions()']);
                  const data = iface.encodeFunctionData('lockConditions');
                  await sendTx('Lock Conditions', status.holdGate as `0x${string}`, data, chainId);
                  onDone();
                }}
                className="btn btn-secondary btn-sm btn-danger"
              >
                Lock Conditions
              </button>
            </div>
          )}
        </Section>

        {/* Revoke */}
        <Section label="Revoke" open={openSection === 'revoke'} onToggle={() => handleToggle('revoke')}>
          {!status.revokable ? (
            <p className="text-caption" style={{ color: 'var(--c-text-tertiary)' }}>Revoke not enabled.</p>
          ) : (
            <>
              <div className="data-row">
                <span className="data-label">Target</span>
                <span className="data-value" style={{ justifyContent: 'flex-start' }}>
                  <input
                    value={revokeAddr}
                    onChange={e => setRevokeAddr(e.target.value)}
                    placeholder="0x..."
                    className="owner-input"
                    style={{ flex: 1, fontFamily: 'monospace', fontSize: 12 }}
                  />
                </span>
              </div>
              <div className="data-row">
                <span className="data-label">Amount</span>
                <span className="data-value" style={{ justifyContent: 'flex-start' }}>
                  <input
                    type="number"
                    value={revokeAmount}
                    onChange={e => setRevokeAmount(e.target.value)}
                    min={1}
                    className="owner-input"
                    style={{ width: 70 }}
                  />
                </span>
              </div>
              {hasHoldGate && (
                <button
                  onClick={async () => {
                    if (!revokeAddr || !ethers.isAddress(revokeAddr)) return;
                    if (!window.confirm('Revoke from ' + revokeAddr.slice(0, 8) + '...?')) return;
                    await actions.revokeByGate(revokeAddr, status.owner, BigInt(revokeAmount || '1'));
                    onDone();
                  }}
                  disabled={actions.isPending || !revokeAddr || !ethers.isAddress(revokeAddr)}
                  className="btn btn-primary btn-sm"
                  style={{ marginTop: 8 }}
                >
                  Revoke by Gate
                </button>
              )}
              {!hasHoldGate && (
                <p className="text-caption" style={{ color: 'var(--c-text-tertiary)', marginTop: 8 }}>
                  No Hold Gate configured.
                </p>
              )}
            </>
          )}
        </Section>

        {/* Danger Zone */}
        <Section label="Danger Zone" open={openSection === 'danger'} onToggle={() => handleToggle('danger')} danger>
          <p className="text-caption" style={{ color: 'var(--c-error)', marginBottom: 10, fontWeight: 600 }}>
            {'\u26A0\uFE0F'} These actions are irreversible. Proceed with caution.
          </p>

          {/* Make Transferable */}
          <div className="data-row" style={{ border: 'none' }}>
            <span className="data-label">Soulbound</span>
            {status.isSoulbound ? (
              <span className="data-value">
                <button
                  onClick={async () => {
                    if (window.confirm('Make transferable permanently?')) {
                      await actions.makeTransferable();
                      onDone();
                    }
                  }}
                  disabled={actions.isPending}
                  className="btn btn-secondary btn-sm btn-danger"
                >
                  Make Transferable
                </button>
              </span>
            ) : (
              <span className="data-value text-caption" style={{ color: 'var(--c-text-tertiary)' }}>Already transferable</span>
            )}
          </div>

          {/* Renounce Ownership */}
          <div className="data-row" style={{ border: 'none', marginTop: 8 }}>
            <span className="data-label">Ownership</span>
            <span className="data-value">
              <button
                onClick={async () => {
                  if (window.confirm('Are you sure? This permanently renounces ownership.\n\nAfter this:\n- Gate and supply cap settings become permanent\n- Minting can never be re-enabled if disabled\n- No one can ever modify this token again')) {
                    if (window.confirm('FINAL WARNING: This action CANNOT be undone. Renounce ownership?')) {
                      await actions.renounceOwnership();
                      onDone();
                    }
                  }
                }}
                disabled={actions.isPending}
                className="btn btn-secondary btn-sm btn-danger"
              >
                Renounce Ownership
              </button>
            </span>
          </div>
        </Section>

      </div>
    </div>
  );
}
