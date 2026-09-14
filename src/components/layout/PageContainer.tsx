// RF/RNF: Dashboard Shell — Grupo 4 (MASTER.md sección 7.3).
// Main Stage: fluido, max-w-[1600px] mx-auto px-6 py-6, grid 12 cols → 1 col
// <md (MASTER.md sección 7.1).

export interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
}

export function PageContainer({ children, className = '' }: PageContainerProps) {
  return (
    <div className={['mx-auto max-w-stage px-6 py-6', className].join(' ')}>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-12">{children}</div>
    </div>
  );
}

// Nota: los 8 estados de MASTER.md sección 8 no aplican aquí — PageContainer
// es un contenedor de layout puro sin interacción ni datos propios; cada
// bloque que renderiza dentro de él expresa sus propios estados.
