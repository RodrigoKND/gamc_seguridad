'use client';

import { useState, type FormEvent } from 'react';
import { Check, Copy } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { generateUserCredentialsAction } from '../actions/generateCredentials';
import { USER_ROLE_LABELS, type UserRole } from '../types';

// RF-01, RF-03 (MASTER.md sección 7.3 y 15.4). Alta de Operador/Administrador
// — MISMO formulario y lógica que GuardCreateModal: nombres/apellidos/
// teléfono, validación de duplicado inline bajo el campo sin cerrar el
// modal (MASTER.md sección 10), y confirmación con nombre completo +
// usuario/contraseña mostrados una sola vez. La única diferencia real es
// el campo identificador (correo en vez de CI + fecha de nacimiento) y que
// la contraseña temporal es aleatoria, no la fecha de nacimiento — ver el
// TODO en features/auth/actions/generateCredentials.ts citando MASTER.md 15.4.
// Migrado a la paleta 2026 el 2026-09-06 (MASTER.md sección 4): Modal/Input
// con accent="gold", Button variant="ink".

export interface UserCredentialModalProps {
  isOpen: boolean;
  onClose: () => void;
  role: Exclude<UserRole, 'super_admin'>;
  existingEmails: string[];
}

type Phase = 'form' | 'loading' | 'success';

export function UserCredentialModal({ isOpen, onClose, role, existingEmails }: UserCredentialModalProps) {
  const [phase, setPhase] = useState<Phase>('form');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<{ usuario: string; password: string } | null>(null);
  const [createdName, setCreatedName] = useState('');
  const [copied, setCopied] = useState(false);

  function reset() {
    setPhase('form');
    setEmailError(null);
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
      telefono: String(formData.get('telefono') ?? '').trim(),
      email: String(formData.get('email') ?? '').trim(),
    };

    if (existingEmails.some((existing) => existing.toLowerCase() === data.email.toLowerCase())) {
      setEmailError('El correo ingresado ya se encuentra registrado en el sistema.');
      return;
    }

    setEmailError(null);
    setPhase('loading');

    const result = await generateUserCredentialsAction({ ...data, role });

    if (!result.success || !result.usuario || !result.passwordTemporal) {
      setPhase('form');
      setEmailError(result.error ?? 'No se pudo generar la credencial.');
      return;
    }

    setCredentials({ usuario: result.usuario, password: result.passwordTemporal });
    setCreatedName([data.primerNombre, data.segundoNombre, data.apellidoPaterno, data.apellidoMaterno].filter(Boolean).join(' '));
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
    <Modal isOpen={isOpen} onClose={handleClose} title={`Generar Credenciales — ${USER_ROLE_LABELS[role]}`} accent="gold">
      {phase === 'success' && credentials ? (
        <div className="animate-fade-in p-6">
          <div className="mb-3.5 flex justify-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-risk-low/10">
              <Check className="h-6 w-6 text-risk-low" aria-hidden="true" />
            </span>
          </div>
          <p className="mb-1 text-center text-base font-semibold text-brand-ink-900">
            {USER_ROLE_LABELS[role]} registrado con éxito
          </p>
          <p className="mb-4 text-center text-[12.5px] text-neutral-text-muted">{createdName}</p>

          <div className="mb-4 rounded-lg border-l-[3px] border-brand-gold-500 bg-neutral-bg p-3.5">
            <div className="mb-2 flex items-center justify-between text-[12.5px]">
              <span className="text-neutral-text-muted">Usuario</span>
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
            Deberá cambiar su contraseña en el primer inicio de sesión (obligatorio, no editable)
          </label>

          <Button variant="ink" onClick={handleClose} className="w-full">
            Cerrar
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="p-5">
          {emailError && (
            <div role="alert" className="mb-3.5 animate-fade-in rounded-md border border-risk-critical/20 bg-risk-critical/10 px-3 py-2.5 text-xs text-risk-critical">
              {emailError}
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
          <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input label="Teléfono" name="telefono" placeholder="+591 7XX XXXXX" accent="gold" required disabled={phase === 'loading'} />
            <Input
              label="Correo institucional"
              name="email"
              type="email"
              placeholder="nombre.apellido@cochabamba.bo"
              accent="gold"
              required
              disabled={phase === 'loading'}
            />
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
