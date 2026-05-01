interface Props {
  passed: boolean;
  label: string;
  progress: string;
}

/**
 * Generic gate display component.
 * Renders whatever check() returns from any IGate-compliant contract.
 * Used as fallback for unknown gate types and as the display for
 * self-rendering gate types like "balance-native".
 */
export function UnknownGate({ passed, label, progress }: Props) {
  if (!label && !progress) {
    return (
      <p className="text-caption" style={{ margin: 'var(--space-2xs) 0' }}>
        Minting requires meeting on-chain conditions
      </p>
    );
  }

  return (
    <>
      {label && (
        <p className="text-caption" style={{ margin: 'var(--space-2xs) 0', lineHeight: 1.4 }}>
          {label}
        </p>
      )}

      {progress && (
        <p className="text-micro" style={{
          margin: 'var(--space-2xs) 0',
          color: passed ? 'var(--c-success)' : 'var(--c-text-tertiary)',
        }}>
          {progress}
        </p>
      )}
    </>
  );
}
