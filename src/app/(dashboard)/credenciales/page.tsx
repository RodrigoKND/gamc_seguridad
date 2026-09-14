import { GenerateCredentialsView } from '@/features/auth/components/GenerateCredentialsView';

// RF-01, RF-03 (MASTER.md sección 7.3, 15.1 — exclusivo de Super Admin;
// gateado también por middleware.ts y lib/permissions.ts).
export default function CredencialesPage() {
  return <GenerateCredentialsView />;
}
