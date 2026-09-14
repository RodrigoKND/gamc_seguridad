'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, CheckCircle2, Eye, EyeOff, KeyRound, Mail, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { login } from '../actions/login';
import { useAuthSession } from '../hooks/useAuthSession';
import { ROLE_HOME_ROUTE } from '@/lib/permissions';
import type { LoginStatus } from '../types';

// RF-02, RF-03 (MASTER.md sección 7.3). Login genérico — cualquier rol del
// sistema (Super Administrador, Administrador, Operador de Monitoreo), no
// solo Super Admin. Estados obligatorios: default, loading, error, éxito
// (MASTER.md sección 8). Toggle mostrar/ocultar contraseña
// (ux: password-toggle). Autocomplete habilitado para permitir gestores de
// contraseñas (ux: accessible-authentication). Inputs con `accent="gold"`
// (paleta 2026, MASTER.md sección 4).

export function LoginForm() {
  const router = useRouter();
  const { login: startSession } = useAuthSession();
  const [status, setStatus] = useState<LoginStatus>('idle');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const identifier = String(formData.get('identifier') ?? '').trim();
    const password = String(formData.get('password') ?? '');

    setStatus('loading');
    setErrorMessage(null);

    const result = await login({ identifier, password });

    if (result.success) {
      setStatus('success');
      if (result.user) {
        // Normaliza rol a lowercase por si la BD trae 'ADMIN' en mayúsculas
        const normalizedRole = String(result.user.role).toLowerCase() as typeof result.user.role;
        const normalizedUser = { ...result.user, role: normalizedRole };
        startSession(normalizedUser);
        const home = ROLE_HOME_ROUTE[normalizedRole] ?? ROLE_HOME_ROUTE[result.user.role] ?? '/dashboard';
        setTimeout(() => router.push(home), 700);
        return;
      }
      setTimeout(() => router.push('/dashboard'), 700);
    } else {
      setStatus('error');
      setErrorMessage(result.error ?? 'No se pudo iniciar sesión.');
    }
  }

  const isLoading = status === 'loading';
  const isSuccess = status === 'success';

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-[420px] rounded-2xl border border-neutral-border bg-white p-9 shadow-[0_1px_2px_rgba(15,15,15,0.04),0_20px_40px_-16px_rgba(15,15,15,0.12)]"
    >
      <div className="mb-6 flex items-center gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-ink-900/[0.06] text-brand-ink-900">
          <ShieldCheck className="h-[18px] w-[18px]" aria-hidden="true" />
        </span>
        <div>
          <h1 className="text-lg font-semibold leading-tight text-brand-ink-900">Iniciar sesión</h1>
          <p className="text-xs text-neutral-text-muted">Dirección de Seguridad Ciudadana</p>
        </div>
      </div>

      <p className="mb-6 rounded-lg bg-neutral-bg px-3.5 py-3 text-[12.5px] leading-relaxed text-neutral-text-muted">
        Este panel es de uso exclusivo del personal autorizado del GAMC. El acceso no autorizado será
        registrado y reportado.
      </p>

      <div className="mb-4">
        <Input
          label="Usuario o correo institucional"
          name="identifier"
          type="email"
          autoComplete="username"
          placeholder="nombre.apellido@cochabamba.bo"
          required
          disabled={isLoading || isSuccess}
          accent="gold"
          icon={<Mail className="h-4 w-4" aria-hidden="true" />}
        />
      </div>

      <div className="mb-1 relative">
        <Input
          label="Contraseña"
          name="password"
          type={passwordVisible ? 'text' : 'password'}
          autoComplete="current-password"
          placeholder="••••••••"
          required
          disabled={isLoading || isSuccess}
          accent="gold"
          icon={<KeyRound className="h-4 w-4" aria-hidden="true" />}
          className="pr-10"
        />
        <button
          type="button"
          onClick={() => setPasswordVisible((v) => !v)}
          aria-label={passwordVisible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          className="absolute right-2.5 top-[30px] rounded-md p-1 text-neutral-text-muted transition-colors duration-200 hover:text-neutral-text focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-600 focus-visible:ring-offset-2"
        >
          {passwordVisible ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
        </button>
      </div>

      {status === 'error' && errorMessage && (
        <div
          role="alert"
          className="mt-4 flex animate-fade-in items-start gap-2 rounded-md border border-risk-critical/20 bg-risk-critical/10 px-3 py-2.5"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-risk-critical" aria-hidden="true" />
          <p className="text-[12.5px] leading-snug text-risk-critical">{errorMessage}</p>
        </div>
      )}

      {isSuccess && (
        <div
          role="status"
          className="mt-4 flex animate-fade-in items-center gap-2 rounded-md border border-risk-low/20 bg-risk-low/10 px-3 py-2.5"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0 text-risk-low" aria-hidden="true" />
          <p className="text-[12.5px] font-semibold text-risk-low">Autenticado correctamente. Redirigiendo al panel…</p>
        </div>
      )}

      <Button type="submit" variant="ink" isLoading={isLoading} disabled={isSuccess} className="mt-6 w-full py-2.5">
        {isLoading ? 'Verificando…' : 'Ingresar'}
      </Button>

      <div className="mt-4 text-center">
        <a href="#" className="text-xs font-medium text-brand-gold-700 hover:text-brand-ink-900">
          ¿Olvidó su contraseña? Contacte a Sistemas GAMC
        </a>
      </div>
    </form>
  );
}
