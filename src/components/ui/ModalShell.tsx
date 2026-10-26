import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import BusyOverlay, { type BusyVariant } from './BusyOverlay';

const SIZE: Record<string, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl',
  full: 'max-w-5xl',
};

interface ModalShellProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  size?: keyof typeof SIZE;
  /** Clase extra del panel (card) */
  className?: string;
  /** No cerrar al hacer clic en el fondo */
  disableBackdropClose?: boolean;
  /** Bloquea cierre (p. ej. mientras guarda) */
  busy?: boolean;
  busyLabel?: string;
  busyVariant?: BusyVariant;
}

/** Diálogo modal overlay centrado mediante Portal a document.body */
export default function ModalShell({
  open,
  onClose,
  children,
  size = 'lg',
  className = '',
  disableBackdropClose = false,
  busy = false,
  busyLabel,
  busyVariant = 'saving',
}: ModalShellProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose, busy]);

  if (!open) return null;

  const content = (
    <div
      className="dialog-inline-host"
      role="dialog"
      aria-modal="true"
      onClick={() => {
        if (!disableBackdropClose && !busy) onClose();
      }}
    >
      <div
        className={`
          relative w-full ${SIZE[size]} overflow-y-auto scrollbar-thin
          card modal-panel
          ${className}
        `}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
        <BusyOverlay show={busy} label={busyLabel} variant={busyVariant} contained />
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(content, document.body) : content;
}
