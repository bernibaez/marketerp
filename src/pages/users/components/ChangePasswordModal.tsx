import React, { useState } from 'react';
import { KeyRound, Eye, EyeOff, CheckCircle2, AlertCircle } from 'lucide-react';
import ModalShell from '@/components/ui/ModalShell';
import { toast } from '@/lib/toast';
import { cambiarPasswordUsuario } from '@/services/usuarios.service';

export interface UserPasswordTarget {
  id: string;
  nombre_completo?: string;
  correo?: string;
  name?: string;
  email?: string;
}

interface ChangePasswordModalProps {
  user: UserPasswordTarget | null;
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function ChangePasswordModal({ user, open, onClose, onSuccess }: ChangePasswordModalProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const displayName = user?.nombre_completo || user?.name || 'Usuario';
  const displayEmail = user?.correo || user?.email || '';

  const reset = () => {
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setShowConfirm(false);
    setErrorMsg(null);
  };

  const handleClose = () => {
    if (saving) return;
    reset();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!user?.id) {
      toast.error('No se seleccionó un usuario válido');
      return;
    }

    if (!password.trim()) {
      setErrorMsg('Por favor escribe la nueva contraseña');
      return;
    }

    if (password.trim().length < 6) {
      setErrorMsg('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('Las contraseñas no coinciden');
      return;
    }

    setSaving(true);
    try {
      await cambiarPasswordUsuario(user.id, password.trim(), displayEmail);
      toast.success(`Contraseña de "${displayName}" actualizada correctamente`);
      reset();
      onSuccess?.();
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al cambiar contraseña');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell open={open} onClose={handleClose} size="md" className="p-6">
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-border pb-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
            <KeyRound size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">Cambiar Contraseña</h2>
            <p className="text-xs text-muted-foreground">
              Actualiza las credenciales de acceso para este usuario
            </p>
          </div>
        </div>

        {/* User preview */}
        <div className="flex items-center gap-3 p-3 bg-secondary/40 rounded-xl border border-border/60">
          <div className="w-9 h-9 rounded-full bg-primary/20 text-primary font-bold flex items-center justify-center text-sm">
            {displayName.charAt(0).toUpperCase()}
          </div>
          <div className="overflow-hidden">
            <p className="text-sm font-bold text-foreground truncate">{displayName}</p>
            {displayEmail && (
              <p className="text-xs text-muted-foreground truncate">{displayEmail}</p>
            )}
          </div>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-danger-bg/40 border border-danger/30 text-danger text-xs flex items-center gap-2">
            <AlertCircle size={15} className="flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Password inputs */}
        <div className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-foreground mb-1">
              Nueva Contraseña <span className="text-danger">*</span>
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                className="input-field w-full pr-10"
                placeholder="Ingresa la nueva contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                disabled={saving}
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Mínimo 6 caracteres alfanuméricos
            </p>
          </div>

          <div>
            <label className="block font-bold text-foreground mb-1">
              Confirmar Nueva Contraseña <span className="text-danger">*</span>
            </label>
            <div className="relative">
              <input
                type={showConfirm ? 'text' : 'password'}
                className="input-field w-full pr-10"
                placeholder="Repite la nueva contraseña"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                disabled={saving}
              />
              <button
                type="button"
                onClick={() => setShowConfirm((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
          <button
            type="button"
            className="btn-secondary text-xs py-2 px-4 cursor-pointer"
            onClick={handleClose}
            disabled={saving}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="btn-primary text-xs font-bold py-2 px-5 flex items-center gap-2 cursor-pointer shadow-sm"
            disabled={saving || !password.trim()}
          >
            <CheckCircle2 size={15} />
            <span>{saving ? 'Guardando…' : 'Actualizar Contraseña'}</span>
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

