// RF/RNF: Dashboard Shell — Grupo 4 (MASTER.md sección 7.3).
// Encabezado de página — título + subtítulo opcional + acciones alineadas a
// la derecha. Título según MASTER.md sección 3 ("Título de página": text-4xl
// font-bold). Portado desde refactor/dashboard-design y adaptado a los
// tokens de marca vigentes (primary-900 en vez de hex crudo).

export interface PageHeaderProps {
  title: string;
  /** Texto o nodo (p. ej. el saludo del Dashboard con el "?" de acento). */
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
}

export function PageHeader({ title, subtitle, action }: PageHeaderProps) {
  return (
    <header className="col-span-12 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-4xl font-bold tracking-tight text-primary-900">{title}</h1>
        {subtitle && <p className="mt-1.5 text-base text-neutral-text-muted">{subtitle}</p>}
      </div>
      {action && <div className="flex items-center gap-2.5">{action}</div>}
    </header>
  );
}
