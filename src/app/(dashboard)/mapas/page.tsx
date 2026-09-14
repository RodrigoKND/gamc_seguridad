import { MapasViewLoader } from '@/features/mapas/components/MapasViewLoader';
import { AccessDeniedBanner } from '@/features/dashboard/components/AccessDeniedBanner';

// RF/RNF: Módulo de Mapas — RF-G1-01/02 (MASTER.md sección 7.3).
// Home del Operador (lib/permissions.ts ROLE_HOME_ROUTE) — por eso, a
// diferencia de /dashboard, acá también se lee ?denied= (MASTER.md sección
// 15.5): si el Operador fuerza una ruta fuera de su alcance, el middleware
// lo trae de vuelta acá con el mensaje, no a un /dashboard que no tiene.
export default async function MapasPage({
  searchParams,
}: {
  searchParams: Promise<{ denied?: string }>;
}) {
  const { denied } = await searchParams;

  return (
    <>
      {denied && (
        <div className="px-4 pt-4">
          <AccessDeniedBanner deniedPath={denied} className="" />
        </div>
      )}
      <MapasViewLoader />
    </>
  );
}
