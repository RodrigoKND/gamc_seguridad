// RF/RNF: Dashboard Shell — Grupo 4 (MASTER.md sección 7.3).
// Encabezado de página — título + subtítulo opcional + acciones alineadas a
// la derecha. Título según MASTER.md sección 3 ("Título de página": text-4xl
// font-bold). Portado desde refactor/dashboard-design y adaptado a los
// tokens de marca vigentes (primary-900 en vez de hex crudo). F7: filete
// dorado bajo el título (motivo del escudo) que se "dibuja" al entrar.

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
        <h1 className="animate-fade-in-up text-4xl font-bold tracking-tight text-primary-900">{title}</h1>
        <span aria-hidden="true" className="mt-2 block h-[3px] w-12 origin-left animate-grow-bar rounded-full bg-accent-500" />
        {subtitle && <p className="mt-2 animate-fade-in-up text-base text-neutral-text-muted [animation-delay:80ms]">{subtitle}</p>}
      </div>
      {action && <div className="flex items-center gap-2.5">{action}</div>}
    </header>
  );
}
