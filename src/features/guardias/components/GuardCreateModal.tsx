'use client';

import { useState, type FormEvent } from 'react';
import { Check, Copy } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { DateField } from '@/components/ui/DateField';
import { EPI_ZONES, EPI_ZONE_LABELS } from '@/types/epi';
import type { EpiZone } from '@/types/epi';
import { guardFullName } from '../types';
import { generateGuardCredentialsAction } from '@/features/auth/actions/generateCredentials';

// RF-01, RF-03 (MASTER.md sección 7.3 y 13.2): el formulario captura solo
// datos biográficos (sin foto, sin campos de credenciales) — la BD genera
// usuario/contraseña, que se muestran una única vez en la pantalla de
// confirmación. Error de CI duplicado: inline bajo el campo, sin cerrar
// el modal (MASTER.md sección 10). Exclusivo de Generar Credenciales — migrado
// a la paleta 2026 el 2026-09-06 (MASTER.md sección 4): Modal/Input/Select
// con accent="gold", Button variant="ink".
//
// Bug real corregido 2026-09-14: este modal calculaba credenciales FALSAS
// en el cliente y mostraba "éxito" de inmediato, mientras la persistencia
// real (generateGuardCredentialsAction) se disparaba "en segundo plano"
// sin esperar la respuesta ni mostrar el error si fallaba
// (`.catch(() => {})` en GenerateCredentialsView) — el guardia podía NO
// haberse creado en la base real y el Operador nunca se enteraba, además
// de que las credenciales mostradas (inventadas localmente) no coincidían
// con las reales. Ahora este modal llama a la Server Action directo,
// espera la respuesta, y muestra las credenciales reales que devuelve el
// backend (o el error real si falla).

export interface GuardCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingCis: string[];
  onCreated: (data: {
    primerNombre: string;
    segundoNombre?: string;
    apellidoPaterno: string;
    apellidoMaterno: string;
    ci: string;
    fechaNacimiento: string;
    telefono: string;
    epi: EpiZone;
  }) => void;
}

type Phase = 'form' | 'loading' | 'success';

export function GuardCreateModal({ isOpen, onClose, existingCis, onCreated }: GuardCreateModalProps) {
  const [phase, setPhase] = useState<Phase>('form');
  const [ciError, setCiError] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<{ usuario: string; password: string } | null>(null);
  const [createdName, setCreatedName] = useState('');
  const [copied, setCopied] = useState(false);

  function reset() {
    setPhase('form');
    setCiError(null);
    setCredentials(null);
    setCopied(false);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const data = {
      primerNombre: String(formData.get('primerNombre') ?? '').trim(),
      segundoNombre: String(formData.get('segundoNombre') ?? '').trim() || undefined,
      apellidoPaterno: String(formData.get('apellidoPaterno') ?? '').trim(),
      apellidoMaterno: String(formData.get('apellidoMaterno') ?? '').trim(),
      ci: String(formData.get('ci') ?? '').trim(),
      fechaNacimiento: String(formData.get('fechaNacimiento') ?? '').trim(),
      telefono: String(formData.get('telefono') ?? '').trim(),
      epi: String(formData.get('epi') ?? '') as EpiZone,
    };

    if (existingCis.includes(data.ci)) {
      setCiError('La Cédula de Identidad ingresada ya se encuentra registrada en el sistema.');
      return;
    }

    setCiError(null);
    setPhase('loading');

    const result = await generateGuardCredentialsAction(data);
    if (!result.success || !result.usuario || !result.passwordTemporal) {
      setPhase('form');
      setCiError(result.error ?? 'No se pudo crear el guardia. Intente nuevamente.');
      return;
    }

    setCredentials({ usuario: result.usuario, password: result.passwordTemporal });
    setCreatedName(guardFullName(data));
    onCreated(data);
    setPhase('success');
  }

  async function handleCopy() {
    if (!credentials) return;
    const text = `Usuario: ${credentials.usuario}\nContraseña: ${credentials.password}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API no disponible (contexto no seguro) — el usuario copia manualmente.
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Registrar Nuevo Guardia" accent="gold" dismissible={phase !== 'success'}>
      {phase === 'success' && credentials ? (
        <div className="animate-fade-in p-6">
          <div className="mb-3.5 flex justify-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-risk-low/10">
              <Check className="h-6 w-6 text-risk-low" aria-hidden="true" />
            </span>
          </div>
          <p className="mb-1 text-center text-base font-semibold text-brand-ink-900">
            Guardia registrado con éxito
          </p>
          <p className="mb-4 text-center text-[12.5px] text-neutral-text-muted">{createdName}</p>

          <div className="mb-4 rounded-lg border-l-[3px] border-brand-gold-500 bg-neutral-bg p-3.5">
            <div className="mb-2 flex items-center justify-between text-[12.5px]">
              <span className="text-neutral-text-muted">Usuario temporal</span>
              <span className="font-mono font-semibold text-neutral-text">{credentials.usuario}</span>
            </div>
            <div className="flex items-center justify-between text-[12.5px]">
              <span className="text-neutral-text-muted">Contraseña temporal</span>
              <span className="font-mono font-semibold text-neutral-text">{credentials.password}</span>
            </div>
          </div>

          <Button variant="secondary" onClick={handleCopy} className="mb-4 w-full">
            <Copy className="h-4 w-4" aria-hidden="true" />
            {copied ? 'Copiado' : 'Copiar credenciales'}
          </Button>

          <label className="mb-4 flex items-start gap-2 text-xs text-neutral-text">
            <input type="checkbox" checked disabled className="mt-0.5" />
            El guardia deberá cambiar su contraseña en el primer inicio de sesión (obligatorio, no editable)
          </label>

          <Button variant="ink" onClick={handleClose} className="w-full">
            Cerrar
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="p-5">
          {ciError && (
            <div role="alert" className="mb-3.5 animate-fade-in rounded-md border border-risk-critical/20 bg-risk-critical/10 px-3 py-2.5 text-xs text-risk-critical">
              {ciError}
            </div>
          )}

          <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input label="Primer Nombre" name="primerNombre" accent="gold" required disabled={phase === 'loading'} />
            <Input label="Segundo Nombre" name="segundoNombre" accent="gold" disabled={phase === 'loading'} />
          </div>
          <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input label="Apellido Paterno" name="apellidoPaterno" accent="gold" required disabled={phase === 'loading'} />
            <Input label="Apellido Materno" name="apellidoMaterno" accent="gold" required disabled={phase === 'loading'} />
          </div>
          <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input label="Cédula de Identidad" name="ci" placeholder="0000000" accent="gold" required disabled={phase === 'loading'} />
            <DateField label="Fecha de Nacimiento" name="fechaNacimiento" required disabled={phase === 'loading'} />
          </div>
          <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input label="Teléfono" name="telefono" placeholder="+591 7XX XXXXX" accent="gold" required disabled={phase === 'loading'} />
            <Select label="EPI / Distrito asignado" name="epi" accent="gold" required disabled={phase === 'loading'} defaultValue="">
              <option value="" disabled>
                Seleccione una EPI
              </option>
              {EPI_ZONES.map((zone) => (
                <option key={zone} value={zone}>
                  EPI {EPI_ZONE_LABELS[zone]}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex gap-2.5">
            <Button type="button" variant="secondary" onClick={handleClose} className="flex-1" disabled={phase === 'loading'}>
              Cancelar
            </Button>
            <Button type="submit" variant="ink" isLoading={phase === 'loading'} className="flex-1">
              Generar Credenciales
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
