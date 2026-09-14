import { ShieldAlert } from 'lucide-react';

// MASTER.md sección 15.5 — "el middleware de Next.js debe redirigir a
// /dashboard con un mensaje claro". Este banner es ese mensaje: se muestra
// cuando middleware.ts (src/middleware.ts) redirige acá con ?denied=<ruta>
// tras bloquear el acceso de un rol a una ruta fuera de su alcance.

const MODULE_LABELS: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/credenciales': 'Generar Credenciales',
  '/mapas': 'Módulo de Mapas',
  '/hechos': 'Reporte',
  '/reportes': 'Historial',
};

export interface AccessDeniedBannerProps {
  deniedPath: string;
  className?: string;
}

export function AccessDeniedBanner({ deniedPath, className = 'col-span-12' }: AccessDeniedBannerProps) {
  const label = MODULE_LABELS[deniedPath] ?? 'esa sección';

  return (
    <div
      role="alert"
      className={[
        'flex animate-fade-in items-start gap-2.5 rounded-md border border-risk-critical/20 bg-risk-critical/10 px-4 py-3',
        className,
      ].join(' ')}
    >
      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-risk-critical" aria-hidden="true" />
      <p className="text-[12.5px] leading-snug text-risk-critical">
        Su rol no tiene permiso para acceder al módulo &quot;{label}&quot;. Si necesita este acceso, contacte a un
        Super Administrador.
      </p>
    </div>
  );
}
