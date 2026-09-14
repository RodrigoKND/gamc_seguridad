import { Camera } from 'lucide-react';
import { EmptyState } from '@/components/feedback/EmptyState';

// RF/RNF: Tab Futuro — ESC-01, ESC-03 (MASTER.md sección 7.3).
// Estado "empty" obligatorio (MASTER.md sección 8): se superpone al canvas
// del mapa sin desmontarlo (MASTER.md sección 7.2) — el mapa base sigue
// vivo debajo, listo para cuando se agreguen cámaras/geocercas.

export function FutureLayerPlaceholder() {
  return (
    <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-white/85 backdrop-blur-sm">
      <EmptyState
        icon={Camera}
        title="Próximas capas: cámaras, geocercas"
        description="Estas vistas GIS adicionales se habilitarán en una fase posterior del proyecto."
        className="max-w-sm bg-white"
      />
    </div>
  );
}
