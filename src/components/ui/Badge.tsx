// Badge primitivo compartido — MASTER.md sección 11: "fondo al 10% de
// opacidad del color semántico + texto sólido del mismo color". No
// duplicar por feature (MASTER.md sección 6); cada caller pasa sus propias
// clases bg-*/10 text-* (ver src/types/risk.ts, src/types/epi.ts,
// features/guardias/types.ts).

export interface BadgeProps {
  className?: string;
  children: React.ReactNode;
  dotClassName?: string;
}

export function Badge({ className = '', children, dotClassName }: BadgeProps) {
  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-semibold',
        className,
      ].join(' ')}
    >
      {dotClassName && <span className={['h-1.5 w-1.5 shrink-0 rounded-full', dotClassName].join(' ')} />}
      {children}
    </span>
  );
}
