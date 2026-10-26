import React from 'react';

interface PermissionToggleProps {
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
  label: string;
}

export function PermissionToggle({
  checked,
  disabled,
  onChange,
  label,
}: PermissionToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className={`
        relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors duration-200
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40
        disabled:opacity-40 disabled:cursor-not-allowed
        ${checked ? 'bg-primary' : 'bg-muted'}
      `}
    >
      <span
        className={`
          inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200
          ${checked ? 'translate-x-6' : 'translate-x-1'}
        `}
      />
    </button>
  );
}
