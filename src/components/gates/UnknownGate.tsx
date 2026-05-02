'use client';

export interface Condition {
  passed: boolean;
  label: string;
  progress?: string;
  gateType?: string;
  target?: string | null;
}

interface Props {
  conditions: Condition[];
}

/**
 * Unified condition list component.
 * Renders all gate types in the same format.
 * Follow conditions are handled by ProfileCard separately.
 */
export function UnknownGate({ conditions }: Props) {
  if (conditions.length === 0) return null;

  return (
    <div className="condition-list">
      {conditions.map((c, i) => (
        <div key={i} className="condition-row">
          <span className={`condition-dot condition-dot--${c.passed ? 'pass' : 'fail'}`} />
          <span className={`condition-label condition-label--${c.passed ? 'pass' : 'fail'}`}>
            {c.label}
          </span>
          {c.progress && (
            <span className={`condition-progress condition-progress--${c.passed ? 'pass' : 'fail'}`}>
              {c.progress}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
