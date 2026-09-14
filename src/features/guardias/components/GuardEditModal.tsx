'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Power, PowerOff } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { EPI_ZONES, EPI_ZONE_LABELS } from '@/types/epi';
import type { EpiZone } from '@/types/epi';
import { updateGuardiaAction, toggleGuardiaEstadoAction } from '../actions/manageGuardia';
import { ACCOUNT_STATUS_LABELS, guardFullName, type Guard } from '../types';

// RF-01, RF-12 (MASTER.md sección 15.1): Super Admin y Admin editan datos
// biográficos y activan/desactivan la cuenta — nunca crean (eso vive en
// Generar Credenciales, MASTER.md sección 15.2). Ambas mutaciones pasan
// por Server Actions que revalidan el rol (sección 15.5).

export interface GuardEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  guard: Guard | null;
  onSaved: (guard: Guard) => void;
}

export function GuardEditModal({ isOpen, onClose, guard, onSaved }: GuardEditModalProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) setError(null);
  }, [isOpen, guard?.id]);

  if (!guard) return null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!guard) return;
    const formData = new FormData(event.currentTarget);
    setIsSaving(true);
    setError(null);

    const result = await updateGuardiaAction(guard.id, {
      primerNombre: String(formData.get('primerNombre') ?? '').trim(),
      segundoNombre: String(formData.get('segundoNombre') ?? '').trim() || undefined,
      apellidoPaterno: String(formData.get('apellidoPaterno') ?? '').trim(),
      apellidoMaterno: String(formData.get('apellidoMaterno') ?? '').trim(),
      telefono: String(formData.get('telefono') ?? '').trim(),
      epiId: String(formData.get('epi') ?? ''),
    });

    setIsSaving(false);
    if (!result.success || !result.guard) {
      setError(result.error ?? 'No se pudo guardar los cambios.');
      return;
    }
    onSaved(result.guard);
    onClose();
  }

  async function handleToggleEstado() {
    if (!guard) return;
    const nextEstado = guard.accountStatus === 'activo' ? 'inactivo' : 'activo';
    setIsToggling(true);
    setError(null);

    const result = await toggleGuardiaEstadoAction(guard.id, nextEstado);

    setIsToggling(false);
    if (!result.success || !result.guard) {
      setError(result.error ?? 'No se pudo cambiar el estado de la cuenta.');
      return;
    }
    onSaved(result.guard);
  }

  const isActive = guard.accountStatus === 'activo';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Editar — ${guardFullName(guard)}`}>
      <form onSubmit={handleSubmit} className="p-5">
        {error && (
          <div role="alert" className="mb-3.5 animate-fade-in rounded-md border border-risk-critical/20 bg-risk-critical/10 px-3 py-2.5 text-xs text-risk-critical">
            {error}
          </div>
        )}

        <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input label="Primer Nombre" name="primerNombre" defaultValue={guard.primerNombre} required disabled={isSaving} />
          <Input label="Segundo Nombre" name="segundoNombre" defaultValue={guard.segundoNombre} disabled={isSaving} />
        </div>
        <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input label="Apellido Paterno" name="apellidoPaterno" defaultValue={guard.apellidoPaterno} required disabled={isSaving} />
          <Input label="Apellido Materno" name="apellidoMaterno" defaultValue={guard.apellidoMaterno} disabled={isSaving} />
        </div>
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input label="Teléfono" name="telefono" defaultValue={guard.telefono} placeholder="+591 7XX XXXXX" required disabled={isSaving} />
          <Select label="EPI / Distrito asignado" name="epi" defaultValue={guard.epi} required disabled={isSaving}>
            {EPI_ZONES.map((zone: EpiZone) => (
              <option key={zone} value={zone}>
                EPI {EPI_ZONE_LABELS[zone]}
              </option>
            ))}
          </Select>
        </div>

        <div className="mb-4 flex items-center justify-between rounded-lg bg-neutral-bg p-3.5">
          <div>
            <p className="text-xs font-semibold text-neutral-text">Estado de cuenta</p>
            <p className="text-xs text-neutral-text-muted">{ACCOUNT_STATUS_LABELS[guard.accountStatus]}</p>
          </div>
          <Button
            type="button"
            variant={isActive ? 'destructive' : 'secondary'}
            onClick={handleToggleEstado}
            isLoading={isToggling}
            disabled={isSaving}
          >
            {isActive ? <PowerOff className="h-3.5 w-3.5" aria-hidden="true" /> : <Power className="h-3.5 w-3.5" aria-hidden="true" />}
            {isActive ? 'Desactivar' : 'Activar'}
          </Button>
        </div>

        <div className="flex gap-2.5">
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1" disabled={isSaving}>
            Cancelar
          </Button>
          <Button type="submit" isLoading={isSaving} className="flex-1">
            Guardar Cambios
          </Button>
        </div>
      </form>
    </Modal>
  );
}
