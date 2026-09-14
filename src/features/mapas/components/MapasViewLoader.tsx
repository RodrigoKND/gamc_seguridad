'use client';

import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/feedback/Skeleton';

// `ssr: false` en next/dynamic solo se permite dentro de un Client
// Component — este wrapper existe únicamente para eso; page.tsx sigue
// siendo un Server Component normal.
const MapasView = dynamic(() => import('./MapasView').then((mod) => mod.MapasView), {
  ssr: false,
  loading: () => (
    <div className="p-6">
      <Skeleton className="h-[calc(100vh-64px-48px-48px)] w-full" />
    </div>
  ),
});

export function MapasViewLoader() {
  return <MapasView />;
}
