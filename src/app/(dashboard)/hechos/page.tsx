import { Suspense } from 'react';
import { HechosView } from '@/features/hechos/components/HechosView';

// RF-G3-02 a 08, RF-10 (MASTER.md sección 7.3).
export default function HechosPage() {
  return (
    <Suspense fallback={null}>
      <HechosView />
    </Suspense>
  );
}
