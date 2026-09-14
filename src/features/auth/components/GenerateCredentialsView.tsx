'use client';

import { useEffect, useState } from 'react';
import { ShieldCheck, UserCog, UserRoundPlus } from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { getGuardias, getUsuarios } from '@/lib/data-source';
import { GuardCreateModal } from '@/features/guardias/components/GuardCreateModal';
import { UserCredentialModal } from './UserCredentialModal';

// RF-01, RF-03 (MASTER.md sección 7.3, 15.1 — único ítem exclusivo de
// Super Admin). Selector de tipo → Guardia reutiliza GuardCreateModal tal
// cual (ya implementa MASTER.md sección 13.2/14.2); Operador/Administrador
// usa el formulario de email nuevo (UserCredentialModal, sección 15.4).
// Migrado a la paleta 2026 el 2026-09-06 (MASTER.md sección 4) — pantalla
// exclusiva de Super Admin, únicos módulos junto con Login/Dashboard Shell
// migrados hasta ahora.

type TipoCredencial = 'operador' | 'guardia' | 'administrador';

const TIPOS: { id: TipoCredencial; label: string; description: string; icon: typeof ShieldCheck }[] = [
  { id: 'operador', label: 'Operador de Monitoreo', description: 'Acceso al Módulo de Mapas, Guardias (lectura) y Hechos/Reportes.', icon: UserCog },
  { id: 'guardia', label: 'Guardia', description: 'Personal de campo — patrullaje, turnos y reportes desde la app móvil.', icon: UserRoundPlus },
  { id: 'administrador', label: 'Administrador', description: 'Edita y activa/desactiva guardias — no genera credenciales nuevas.', icon: ShieldCheck },
];

export function GenerateCredentialsView() {
  const [tipo, setTipo] = useState<TipoCredencial | null>(null);
  const [existingCis, setExistingCis] = useState<string[]>([]);
  const [existingEmails, setExistingEmails] = useState<string[]>([]);

  useEffect(() => {
    getGuardias().then((guards) => setExistingCis(guards.map((g) => g.ci)));
    getUsuarios().then((users) => setExistingEmails(users.map((u) => u.email)));
  }, []);

  return (
    <PageContainer>
      <div className="col-span-12 mb-1">
        <h1 className="text-4xl font-bold text-brand-ink-900">Generar Credenciales</h1>
        <p className="mt-0.5 text-sm text-neutral-text-muted">
          Alta de Operador de Monitoreo, Guardia o Administrador — usuario y contraseña se generan automáticamente
        </p>
      </div>

      <div className="col-span-12 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {TIPOS.map((t, i) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTipo(t.id)}
              className="flex animate-fade-in-up flex-col items-start gap-2.5 rounded-2xl border border-neutral-border bg-white p-5 text-left transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-brand-gold-500/60 hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-600 focus-visible:ring-offset-2"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-brand-gold-500/20 to-brand-gold-500/5 text-brand-gold-700">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <p className="text-base font-semibold text-brand-ink-900">{t.label}</p>
              <p className="text-[12.5px] leading-relaxed text-neutral-text-muted">{t.description}</p>
            </button>
          );
        })}
      </div>

      <GuardCreateModal
        isOpen={tipo === 'guardia'}
        onClose={() => setTipo(null)}
        existingCis={existingCis}
        onCreated={(data) => {
          // GuardCreateModal ya creó el guardia en el backend y esperó la
          // respuesta real antes de llegar acá (bug corregido 2026-09-14:
          // antes esto volvía a llamar a generateGuardCredentialsAction
          // "en segundo plano", creando el guardia una segunda vez sin que
          // nadie esperara el resultado). Acá solo se actualiza la lista
          // local de CIs ya usadas, para que una alta siguiente en la misma
          // sesión valide el duplicado sin esperar a recargar la página.
          setExistingCis((prev) => [...prev, data.ci]);
        }}
      />

      <UserCredentialModal
        isOpen={tipo === 'operador' || tipo === 'administrador'}
        role={tipo === 'operador' ? 'operador_monitoreo' : 'admin'}
        existingEmails={existingEmails}
        onClose={() => setTipo(null)}
      />
    </PageContainer>
  );
}
