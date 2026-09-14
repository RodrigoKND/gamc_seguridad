// Primitivo del estado "loading" (MASTER.md sección 8): animate-pulse,
// nunca un spinner genérico aislado. Se reutiliza en todos los módulos
// (MASTER.md sección 6) — no reimplementar por feature.

export interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      role="status"
      aria-label="Cargando"
      className={['animate-pulse rounded-md bg-neutral-border', className].join(' ')}
    />
  );
}
