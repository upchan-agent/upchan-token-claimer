'use client';

import { useEffect, useCallback, useRef } from 'react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Fixed container width (e.g. '400px', '85vw'). Overrides max-constrained sizing. */
  fixedWidth?: string;
  /** Fixed container height (e.g. '500px', '85vh'). Overrides max-constrained sizing. */
  fixedHeight?: string;
}

export function Popup({ isOpen, onClose, children, fixedWidth, fixedHeight }: Props) {
  const prevOverflow = useRef<string>('');

  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      prevOverflow.current = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      document.addEventListener('keydown', handleKey);
    }
    return () => {
      document.body.style.overflow = prevOverflow.current;
      document.removeEventListener('keydown', handleKey);
    };
  }, [isOpen, handleKey]);

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      onTouchEnd={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.8)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: fixedWidth || 'auto',
          height: fixedHeight || 'auto',
          maxWidth: fixedWidth ? undefined : '90vw',
          maxHeight: fixedHeight ? undefined : '90vh',
          position: 'relative',
        }}
      >
        <button
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          onTouchEnd={(e) => { e.stopPropagation(); onClose(); }}
          style={{
            position: 'absolute', top: -12, right: -12,
            width: 28, height: 28, border: 'none',
            borderRadius: '50%',
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(8px)',
            color: 'white', fontSize: 14, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1,
          }}
        >
          ✕
        </button>
        {children}
      </div>
    </div>
  );
}
