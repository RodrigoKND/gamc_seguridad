import { Suspense } from 'react';
import { GuardiasView } from '@/features/guardias/components/GuardiasView';

// RF-01, RF-12 (MASTER.md sección 7.3).
export default function GuardiasPage() {
  return (
    <Suspense fallback={null}>
      <GuardiasView />
    </Suspense>
  );
}
